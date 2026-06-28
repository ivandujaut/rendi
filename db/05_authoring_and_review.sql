-- =====================================================================
-- 05_authoring_and_review.sql
-- (1) create_exam(jsonb): alta de simulacros desde la app, solo docente,
--     en una sola transaccion (examen + preguntas + clave).
-- (2) get_attempt_review(uuid): revision para el alumno, que SOLO expone
--     la respuesta correcta si el examen tiene student_review = true y el
--     intento ya fue entregado.
-- Ejecutar despues de 01–04.
-- =====================================================================

create or replace function public.create_exam(p jsonb)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_exam uuid;
  v_uid  text := auth.jwt()->>'sub';
  q      jsonb;
  v_q    uuid;
  i      int := 0;
begin
  if not public.is_teacher() then
    raise exception 'no autorizado';
  end if;

  insert into public.exams
    (title, year, duration_min, shuffle, student_review, pass_mark, is_published, created_by)
  values
    (nullif(p->>'title',''),
     nullif(p->>'year','')::int,
     coalesce((p->>'duration_min')::int, 40),
     coalesce((p->>'shuffle')::boolean, true),
     coalesce((p->>'student_review')::boolean, false),
     coalesce((p->>'pass_mark')::int, 60),
     coalesce((p->>'is_published')::boolean, true),
     v_uid)
  returning id into v_exam;

  for q in select * from jsonb_array_elements(coalesce(p->'questions','[]'::jsonb)) loop
    i := i + 1;
    insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
    values (v_exam,
            coalesce((q->>'number')::int, i),
            nullif(q->>'topic',''),
            q->>'prompt',
            nullif(q->>'figure_url',''),
            coalesce(q->'options', '[]'::jsonb))
    returning id into v_q;

    insert into public.answer_keys (question_id, correct)
    values (v_q, upper(q->>'correct'));
  end loop;

  return v_exam;
end;
$$;

grant execute on function public.create_exam(jsonb) to authenticated;


create or replace function public.get_attempt_review(p_attempt uuid)
returns table (
  number int, topic text, prompt text,
  your_choice char, correct char, is_correct boolean
)
language plpgsql security definer
set search_path = public
as $$
declare
  v_user      text;
  v_review    boolean;
  v_submitted timestamptz;
  v_exam      uuid;
begin
  select a.user_id, e.student_review, a.submitted_at, a.exam_id
    into v_user, v_review, v_submitted, v_exam
  from public.attempts a
  join public.exams e on e.id = a.exam_id
  where a.id = p_attempt;

  if v_user is null then raise exception 'intento inexistente'; end if;
  if v_user <> (auth.jwt()->>'sub') and not public.is_teacher() then
    raise exception 'no autorizado';
  end if;
  if v_submitted is null then raise exception 'intento no entregado'; end if;
  -- El alumno solo ve la clave si el docente habilito la revision.
  if not v_review and not public.is_teacher() then
    raise exception 'revision no habilitada';
  end if;

  return query
    select q.number, q.topic, q.prompt,
           r.choice as your_choice, k.correct,
           (r.choice = k.correct) as is_correct
    from public.questions q
    join public.answer_keys k on k.question_id = q.id
    left join public.responses r
           on r.question_id = q.id and r.attempt_id = p_attempt
    where q.exam_id = v_exam
    order by q.number;
end;
$$;

grant execute on function public.get_attempt_review(uuid) to authenticated;
