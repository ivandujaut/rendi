-- =====================================================================
-- 08_exam_management.sql  ·  Editar y eliminar simulacros (docente)
-- (1) update_exam: actualiza metadatos siempre; reemplaza preguntas SOLO
--     si el examen no tiene intentos (cambiarlas alteraría la corrección
--     de quienes ya rindieron).
-- (2) delete_exam: borra el examen y, en cascada, sus intentos/respuestas
--     (confirmación fuerte del lado del cliente).
-- Ejecutar después de 01–07.
-- =====================================================================

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

  -- Metadatos: siempre editables.
  update public.exams set
    title          = coalesce(nullif(p->>'title',''), title),
    year           = nullif(p->>'year','')::int,
    duration_min   = coalesce((p->>'duration_min')::int, duration_min),
    shuffle        = coalesce((p->>'shuffle')::boolean, shuffle),
    student_review = coalesce((p->>'student_review')::boolean, student_review),
    pass_mark      = coalesce((p->>'pass_mark')::int, pass_mark),
    is_published   = coalesce((p->>'is_published')::boolean, is_published)
  where id = p_exam;

  -- Preguntas: reemplazo total, SOLO si vienen y el examen no tiene intentos.
  select exists (select 1 from public.attempts where exam_id = p_exam) into v_has_attempts;
  if (p ? 'questions') and not v_has_attempts then
    delete from public.questions where exam_id = p_exam;  -- cascade → answer_keys
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

-- delete_exam: borrado completo (incluye intentos + respuestas en cascada).
create or replace function public.delete_exam(p_exam uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.is_teacher() then
    raise exception 'no autorizado';
  end if;
  delete from public.attempts where exam_id = p_exam;  -- cascade → responses
  delete from public.exams where id = p_exam;          -- cascade → questions, answer_keys
end;
$$;

grant execute on function public.delete_exam(uuid) to authenticated;
