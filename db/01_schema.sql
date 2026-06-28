-- =====================================================================
-- 01_schema.sql  ·  Esquema base del simulador OATec
-- Identidad: el id de usuario es el Clerk user id (claim "sub"), tipo text.
-- =====================================================================

-- Perfiles (se llena la 1ra vez que entra el usuario, o por webhook de Clerk)
create table if not exists public.profiles (
  id          text primary key,                 -- Clerk user id (sub)
  full_name   text,
  group_name  text,                              -- comision / curso
  role        text not null default 'student',  -- 'student' | 'teacher'
  created_at  timestamptz not null default now()
);

-- Examenes / modelos de simulacro
create table if not exists public.exams (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  year            int,
  duration_min    int  not null default 40,
  shuffle         boolean not null default true,
  student_review  boolean not null default false, -- si el alumno ve la correccion
  pass_mark       int  not null default 60,
  is_published    boolean not null default false,
  created_by      text references public.profiles(id),
  created_at      timestamptz not null default now()
);

-- Preguntas (SIN la respuesta correcta: eso vive en answer_keys)
create table if not exists public.questions (
  id          uuid primary key default gen_random_uuid(),
  exam_id     uuid not null references public.exams(id) on delete cascade,
  number      int  not null,
  topic       text,
  prompt      text not null,
  figure_url  text,                              -- path en Storage, ej 'figs/q9.jpg'
  options     jsonb not null,                    -- ["...","...",...] en orden A..E
  unique (exam_id, number)
);

-- Clave de respuestas (tabla separada y protegida por RLS)
create table if not exists public.answer_keys (
  question_id uuid primary key references public.questions(id) on delete cascade,
  correct     char(1) not null check (correct in ('A','B','C','D','E'))
);

-- Intentos
create table if not exists public.attempts (
  id            uuid primary key default gen_random_uuid(),
  exam_id       uuid not null references public.exams(id),
  user_id       text not null references public.profiles(id),
  started_at    timestamptz not null default now(),
  submitted_at  timestamptz,
  score         int,
  total         int,
  auto          boolean default false
);
create index if not exists idx_attempts_exam on public.attempts(exam_id);
create index if not exists idx_attempts_user on public.attempts(user_id);

-- Respuestas del alumno
create table if not exists public.responses (
  attempt_id  uuid not null references public.attempts(id) on delete cascade,
  question_id uuid not null references public.questions(id),
  choice      char(1) check (choice in ('A','B','C','D','E')),
  primary key (attempt_id, question_id)
);

-- ---------------------------------------------------------------------
-- Helpers de identidad / rol (usados por las politicas RLS)
-- ---------------------------------------------------------------------
create or replace function public.clerk_uid()
returns text language sql stable
as $$ select auth.jwt()->>'sub' $$;

-- security definer: puede leer profiles sin bloquearse a si mismo en RLS
create or replace function public.is_teacher()
returns boolean language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (auth.jwt()->>'sub') and p.role = 'teacher'
  )
$$;
