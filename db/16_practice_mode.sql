-- 16_practice_mode.sql
-- Modo Práctica (P1): persistencia + señal por tema para el docente.
--
-- attempts.mode distingue 'exam' (con nota, cuenta para "Resultados del curso")
-- de 'practice' (estudio, feedback inmediato, sin nota). Las RPCs de estadística
-- pasan a recibir p_mode:
--   · examen  → cuenta solo intentos ENTREGADOS (submitted_at not null).
--   · práctica→ cuenta cada respuesta apenas entra (una práctica a medias suma).
-- El `filter (where a.id is not null)` asegura que un modo no contamine al otro
-- (y, de paso, que respuestas de intentos sin cerrar no inflen las stats).

-- 1) columna mode (idempotente)
alter table public.attempts add column if not exists mode text not null default 'exam';
do $$ begin
  alter table public.attempts add constraint attempts_mode_chk check (mode in ('exam', 'practice'));
exception when duplicate_object then null; end $$;

create index if not exists idx_attempts_exam_mode on public.attempts (exam_id, mode);

-- 2) estadística por pregunta, scopeada por modo (drop+create: cambia la firma)
drop function if exists public.exam_question_stats(uuid);
create function public.exam_question_stats(p_exam uuid, p_mode text default 'exam')
returns table (number int, topic text, ok bigint, tot bigint, pct numeric, correct char)
language sql security definer
set search_path = public
as $$
  select q.number, q.topic,
         count(*) filter (where a.id is not null and r.choice = k.correct) as ok,
         count(r.choice) filter (where a.id is not null) as tot,
         round(100.0 * count(*) filter (where a.id is not null and r.choice = k.correct)
               / nullif(count(r.choice) filter (where a.id is not null), 0)) as pct,
         k.correct
  from public.questions q
  join public.answer_keys k on k.question_id = q.id
  left join public.responses r on r.question_id = q.id
  left join public.attempts a
    on a.id = r.attempt_id
   and a.mode = p_mode
   and (p_mode <> 'exam' or a.submitted_at is not null)
  where q.exam_id = p_exam and public.is_teacher()
  group by q.number, q.topic, k.correct
  order by pct nulls last, q.number;
$$;

-- 3) estadística por tema, scopeada por modo
drop function if exists public.exam_topic_stats(uuid);
create function public.exam_topic_stats(p_exam uuid, p_mode text default 'exam')
returns table (topic text, ok bigint, tot bigint, pct numeric)
language sql security definer
set search_path = public
as $$
  select q.topic,
         count(*) filter (where a.id is not null and r.choice = k.correct) as ok,
         count(r.choice) filter (where a.id is not null) as tot,
         round(100.0 * count(*) filter (where a.id is not null and r.choice = k.correct)
               / nullif(count(r.choice) filter (where a.id is not null), 0)) as pct
  from public.questions q
  join public.answer_keys k on k.question_id = q.id
  left join public.responses r on r.question_id = q.id
  left join public.attempts a
    on a.id = r.attempt_id
   and a.mode = p_mode
   and (p_mode <> 'exam' or a.submitted_at is not null)
  where q.exam_id = p_exam and public.is_teacher()
  group by q.topic
  order by pct nulls last;
$$;

grant execute on function public.exam_question_stats(uuid, text) to authenticated;
grant execute on function public.exam_topic_stats(uuid, text) to authenticated;
