-- =====================================================================
-- 02_rls.sql  ·  Row Level Security
-- Reglas: el alumno solo ve lo suyo; el docente ve todo; la CLAVE de
-- respuestas no es legible por alumnos (solo docente / service_role).
-- El service_role del backend ignora RLS: la correccion server-side
-- siempre puede leer answer_keys.
-- =====================================================================

alter table public.profiles    enable row level security;
alter table public.exams       enable row level security;
alter table public.questions   enable row level security;
alter table public.answer_keys enable row level security;
alter table public.attempts    enable row level security;
alter table public.responses   enable row level security;

-- ---------- profiles ----------
create policy "profiles: ver propio o docente ve todo"
  on public.profiles for select to authenticated
  using ( id = public.clerk_uid() or public.is_teacher() );

create policy "profiles: crear el propio"
  on public.profiles for insert to authenticated
  with check ( id = public.clerk_uid() );

create policy "profiles: editar el propio"
  on public.profiles for update to authenticated
  using ( id = public.clerk_uid() );

-- ---------- exams ----------
create policy "exams: publicados a todos, docente ve todo"
  on public.exams for select to authenticated
  using ( is_published = true or public.is_teacher() );

create policy "exams: solo docente crea"
  on public.exams for insert to authenticated
  with check ( public.is_teacher() );

create policy "exams: solo docente edita"
  on public.exams for update to authenticated
  using ( public.is_teacher() );

-- ---------- questions ----------  (no contienen la respuesta)
create policy "questions: de examenes publicados o docente"
  on public.questions for select to authenticated
  using (
    public.is_teacher()
    or exists (select 1 from public.exams e
               where e.id = exam_id and e.is_published = true)
  );

create policy "questions: solo docente escribe"
  on public.questions for all to authenticated
  using ( public.is_teacher() ) with check ( public.is_teacher() );

-- ---------- answer_keys ----------  CLAVE: solo docente puede leer
create policy "answer_keys: solo docente"
  on public.answer_keys for select to authenticated
  using ( public.is_teacher() );

create policy "answer_keys: solo docente escribe"
  on public.answer_keys for all to authenticated
  using ( public.is_teacher() ) with check ( public.is_teacher() );
-- (los alumnos NUNCA leen esta tabla; la correccion la hace el servidor)

-- ---------- attempts ----------
create policy "attempts: ver propios o docente ve todo"
  on public.attempts for select to authenticated
  using ( user_id = public.clerk_uid() or public.is_teacher() );

create policy "attempts: crear el propio"
  on public.attempts for insert to authenticated
  with check ( user_id = public.clerk_uid() );

create policy "attempts: actualizar el propio"
  on public.attempts for update to authenticated
  using ( user_id = public.clerk_uid() );

-- ---------- responses ----------
create policy "responses: ver propias o docente"
  on public.responses for select to authenticated
  using (
    public.is_teacher()
    or exists (select 1 from public.attempts a
               where a.id = attempt_id and a.user_id = public.clerk_uid())
  );

create policy "responses: insertar en intento propio"
  on public.responses for insert to authenticated
  with check (
    exists (select 1 from public.attempts a
            where a.id = attempt_id and a.user_id = public.clerk_uid())
  );

-- =====================================================================
-- Correccion server-side sin exponer la clave.
-- Devuelve puntaje + desglose por tema. SECURITY DEFINER: lee answer_keys
-- aunque el que llama sea un alumno, pero NO le devuelve las respuestas.
-- =====================================================================
create or replace function public.grade_attempt(p_attempt uuid)
returns table (score int, total int, per_topic jsonb)
language plpgsql security definer
set search_path = public
as $$
declare v_user text; v_score int; v_total int;
begin
  -- solo el dueño del intento (o docente) puede corregirlo
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

  update public.attempts
    set score = v_score, total = v_total, submitted_at = coalesce(submitted_at, now())
  where id = p_attempt;

  return query
    select v_score, v_total,
      jsonb_object_agg(t.topic, jsonb_build_object('ok', t.ok, 'tot', t.tot))
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
end;
$$;
