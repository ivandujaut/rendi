-- =====================================================================
-- 09_assignments.sql  ·  Asignación de simulacros por alumno + un intento
-- El alumno ya NO ve un examen por estar publicado: lo ve solo si el
-- docente se lo ASIGNÓ. Cada asignación habilita `attempts_allowed`
-- intentos (1 por defecto); el docente puede sumar +1 para re-habilitar.
-- Ejecutar después de 01–08.
-- =====================================================================

create table if not exists public.exam_assignments (
  exam_id          uuid not null references public.exams(id) on delete cascade,
  user_id          text not null references public.profiles(id) on delete cascade,
  attempts_allowed int  not null default 1,
  created_at       timestamptz not null default now(),
  primary key (exam_id, user_id)
);

alter table public.exam_assignments enable row level security;

-- El alumno ve sus propias asignaciones; el docente, todas.
create policy "assignments: ver propias o docente"
  on public.exam_assignments for select to authenticated
  using ( public.is_teacher() or user_id = public.clerk_uid() );

-- Solo el docente asigna / desasigna / ajusta intentos.
create policy "assignments: solo docente escribe"
  on public.exam_assignments for all to authenticated
  using ( public.is_teacher() ) with check ( public.is_teacher() );

-- ---------------------------------------------------------------------
-- Visibilidad: el alumno ve un examen SOLO si está asignado (y publicado).
-- ---------------------------------------------------------------------
drop policy if exists "exams: publicados a todos, docente ve todo" on public.exams;
create policy "exams: docente ve todo, alumno solo asignados"
  on public.exams for select to authenticated
  using (
    public.is_teacher()
    or (is_published and exists (
      select 1 from public.exam_assignments a
      where a.exam_id = exams.id and a.user_id = public.clerk_uid()
    ))
  );

-- Idem para las preguntas (no filtrar las preguntas dejaría una fuga).
drop policy if exists "questions: de examenes publicados o docente" on public.questions;
create policy "questions: docente o alumno asignado"
  on public.questions for select to authenticated
  using (
    public.is_teacher()
    or exists (
      select 1 from public.exam_assignments a
      join public.exams e on e.id = a.exam_id
      where a.exam_id = questions.exam_id
        and a.user_id = public.clerk_uid()
        and e.is_published
    )
  );
