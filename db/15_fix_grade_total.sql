-- 15_fix_grade_total.sql
-- Fix de corrección: grade_attempt tomaba el `total` como el número de
-- respuestas del alumno (join responses↔answer_keys), no las preguntas del
-- examen. Las preguntas dejadas en blanco quedaban FUERA del denominador
-- (38/39 en vez de 40) e inflaban el %. Ahora score/total se computan sobre
-- las preguntas CORREGIBLES del examen (las que tienen answer_key); las no
-- respondidas cuentan en el total pero no suman al score (= incorrectas).

create or replace function public.grade_attempt(p_attempt uuid)
returns table (score int, total int, per_topic jsonb)
language plpgsql security definer
set search_path = public
as $$
declare v_user text; v_exam uuid; v_score int; v_total int; v_pt jsonb;
begin
  select user_id, exam_id into v_user, v_exam
    from public.attempts where id = p_attempt;
  if v_user is null then raise exception 'intento inexistente'; end if;
  if v_user <> (auth.jwt()->>'sub') and not public.is_teacher() then
    raise exception 'no autorizado';
  end if;

  -- Denominador = preguntas corregibles del examen; left join a responses para
  -- que las no respondidas queden en el total pero no en el score.
  select count(*) filter (where r.choice = k.correct), count(*)
    into v_score, v_total
  from public.questions q
  join public.answer_keys k on k.question_id = q.id
  left join public.responses r
         on r.question_id = q.id and r.attempt_id = p_attempt
  where q.exam_id = v_exam;

  select jsonb_object_agg(t.topic, jsonb_build_object('ok', t.ok, 'tot', t.tot))
    into v_pt
  from (
    select q.topic,
           count(*) filter (where r.choice = k.correct) as ok,
           count(*) as tot
    from public.questions q
    join public.answer_keys k on k.question_id = q.id
    left join public.responses r
           on r.question_id = q.id and r.attempt_id = p_attempt
    where q.exam_id = v_exam
    group by q.topic
  ) t;

  update public.attempts
    set score = v_score, total = v_total, per_topic = v_pt,
        submitted_at = coalesce(submitted_at, now())
  where id = p_attempt;

  return query select v_score, v_total, v_pt;
end;
$$;

-- Re-corregir los intentos ya entregados con la lógica corregida (SQL directo,
-- sin pasar por el check de auth de la función; corre como owner del release).
with recomputed as (
  select att.id as attempt_id,
         count(*) filter (where r.choice = k.correct) as score,
         count(*) as total
  from public.attempts att
  join public.questions q   on q.exam_id = att.exam_id
  join public.answer_keys k on k.question_id = q.id
  left join public.responses r on r.question_id = q.id and r.attempt_id = att.id
  where att.submitted_at is not null
  group by att.id
),
topics as (
  select att.id as attempt_id,
         jsonb_object_agg(s.topic, jsonb_build_object('ok', s.ok, 'tot', s.tot)) as per_topic
  from public.attempts att
  cross join lateral (
    select q.topic,
           count(*) filter (where r.choice = k.correct) as ok,
           count(*) as tot
    from public.questions q
    join public.answer_keys k on k.question_id = q.id
    left join public.responses r on r.question_id = q.id and r.attempt_id = att.id
    where q.exam_id = att.exam_id
    group by q.topic
  ) s
  where att.submitted_at is not null
  group by att.id
)
update public.attempts a
set score = rc.score, total = rc.total, per_topic = tp.per_topic
from recomputed rc
join topics tp on tp.attempt_id = rc.attempt_id
where a.id = rc.attempt_id;
