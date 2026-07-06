-- 17_question_nature.sql
-- Etiquetado conceptual/numérica (#2). Groundwork para dirigir el active recall:
-- las CONCEPTUALES se re-preguntan bien; las NUMÉRICAS con los mismos valores no
-- aportan al repetir (se memoriza el número) y necesitarían parametrización.
--
-- Aditivo (expand/contract): columna con default + create_exam la lee con
-- coalesce, así el código viejo que todavía no la manda sigue funcionando.

alter table public.questions add column if not exists nature text not null default 'conceptual';
do $$ begin
  alter table public.questions add constraint questions_nature_chk check (nature in ('conceptual', 'numeric'));
exception when duplicate_object then null; end $$;

-- create_exam: ahora también guarda `nature` (default 'conceptual' si no viene).
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

    insert into public.questions (exam_id, number, topic, prompt, figure_url, options, kind, rubrica, nature)
    values (v_exam,
            coalesce((q->>'number')::int, i),
            nullif(q->>'topic',''),
            q->>'prompt',
            nullif(q->>'figure_url',''),
            case when v_kind = 'open' then null else coalesce(q->'options', '[]'::jsonb) end,
            v_kind,
            nullif(q->>'rubrica',''),
            coalesce(nullif(q->>'nature',''), 'conceptual'))
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
