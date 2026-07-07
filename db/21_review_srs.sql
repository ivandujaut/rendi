-- =====================================================================
-- db/21: Repaso espaciado (Leitner) para el loop "Repasar mis errores".
--
-- Antes (db/19): get_review_queue devolvía TODAS las conceptuales cuya última
-- respuesta fue incorrecta (clear-by-mastering: acertás una vez y desaparece).
-- Ahora cada pregunta es una CARTA con caja + fecha de repaso: vuelve en
-- intervalos crecientes (1 → 3 → 7 → 16 → 35 → 90 días). Aditiva.
-- Ejecutar en dev Y prod ANTES de mergear el código que la usa.
-- =====================================================================

create table if not exists public.review_cards (
  user_id     text not null references public.profiles(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  box         int  not null default 1 check (box between 1 and 6),
  due_at      timestamptz not null default now(),
  reps        int  not null default 0,
  lapses      int  not null default 0,
  updated_at  timestamptz not null default now(),
  primary key (user_id, question_id)
);
create index if not exists idx_review_cards_due on public.review_cards(user_id, due_at);

alter table public.review_cards enable row level security;
-- El alumno solo LEE sus cartas; las escrituras van por la RPC security-definer.
drop policy if exists "review_cards: ver propias" on public.review_cards;
create policy "review_cards: ver propias" on public.review_cards
  for select using ( user_id = public.clerk_uid() );

-- Intervalo por caja Leitner.
create or replace function public.review_box_interval(p_box int)
returns interval language sql immutable
as $$
  select case p_box
    when 1 then interval '1 day'
    when 2 then interval '3 days'
    when 3 then interval '7 days'
    when 4 then interval '16 days'
    when 5 then interval '35 days'
    else interval '90 days'
  end
$$;

-- Agenda (o crea) la carta del alumno para una pregunta según si acertó. Acierto:
-- sube de caja (hasta 6). Error: vuelve a la caja 1. Devuelve el nuevo due_at (para
-- mostrar "la repasás en X días"). Security-definer: el alumno no escribe directo.
create or replace function public.schedule_review_card(p_question uuid, p_correct boolean)
returns timestamptz
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid text := public.clerk_uid();
  v_box int;
  v_due timestamptz;
begin
  if v_uid is null then raise exception 'no autenticado'; end if;

  select box into v_box from public.review_cards where user_id = v_uid and question_id = p_question;
  if not found then v_box := 0; end if;

  v_box := case when p_correct then least(v_box + 1, 6) else 1 end;
  v_due := now() + public.review_box_interval(v_box);

  insert into public.review_cards (user_id, question_id, box, due_at, reps, lapses, updated_at)
  values (v_uid, p_question, v_box, v_due, 1, case when p_correct then 0 else 1 end, now())
  on conflict (user_id, question_id) do update set
    box        = excluded.box,
    due_at     = excluded.due_at,
    reps       = review_cards.reps + 1,
    lapses     = review_cards.lapses + case when p_correct then 0 else 1 end,
    updated_at = now();

  return v_due;
end;
$$;
grant execute on function public.schedule_review_card(uuid, boolean) to authenticated;

-- get_review_queue con SR: cartas VENCIDAS (due_at <= now) UNION conceptuales-mal SIN
-- carta todavía (para introducir preguntas nuevas al sistema).
create or replace function public.get_review_queue(p_limit int default 30)
returns table (id uuid, exam_id uuid, number int, topic text, prompt text, figure_url text, options jsonb)
language sql security definer
set search_path = public
as $$
  with me as ( select public.clerk_uid() as uid ),
  latest as (
    select distinct on (r.question_id) r.question_id, r.choice
    from public.responses r
    join public.attempts a on a.id = r.attempt_id
    where a.user_id = (select uid from me)
    order by r.question_id, a.started_at desc, r.attempt_id
  ),
  wrong_new as (
    -- conceptuales-mal que todavía no tienen carta → introducir al sistema
    select q.id, q.exam_id, q.number, q.topic, q.prompt, q.figure_url, q.options
    from latest l
    join public.questions q   on q.id = l.question_id
    join public.answer_keys k on k.question_id = q.id
    left join public.review_cards rc on rc.user_id = (select uid from me) and rc.question_id = q.id
    where q.kind = 'mcq' and q.nature = 'conceptual' and l.choice <> k.correct
      and rc.question_id is null
  ),
  due as (
    -- cartas vencidas (independiente de la última respuesta) de conceptuales mcq
    select q.id, q.exam_id, q.number, q.topic, q.prompt, q.figure_url, q.options
    from public.review_cards rc
    join public.questions q on q.id = rc.question_id
    where rc.user_id = (select uid from me) and rc.due_at <= now()
      and q.kind = 'mcq' and q.nature = 'conceptual'
  )
  select * from wrong_new
  union
  select * from due
  order by 2, 3
  limit greatest(p_limit, 1);
$$;
grant execute on function public.get_review_queue(int) to authenticated;
