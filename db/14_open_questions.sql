-- =====================================================================
-- 14_open_questions.sql  ·  Corrector asistido — Slice 2a (schema + pipeline)
-- Agrega preguntas de desarrollo ('open') SIN tocar el MCQ (OATEC).
--   · questions.kind ('mcq'|'open') + options nullable + rubrica opcional
--   · open_responses  (respuesta tipeada del alumno; NO reusa responses char(1))
--   · ai_gradings     (borrador de la IA + estado de revisión del docente)
--   · create_exam kind-aware (no inserta answer_keys para 'open')
-- El scoring MCQ (grade_attempt) NO cambia: cuenta filas de `responses`, que
-- sigue siendo MCQ-only; las respuestas 'open' viven en otra tabla y nunca
-- entran a esa cuenta. Ejecutar DESPUES de 01–13.
-- =====================================================================

-- ---------- questions: sumar kind / rubrica, aflojar options ----------
alter table public.questions
  add column if not exists kind    text not null default 'mcq'
    check (kind in ('mcq','open'));
alter table public.questions
  add column if not exists rubrica text;               -- ancla opcional para la IA
alter table public.questions
  alter column options drop not null;                  -- 'open' no tiene opciones

-- Invariante: una 'mcq' sigue teniendo opciones; una 'open' no las usa.
-- (No forzamos options IS NULL para 'open' — el seed viejo puede tener '[]'.)

-- ---------- open_responses: respuesta de desarrollo tipeada ----------
-- Surrogate id para poder referenciarla 1:1 desde ai_gradings; unique por
-- (attempt, question) para el upsert al entregar.
create table if not exists public.open_responses (
  id          uuid primary key default gen_random_uuid(),
  attempt_id  uuid not null references public.attempts(id) on delete cascade,
  question_id uuid not null references public.questions(id),
  answer_text text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (attempt_id, question_id)
);
create index if not exists idx_open_responses_attempt on public.open_responses(attempt_id);

-- ---------- ai_gradings: borrador de la IA + estado de revisión ----------
-- estado: pending  = borrador de la IA, esperando al docente
--         failed   = la IA falló/timeout → el docente corrige a mano, sin borrador
--         approved = el docente lo aprobó (llega al alumno)
--         rejected = el docente lo descarta y corrige a mano
create table if not exists public.ai_gradings (
  id                uuid primary key default gen_random_uuid(),
  open_response_id  uuid not null unique references public.open_responses(id) on delete cascade,
  feedback_borrador text,
  nota_sugerida     int,                               -- null en el MVP (feedback-first)
  estado            text not null default 'pending'
    check (estado in ('pending','failed','approved','rejected')),
  was_edited        boolean not null default false,    -- separado del estado, mide el criterio de éxito
  temas_flojos      text[] not null default '{}',
  aprobado_por      text references public.profiles(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_ai_gradings_estado on public.ai_gradings(estado);

-- ---------- RLS ----------
alter table public.open_responses enable row level security;
alter table public.ai_gradings    enable row level security;

-- open_responses: el alumno ve/escribe las de su propio intento; el docente ve todo.
-- (Espeja las políticas de `responses`.)
create policy "open_responses: ver propias o docente"
  on public.open_responses for select to authenticated
  using (
    public.is_teacher()
    or exists (select 1 from public.attempts a
               where a.id = attempt_id and a.user_id = public.clerk_uid())
  );

create policy "open_responses: escribir en intento propio"
  on public.open_responses for insert to authenticated
  with check (
    exists (select 1 from public.attempts a
            where a.id = attempt_id and a.user_id = public.clerk_uid())
  );

create policy "open_responses: actualizar en intento propio"
  on public.open_responses for update to authenticated
  using (
    exists (select 1 from public.attempts a
            where a.id = attempt_id and a.user_id = public.clerk_uid())
  );

-- ai_gradings: el docente ve y gestiona todo (aprobar/rechazar/editar en 2b).
-- El alumno ve SOLO lo aprobado de sus propias respuestas. Escribe el cron
-- (service-role, ignora RLS); no hay política de insert para alumno/docente.
create policy "ai_gradings: docente gestiona todo"
  on public.ai_gradings for all to authenticated
  using ( public.is_teacher() ) with check ( public.is_teacher() );

create policy "ai_gradings: alumno ve lo aprobado propio"
  on public.ai_gradings for select to authenticated
  using (
    estado = 'approved'
    and exists (
      select 1
      from public.open_responses o
      join public.attempts a on a.id = o.attempt_id
      where o.id = open_response_id and a.user_id = public.clerk_uid()
    )
  );

-- ---------- create_exam kind-aware ----------
-- Reemplaza la versión de 05: si la pregunta es 'open' no inserta answer_keys
-- (hoy lo hacía incondicional → con 'open' violaba el NOT NULL / CHECK de correct).
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
  v_kind text;
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
    v_kind := coalesce(nullif(q->>'kind',''), 'mcq');

    insert into public.questions (exam_id, number, topic, prompt, figure_url, options, kind, rubrica)
    values (v_exam,
            coalesce((q->>'number')::int, i),
            nullif(q->>'topic',''),
            q->>'prompt',
            nullif(q->>'figure_url',''),
            case when v_kind = 'open' then null else coalesce(q->'options', '[]'::jsonb) end,
            v_kind,
            nullif(q->>'rubrica',''))
    returning id into v_q;

    -- La clave solo existe para MCQ; una 'open' la corrige la IA + el docente.
    if v_kind = 'mcq' then
      insert into public.answer_keys (question_id, correct)
      values (v_q, upper(q->>'correct'));
    end if;
  end loop;

  return v_exam;
end;
$$;

grant execute on function public.create_exam(jsonb) to authenticated;
