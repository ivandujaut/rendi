-- =====================================================================
-- 12_exam_navigation.sql  ·  Control de navegación entre preguntas
-- Agrega exams.allow_back: si es false, el examen es lineal (el alumno no
-- puede volver a preguntas anteriores). Default true (comportamiento actual).
-- Recrea create_exam y update_exam para que persistan el campo.
-- Ejecutar después de 01–11.
-- =====================================================================

alter table public.exams add column if not exists allow_back boolean not null default true;

-- create_exam: ahora también guarda allow_back.
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
    (title, year, duration_min, shuffle, student_review, allow_back, pass_mark, is_published, created_by)
  values
    (nullif(p->>'title',''),
     nullif(p->>'year','')::int,
     coalesce((p->>'duration_min')::int, 40),
     coalesce((p->>'shuffle')::boolean, true),
     coalesce((p->>'student_review')::boolean, false),
     coalesce((p->>'allow_back')::boolean, true),
     coalesce((p->>'pass_mark')::int, 60),
     coalesce((p->>'is_published')::boolean, true),
     v_uid)
  returning id into v_exam;

  for q in select * from jsonb_array_elements(coalesce(p->'questions','[]'::jsonb)) loop
    i := i + 1;
    insert into public.questions (exam_id, number, topic, prompt, figure_url, options, explanation)
    values (v_exam,
            coalesce((q->>'number')::int, i),
            nullif(q->>'topic',''),
            q->>'prompt',
            nullif(q->>'figure_url',''),
            coalesce(q->'options', '[]'::jsonb),
            nullif(q->>'explanation',''))
    returning id into v_q;

    insert into public.answer_keys (question_id, correct)
    values (v_q, upper(q->>'correct'));
  end loop;

  return v_exam;
end;
$$;

grant execute on function public.create_exam(jsonb) to authenticated;

-- update_exam: ahora también actualiza allow_back.
create or replace function public.update_exam(p_exam uuid, p jsonb)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  q             jsonb;
  v_q           uuid;
  i             int := 0;
  v_has_attempts boolean;
begin
  if not public.is_teacher() then
    raise exception 'no autorizado';
  end if;
  if not exists (select 1 from public.exams where id = p_exam) then
    raise exception 'examen inexistente';
  end if;

  update public.exams set
    title          = coalesce(nullif(p->>'title',''), title),
    year           = nullif(p->>'year','')::int,
    duration_min   = coalesce((p->>'duration_min')::int, duration_min),
    shuffle        = coalesce((p->>'shuffle')::boolean, shuffle),
    student_review = coalesce((p->>'student_review')::boolean, student_review),
    allow_back     = coalesce((p->>'allow_back')::boolean, allow_back),
    pass_mark      = coalesce((p->>'pass_mark')::int, pass_mark),
    is_published   = coalesce((p->>'is_published')::boolean, is_published)
  where id = p_exam;

  select exists (select 1 from public.attempts where exam_id = p_exam) into v_has_attempts;
  if (p ? 'questions') and not v_has_attempts then
    delete from public.questions where exam_id = p_exam;
    for q in select * from jsonb_array_elements(coalesce(p->'questions','[]'::jsonb)) loop
      i := i + 1;
      insert into public.questions (exam_id, number, topic, prompt, figure_url, options, explanation)
      values (p_exam,
              coalesce((q->>'number')::int, i),
              nullif(q->>'topic',''),
              q->>'prompt',
              nullif(q->>'figure_url',''),
              coalesce(q->'options', '[]'::jsonb),
              nullif(q->>'explanation',''))
      returning id into v_q;

      insert into public.answer_keys (question_id, correct)
      values (v_q, upper(q->>'correct'));
    end loop;
  end if;
end;
$$;

grant execute on function public.update_exam(uuid, jsonb) to authenticated;
