-- 19_review_queue.sql
-- Loop de re-preguntar (active recall). Cola de "mis errores": las preguntas
-- CONCEPTUALES cuya ÚLTIMA respuesta del alumno fue incorrecta (clear-by-mastering:
-- si la re-acierta en el repaso, su última respuesta pasa a correcta y sale de la
-- cola). Excluye numéricas (re-preguntar los mismos valores = memorizar el número).
-- Aditivo: función nueva.

create or replace function public.get_review_queue(p_limit int default 30)
returns table (id uuid, exam_id uuid, number int, topic text, prompt text, figure_url text, options jsonb)
language sql security definer
set search_path = public
as $$
  with latest as (
    -- última respuesta del alumno por pregunta (por fecha de inicio del intento)
    select distinct on (r.question_id)
           r.question_id, r.choice
    from public.responses r
    join public.attempts a on a.id = r.attempt_id
    where a.user_id = auth.jwt()->>'sub'
    order by r.question_id, a.started_at desc, r.attempt_id
  )
  select q.id, q.exam_id, q.number, q.topic, q.prompt, q.figure_url, q.options
  from latest l
  join public.questions q   on q.id = l.question_id
  join public.answer_keys k on k.question_id = q.id
  where q.kind = 'mcq'
    and q.nature = 'conceptual'
    and l.choice <> k.correct   -- la última respuesta fue incorrecta
  order by q.exam_id, q.number
  limit greatest(p_limit, 1);
$$;

grant execute on function public.get_review_queue(int) to authenticated;
