-- =====================================================================
-- 04_app_patch.sql  ·  Ajustes que usa la app Next.js
-- Ejecutar DESPUES de 01, 02 y 03.
-- =====================================================================

-- Guardar el desglose por tema en el intento (para mostrarlo en el resultado
-- sin que el alumno tenga que leer la clave).
alter table public.attempts add column if not exists per_topic jsonb;

-- grade_attempt v2: persiste score, total, per_topic y submitted_at.
create or replace function public.grade_attempt(p_attempt uuid)
returns table (score int, total int, per_topic jsonb)
language plpgsql security definer
set search_path = public
as $$
declare v_user text; v_score int; v_total int; v_pt jsonb;
begin
  select user_id into v_user from public.attempts where id = p_attempt;
  if v_user is null then raise exception 'intento inexistente'; end if;
  if v_user <> (auth.jwt()->>'sub') and not public.is_teacher() then
    raise exception 'no autorizado';
  end if;

  select count(*) filter (where r.choice = k.correct), count(*)
    into v_score, v_total
  from public.responses r
  join public.answer_keys k on k.question_id = r.question_id
  where r.attempt_id = p_attempt;

  select jsonb_object_agg(t.topic, jsonb_build_object('ok', t.ok, 'tot', t.tot))
    into v_pt
  from (
    select q.topic,
           count(*) filter (where r.choice = k.correct) as ok,
           count(*) as tot
    from public.responses r
    join public.questions q   on q.id = r.question_id
    join public.answer_keys k on k.question_id = r.question_id
    where r.attempt_id = p_attempt
    group by q.topic
  ) t;

  update public.attempts
    set score = v_score, total = v_total, per_topic = v_pt,
        submitted_at = coalesce(submitted_at, now())
  where id = p_attempt;

  return query select v_score, v_total, v_pt;
end;
$$;

-- Estadistica por pregunta (panel docente). Solo docente.
create or replace function public.exam_question_stats(p_exam uuid)
returns table (number int, topic text, ok bigint, tot bigint, pct numeric, correct char)
language sql security definer
set search_path = public
as $$
  select q.number, q.topic,
         count(*) filter (where r.choice = k.correct) as ok,
         count(r.choice) as tot,
         round(100.0 * count(*) filter (where r.choice = k.correct)
               / nullif(count(r.choice), 0)) as pct,
         k.correct
  from public.questions q
  join public.answer_keys k on k.question_id = q.id
  left join public.responses r on r.question_id = q.id
  left join public.attempts a on a.id = r.attempt_id and a.submitted_at is not null
  where q.exam_id = p_exam and public.is_teacher()
  group by q.number, q.topic, k.correct
  order by pct nulls last, q.number;
$$;

-- Estadistica por tema (panel docente). Solo docente.
create or replace function public.exam_topic_stats(p_exam uuid)
returns table (topic text, ok bigint, tot bigint, pct numeric)
language sql security definer
set search_path = public
as $$
  select q.topic,
         count(*) filter (where r.choice = k.correct) as ok,
         count(r.choice) as tot,
         round(100.0 * count(*) filter (where r.choice = k.correct)
               / nullif(count(r.choice), 0)) as pct
  from public.questions q
  join public.answer_keys k on k.question_id = q.id
  left join public.responses r on r.question_id = q.id
  left join public.attempts a on a.id = r.attempt_id and a.submitted_at is not null
  where q.exam_id = p_exam and public.is_teacher()
  group by q.topic
  order by pct nulls last;
$$;

grant execute on function public.grade_attempt(uuid)      to authenticated;
grant execute on function public.exam_question_stats(uuid) to authenticated;
grant execute on function public.exam_topic_stats(uuid)    to authenticated;
