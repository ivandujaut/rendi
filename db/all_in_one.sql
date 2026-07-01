-- ================ db/01_schema.sql ================
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

-- ================ db/02_rls.sql ================
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

-- ================ db/03_seed.sql ================
-- =====================================================================
-- 03_seed.sql  ·  Migracion del banco Modelo OATec 2026 (40 preguntas)
-- Ejecutar DESPUES de 01_schema.sql y 02_rls.sql.
-- Las figuras se referencian por nombre; subi los .jpg al bucket 'figs'
-- de Supabase Storage (ver SETUP.md).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Fuente única del id del examen semilla. Todo lo de abajo lo referencia
-- via (select exam_id from seed_ref), así el id vive en UN solo lugar.
-- Se usa un temp table (no \set de psql) para que corra igual en psql y en
-- el editor SQL de Supabase (que ejecuta todo el script en una transacción).
-- Para una DB fresca podés cambiar el valor acá y nada más.
-- ---------------------------------------------------------------------
drop table if exists seed_ref;
create temp table seed_ref (exam_id uuid);
insert into seed_ref values ('00000000-0000-0000-0000-000000000026');

insert into public.exams (id, title, year, duration_min, shuffle, student_review, pass_mark, is_published)
values ((select exam_id from seed_ref),
        'Examen Modelo OATec 2026', 2026, 40, true, false, 60, true)
on conflict (id) do nothing;

-- Q1
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ((select exam_id from seed_ref), 1, 'Química',
          '¿Cuál de las siguientes opciones representa una propiedad intensiva de la materia?', null, '["El volumen de una muestra de agua.","El peso de un lingote de oro.","La temperatura de ebullición del alcohol.","La longitud de un cable de cobre.","La masa de un bloque plástico."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'C' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q2
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ((select exam_id from seed_ref), 2, 'Lógica y estimación',
          'En una habitación de 2,6 m de altura se construye una biblioteca de base 66 cm y altura (h). Luego se la levantará pivotando sobre uno de sus vértices inferiores para apoyarla contra la pared. ¿Cuál es el máximo valor posible de (h) para que no toque el techo?', null, '["1,94 m.","2,51 m.","2,60 m.","No puede determinarse.","Ninguna de las anteriores."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'B' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q3
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ((select exam_id from seed_ref), 3, 'Física: Térmica',
          'En la Tierra, cuando encendés una vela, la llama tiene esa forma alargada y puntiaguda que todos conocemos debido a que el aire caliente, al ser menos denso, sube, y el aire frío baja para ocupar su lugar (convección natural). Si un astronauta encendiera una vela dentro de la Estación Espacial Internacional (en microgravedad y con atmósfera de oxígeno), ¿qué forma tendría la llama y por qué?', null, '["La llama sería mucho más larga y delgada, buscando alcanzar el techo del módulo.","La llama sería esférica, debido a que la difusión de gases es uniforme en todas las direcciones.","La vela no podría encenderse, ya que el fuego requiere gravedad para existir.","La llama sería errática y cambiaría de forma constantemente por las corrientes de aire del ventilador.","La llama sería plana y se expandiría hacia los costados sobre la base de la vela."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'B' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q4
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ((select exam_id from seed_ref), 4, 'Energía y Tecnología',
          'En una resistencia eléctrica de 4 bandas, la cuarta banda (usualmente dorada o plateada) indica:', null, '["El valor principal en Ohmios.","El coeficiente de temperatura.","La tolerancia.","La potencia máxima.","Ninguna de las anteriores."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'C' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q5
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ((select exam_id from seed_ref), 5, 'Energía y Tecnología',
          '¿Qué proceso ocurre dentro del reactor de una central nuclear como Atucha II?', null, '["Combustión química.","Fisión nuclear.","Fusión nuclear.","Ionización gaseosa.","Sublimación."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'B' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q6
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ((select exam_id from seed_ref), 6, 'Física: Mecánica',
          'Indique cuál de las siguientes afirmaciones es incorrecta:', null, '["El peso de un cuerpo es la fuerza gravitatoria ejercida por la Tierra sobre él.","La fuerza normal aparece como consecuencia de la interacción entre superficies en contacto.","El peso de un cuerpo y la fuerza normal que actúa sobre él forman un par de acción y reacción.","Los pares de acción y reacción actúan sobre cuerpos distintos.","Si un cuerpo está apoyado sobre una mesa horizontal y en equilibrio, la fuerza normal puede tener igual módulo que el peso."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'C' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q7
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ((select exam_id from seed_ref), 7, 'Física: Térmica',
          'Sacás una botella de gaseosa de la heladera y la dejás un rato sobre la mesa… a los pocos minutos ves un “charco” de agua debajo de la botella. ¿De dónde salió ese líquido?', null, '["De una fuga en la botella.","De la heladera, donde la botella “absorbió” agua de otros alimentos.","Del aire ambiente.","De la mesa.","Ninguna de las anteriores es correcta."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'C' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q8
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ((select exam_id from seed_ref), 8, 'Física: Mecánica',
          'Indique cuál de las siguientes afirmaciones es incorrecta.', null, '["Las fuerzas internas de un sistema forman pares de acción y reacción, por lo que su resultante total es nula.","Las fuerzas internas forman pares de acción y reacción; por ello, el trabajo total realizado por dichas fuerzas sobre el sistema es siempre nulo.","El trabajo realizado por una fuerza conservativa sobre una trayectoria cerrada es cero.","El roce cinético transforma energía mecánica en otras formas de energía.","Los pares de acción y reacción nunca pueden actuar sobre un mismo cuerpo."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'B' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q9
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ((select exam_id from seed_ref), 9, 'Física: Fluidos',
          'En un tubo con forma de U (con sus extremos abiertos al aire) se encuentran dos líquidos inmiscibles entre sí en equilibrio hidrostático. En la rama izquierda se observa que la altura del líquido Azul, de densidad ρ<sub>A</sub>, es h<sub>A</sub>. En el resto del tubo se encuentra el líquido Rojo de densidad ρ<sub>R</sub>. La diferencia de altura entre sus superficies libres es Δh. Conociendo que ρ<sub>A</sub> es el 75% de ρ<sub>R</sub>, entonces Δh es:', 'figs/q9.jpg', '["125 % de h<sub>A</sub>.","Igual a h<sub>A</sub>.","75 % de h<sub>A</sub>.","25 % de h<sub>A</sub>.","Ninguna de las respuestas anteriores es correcta."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'D' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q10
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ((select exam_id from seed_ref), 10, 'Energía y Tecnología',
          'Respecto de la licuación del gas natural, indique la afirmación incorrecta:', null, '["Requiere temperaturas muy bajas.","Facilita almacenamiento y transporte.","Es obligatoria para transportarlo por gasoductos.","Se utiliza para transporte en buques metaneros.","Reduce considerablemente el volumen ocupado."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'C' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q11
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ((select exam_id from seed_ref), 11, 'Física: Fluidos',
          'Un bloque de aluminio de 8,1 kg se encuentra totalmente sumergido en agua y sostenido mediante una cuerda (ver figura). ¿Cuál es la tensión en la cuerda? Datos: ρ<sub>agua</sub> = 1000 kg/m³ ; ρ<sub>aluminio</sub> = 2700 kg/m³.', 'figs/q11.jpg', '["30 N","51 N","81 N","111 N","Ninguna de las anteriores."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'B' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q12
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ((select exam_id from seed_ref), 12, 'Química',
          'Los isótopos de un mismo elemento químico poseen:', null, '["Igual número atómico y distinto número de neutrones.","Distinto número atómico e igual número másico.","Distinta cantidad de protones.","Distinta cantidad de electrones.","Igual número másico y distinto número atómico."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'A' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q13
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ((select exam_id from seed_ref), 13, 'Química',
          '¿Qué compuestos liberados a la atmósfera son los principales causantes de la lluvia ácida?', null, '["Oxígeno y nitrógeno.","Vapor de agua.","Metano y dióxido de carbono.","Óxidos de azufre y nitrógeno.","Helio y argón."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'D' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q14
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ((select exam_id from seed_ref), 14, 'Física: Electricidad',
          'En el siguiente circuito (ideal) de corriente continua todas las lámparas son iguales entre sí y están en perfecto estado. Para este circuito en particular:', 'figs/q14.jpg', '["La corriente que circula por la lámpara 4 es el doble de la que circula por la lámpara 7.","La corriente que circula por la lámpara 5 es la mitad de la que circula por la lámpara 7.","Ninguna de las lámparas está encendida.","La intensidad luminosa en la lámpara 4 es igual a la de la lámpara 6.","Ninguna de las anteriores respuestas es correcta."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'C' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q15
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ((select exam_id from seed_ref), 15, 'Física: Térmica',
          'Se dispone de 1 kg de agua a 100 ºC y cierta masa de hielo a 0 ºC dentro de un calorímetro ideal (C<sub>agua</sub> = 4.186 J/kg·ºC ; L<sub>fusión</sub> = 334.000 J/kg). El sistema evoluciona térmicamente hasta una temperatura final de equilibrio de 20 ºC. Entonces la masa inicial de hielo era:', null, '["0,56 kg.","0,80 kg.","0,96 kg.","1,24 kg.","1,28 kg."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'B' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q16
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ((select exam_id from seed_ref), 16, 'Química',
          'La función principal de un catalizador en una reacción química es:', null, '["Aportar energía térmica adicional al sistema.","Consumirse durante la reacción.","Aumentar la energía de activación.","Ofrecer un camino alternativo con una barrera energética menor.","Hacer que una reacción imposible ocurra espontáneamente."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'D' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q17
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ((select exam_id from seed_ref), 17, 'Biología',
          'En una célula vegetal, hay un “tanque de agua y reserva” tan inmenso que puede llegar a ocupar hasta el 90% de todo el espacio interno, empujando al núcleo y a las demás organelas contra los bordes. ¿Qué estructura es la encargada de este almacenamiento masivo que domina el interior vegetal?', null, '["Núcleo.","Vacuola.","Lisosoma.","Mitocondria.","Ribosoma."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'B' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q18
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ((select exam_id from seed_ref), 18, 'Física: Fluidos',
          'Con referencia al principio de Bernoulli para fluidos ideales, indique cuál de las siguientes afirmaciones es incorrecta:', null, '["No interviene en su expresión matemática la viscosidad del fluido.","El término ½·ρ·v² tiene unidades de Joule.","El término ρ·g·h tiene en cuenta la energía potencial gravitatoria del fluido por unidad de volumen.","Las condiciones para aplicar el principio requieren que el fluido sea no viscoso, estacionario e incompresible.","Se puede aplicar también a gases, mientras estos verifiquen las condiciones exigidas para utilizar Bernoulli."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'B' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q19
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ((select exam_id from seed_ref), 19, 'Energía y Tecnología',
          'La energía mareomotriz aprovecha:', null, '["El oleaje superficial.","Las corrientes oceánicas profundas.","Las mareas.","El calor del océano.","La evaporación del agua."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'C' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q20
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ((select exam_id from seed_ref), 20, 'Órdenes de magnitud',
          'Si un átomo tuviera el tamaño del estadio de River Plate, su núcleo sería aproximadamente del tamaño de:', null, '["Una pelota de fútbol.","Un automóvil.","Un garbanzo o canica.","Un grano microscópico invisible.","Una célula."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'C' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q21
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ((select exam_id from seed_ref), 21, 'Física: Térmica',
          'Se coloca dentro de un calorímetro ideal un kilogramo de cierta sustancia líquida a temperatura T<sub>A</sub> y otro kilogramo de la misma sustancia (también líquida) a T<sub>B</sub>. Considerando que T<sub>A</sub> es mayor que T<sub>B</sub>, entonces:', null, '["La temperatura T<sub>A</sub> disminuirá hasta alcanzar la temperatura T<sub>B</sub>.","La temperatura T<sub>B</sub> aumentará hasta alcanzar la temperatura T<sub>A</sub>.","La temperatura final de equilibrio dependerá del valor del calor específico de la sustancia.","La temperatura final de equilibrio será el promedio entre T<sub>A</sub> y T<sub>B</sub>.","Ninguna de las respuestas anteriores es correcta."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'D' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q22
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ((select exam_id from seed_ref), 22, 'Química',
          'El aire atmosférico se clasifica principalmente como:', null, '["Sustancia pura.","Mezcla homogénea.","Mezcla heterogénea.","Compuesto químico.","Gas noble."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'B' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q23
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ((select exam_id from seed_ref), 23, 'Energía y Tecnología',
          '¿Cuál de las siguientes centrales se encuentra en la provincia de Buenos Aires?', null, '["Yacyretá.","Atucha II.","Embalse.","Costanera.","Ninguna de las anteriores."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'B' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q24
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ((select exam_id from seed_ref), 24, 'Física: Térmica',
          'Durante un cambio de fase de una sustancia pura a presión constante, desde un estado sólido a un estado líquido, su temperatura:', null, '["Aumenta.","Disminuye.","Permanece constante.","Depende de la masa.","Aumenta linealmente."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'C' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q25
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ((select exam_id from seed_ref), 25, 'Química',
          'Cuando un átomo neutro pierde electrones:', null, '["Se convierte en anión.","Se convierte en catión.","Se transforma en neutrón.","Aumenta su número atómico.","Se vuelve inestable nuclearmente."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'B' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q26
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ((select exam_id from seed_ref), 26, 'Química',
          'Los gases nobles presentan muy baja reactividad porque:', null, '["No poseen electrones.","Tienen la capa externa completa.","Son radiactivos.","Solo existen artificialmente.","Son metales."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'B' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q27
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ((select exam_id from seed_ref), 27, 'Física: Fluidos',
          'Se ha diseñado un experimento para medir la densidad de un cubo homogéneo de madera. Se lo introduce en un recipiente que contiene aceite en su parte superior y agua en la inferior. El cubo queda en equilibrio hidrostático tal como se indica en la figura. Entonces, la densidad del cubo será:', 'figs/q27.jpg', '["Igual a la suma de la densidad del aceite más la del agua.","Igual al promedio de la densidad del aceite más la del agua.","Igual a un tercio de la suma de la densidad del aceite más la del agua.","No puede determinarse con los datos del enunciado.","Ninguna de las anteriores."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'C' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q28
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ((select exam_id from seed_ref), 28, 'Física: Electricidad',
          'Tres resistencias de 30 Ω se encuentran conectadas como muestra el siguiente esquema. La resistencia equivalente es:', 'figs/q28.jpg', '["10 Ω","15 Ω","45 Ω","60 Ω","90 Ω"]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'A' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q29
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ((select exam_id from seed_ref), 29, 'Física: Térmica',
          'Cuando un aromatizante sólido desaparece sin pasar por estado líquido ocurre:', null, '["Evaporación.","Condensación.","Fusión.","Sublimación.","Solidificación."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'D' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q30
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ((select exam_id from seed_ref), 30, 'Física: Cinemática',
          'Teniendo en cuenta los siguientes gráficos, indique cuál de las siguientes respuestas es la incorrecta:', 'figs/q30.jpg', '["En las figuras 1 y 2 se representa la evolución temporal de las componentes x e y de la velocidad en un tiro oblicuo.","En las figuras 3 y 4 se representa la evolución temporal de las componentes x e y de la velocidad en un tiro oblicuo.","En la figura 5 se representa un MRU, donde el móvil partió desde la izquierda del origen de coordenadas.","En la figura 6 se representa un MRUV, donde el móvil se mueve en sentido negativo del eje “x”.","En la figura 7 se representa una gráfica posición-tiempo parabólica correspondiente a un movimiento de caída libre."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'B' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q31
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ((select exam_id from seed_ref), 31, 'Biología',
          'Tomamos dos células: una de la madera de un tronco y otra de un músculo humano. Las colocamos en un ambiente donde ambas absorben una gran cantidad de agua. La célula humana se hincha como un globo y corre riesgo de estallar. La célula del árbol se mantiene firme y conserva su forma. ¿Qué estructura posee la célula del árbol que evita que se deforme o estalle?', null, '["Membrana plasmática.","Citoesqueleto.","Pared celular.","Núcleo celular.","Ninguna de las anteriores es correcta."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'C' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q32
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ((select exam_id from seed_ref), 32, 'Energía y Tecnología',
          '¿Qué material es más adecuado para cables de alta tensión?', null, '["Cerámica.","Polímero.","Argón.","Hierro.","Cobre."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'E' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q33
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ((select exam_id from seed_ref), 33, 'Física: Mecánica',
          'Una partícula se mueve en una montaña rusa ideal sin rozamiento. ¿Cuál afirmación es incorrecta?', null, '["En el punto más bajo de la montaña rusa la energía cinética es máxima.","La energía mecánica permanece constante.","La velocidad máxima ocurre en el punto más alto.","La energía potencial depende de la altura.","La energía mecánica es igual en todos los puntos."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'C' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q34
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ((select exam_id from seed_ref), 34, 'Química',
          '¿Cuál de los siguientes fenómenos corresponde a una transformación química?', null, '["Evaporación del agua.","Doblar una chapa.","Oxidación del hierro.","Romper una tiza.","Fundir cera."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'C' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q35
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ((select exam_id from seed_ref), 35, 'Física: Mecánica',
          'Colocamos un dron dentro de una caja de acrílico herméticamente cerrada y la apoyamos sobre una balanza de alta precisión. Con el dron apagado en el fondo, la balanza marca exactamente 1000 g. Si encendemos el dron y logramos que se mantenga en vuelo estacionario (quieto en el aire) sin tocar ninguna pared, ¿qué marcará la balanza?', null, '["La balanza marca menos de 1000 g.","La balanza marca exactamente lo mismo.","La balanza marca más de 1000 g.","La balanza marca cero.","La medición fluctúa indefinidamente."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'B' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q36
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ((select exam_id from seed_ref), 36, 'Física: Térmica',
          '¿Cuál de las siguientes afirmaciones sobre transferencia de calor es incorrecta?', null, '["En fluidos predomina la convección.","El calor fluye del cuerpo con mayor calor hacia el de menor calor.","El calor latente se mide en J/kg.","Entre la Tierra y el espacio no hay conducción.","El calor de una fogata se siente principalmente por radiación."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'B' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q37
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ((select exam_id from seed_ref), 37, 'Energía y Tecnología',
          '¿Cuál de las siguientes es una propiedad mecánica?', null, '["Conductividad eléctrica.","Punto de fusión.","Resistencia a la corrosión.","Dureza.","Índice de refracción."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'D' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q38
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ((select exam_id from seed_ref), 38, 'Física: Cinemática',
          'Se deja caer una piedra desde cierta altura y simultáneamente otra se lanza verticalmente hacia arriba desde el suelo. ¿Cuál afirmación es correcta?', null, '["Al cruzarse tienen igual velocidad.","Se cruzan cuando la segunda alcanza su altura máxima.","En la altura máxima la aceleración es nula.","La piedra arrojada desde el piso tarda el mismo tiempo en llegar a su altura máxima de lo que tarda la que se dejó caer en llegar al piso.","Ninguna de las anteriores es correcta."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'E' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q39
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ((select exam_id from seed_ref), 39, 'Lógica y estimación',
          'La potencia de un tractor depende de la rapidez según: P = c·v<sup>3,2</sup>. Si la potencia se triplica, la nueva rapidez máxima resultará aproximadamente:', null, '["0,29 veces la original.","1,41 veces la original.","2,41 veces la original.","3 veces la original.","3,2 veces la original."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'B' from q
on conflict (question_id) do update set correct=excluded.correct;

-- Q40
with q as (
  insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
  values ((select exam_id from seed_ref), 40, 'Física: Cinemática',
          'En un tiro vertical hacia arriba, al llegar a la altura máxima:', null, '["Velocidad y aceleración son nulas.","La aceleración desaparece.","La velocidad es nula y la aceleración no.","La energía cinética es máxima.","La gravedad deja de actuar."]'::jsonb)
  on conflict (exam_id, number) do update set topic=excluded.topic, prompt=excluded.prompt,
          figure_url=excluded.figure_url, options=excluded.options
  returning id
)
insert into public.answer_keys (question_id, correct)
select id, 'C' from q
on conflict (question_id) do update set correct=excluded.correct;


-- ================ db/04_app_patch.sql ================
-- =====================================================================
-- 04_app_patch.sql  ·  Ajustes que usa la app Next.js
-- Ejecutar DESPUES de 01, 02 y 03.
-- =====================================================================

-- Guardar el desglose por tema en el intento (para mostrarlo en el resultado
-- sin que el alumno tenga que leer la clave).
alter table public.attempts add column if not exists per_topic jsonb;

-- grade_attempt v2: persiste score, total, per_topic y submitted_at.
create or replace function public.grade_attempt(p_attempt uuid)
returns table (score int, total int, per_topic jsonb)
language plpgsql security definer
set search_path = public
as $$
declare v_user text; v_score int; v_total int; v_pt jsonb;
begin
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

  select jsonb_object_agg(t.topic, jsonb_build_object('ok', t.ok, 'tot', t.tot))
    into v_pt
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

  update public.attempts
    set score = v_score, total = v_total, per_topic = v_pt,
        submitted_at = coalesce(submitted_at, now())
  where id = p_attempt;

  return query select v_score, v_total, v_pt;
end;
$$;

-- Estadistica por pregunta (panel docente). Solo docente.
create or replace function public.exam_question_stats(p_exam uuid)
returns table (number int, topic text, ok bigint, tot bigint, pct numeric, correct char)
language sql security definer
set search_path = public
as $$
  select q.number, q.topic,
         count(*) filter (where r.choice = k.correct) as ok,
         count(r.choice) as tot,
         round(100.0 * count(*) filter (where r.choice = k.correct)
               / nullif(count(r.choice), 0)) as pct,
         k.correct
  from public.questions q
  join public.answer_keys k on k.question_id = q.id
  left join public.responses r on r.question_id = q.id
  left join public.attempts a on a.id = r.attempt_id and a.submitted_at is not null
  where q.exam_id = p_exam and public.is_teacher()
  group by q.number, q.topic, k.correct
  order by pct nulls last, q.number;
$$;

-- Estadistica por tema (panel docente). Solo docente.
create or replace function public.exam_topic_stats(p_exam uuid)
returns table (topic text, ok bigint, tot bigint, pct numeric)
language sql security definer
set search_path = public
as $$
  select q.topic,
         count(*) filter (where r.choice = k.correct) as ok,
         count(r.choice) as tot,
         round(100.0 * count(*) filter (where r.choice = k.correct)
               / nullif(count(r.choice), 0)) as pct
  from public.questions q
  join public.answer_keys k on k.question_id = q.id
  left join public.responses r on r.question_id = q.id
  left join public.attempts a on a.id = r.attempt_id and a.submitted_at is not null
  where q.exam_id = p_exam and public.is_teacher()
  group by q.topic
  order by pct nulls last;
$$;

grant execute on function public.grade_attempt(uuid)      to authenticated;
grant execute on function public.exam_question_stats(uuid) to authenticated;
grant execute on function public.exam_topic_stats(uuid)    to authenticated;

-- ================ db/05_authoring_and_review.sql ================
-- =====================================================================
-- 05_authoring_and_review.sql
-- (1) create_exam(jsonb): alta de simulacros desde la app, solo docente,
--     en una sola transaccion (examen + preguntas + clave).
-- (2) get_attempt_review(uuid): revision para el alumno, que SOLO expone
--     la respuesta correcta si el examen tiene student_review = true y el
--     intento ya fue entregado.
-- Ejecutar despues de 01–04.
-- =====================================================================

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
    insert into public.questions (exam_id, number, topic, prompt, figure_url, options)
    values (v_exam,
            coalesce((q->>'number')::int, i),
            nullif(q->>'topic',''),
            q->>'prompt',
            nullif(q->>'figure_url',''),
            coalesce(q->'options', '[]'::jsonb))
    returning id into v_q;

    insert into public.answer_keys (question_id, correct)
    values (v_q, upper(q->>'correct'));
  end loop;

  return v_exam;
end;
$$;

grant execute on function public.create_exam(jsonb) to authenticated;


create or replace function public.get_attempt_review(p_attempt uuid)
returns table (
  number int, topic text, prompt text,
  your_choice char, correct char, is_correct boolean
)
language plpgsql security definer
set search_path = public
as $$
declare
  v_user      text;
  v_review    boolean;
  v_submitted timestamptz;
  v_exam      uuid;
begin
  select a.user_id, e.student_review, a.submitted_at, a.exam_id
    into v_user, v_review, v_submitted, v_exam
  from public.attempts a
  join public.exams e on e.id = a.exam_id
  where a.id = p_attempt;

  if v_user is null then raise exception 'intento inexistente'; end if;
  if v_user <> (auth.jwt()->>'sub') and not public.is_teacher() then
    raise exception 'no autorizado';
  end if;
  if v_submitted is null then raise exception 'intento no entregado'; end if;
  -- El alumno solo ve la clave si el docente habilito la revision.
  if not v_review and not public.is_teacher() then
    raise exception 'revision no habilitada';
  end if;

  return query
    select q.number, q.topic, q.prompt,
           r.choice as your_choice, k.correct,
           (r.choice = k.correct) as is_correct
    from public.questions q
    join public.answer_keys k on k.question_id = q.id
    left join public.responses r
           on r.question_id = q.id and r.attempt_id = p_attempt
    where q.exam_id = v_exam
    order by q.number;
end;
$$;

grant execute on function public.get_attempt_review(uuid) to authenticated;

-- ================ db/06_autosave.sql ================
-- =====================================================================
-- 06_autosave.sql  ·  Auto-guardado de respuestas durante el intento
-- Hasta ahora 'responses' solo tenía INSERT, así que las respuestas se
-- guardaban únicamente al entregar. Esta política permite ACTUALIZAR una
-- respuesta mientras el intento sigue abierto (no entregado), habilitando
-- el guardado incremental a medida que el alumno responde.
-- Ejecutar después de 01–05.
-- =====================================================================

create policy "responses: actualizar en intento abierto"
  on public.responses for update to authenticated
  using (
    exists (select 1 from public.attempts a
            where a.id = attempt_id
              and a.user_id = public.clerk_uid()
              and a.submitted_at is null)
  )
  with check (
    exists (select 1 from public.attempts a
            where a.id = attempt_id
              and a.user_id = public.clerk_uid()
              and a.submitted_at is null)
  );

-- ================ db/07_explanations.sql ================
-- =====================================================================
-- 07_explanations.sql  ·  Explicación/justificación por pregunta
-- Agrega questions.explanation (opcional) y la propaga por las funciones
-- de alta (create_exam) y de revisión (get_attempt_review), para que el
-- alumno la vea al revisar (si el docente habilitó la revisión).
-- Ejecutar después de 01–06.
-- =====================================================================

alter table public.questions add column if not exists explanation text;

-- create_exam: ahora también guarda la explicación de cada pregunta.
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

-- get_attempt_review: ahora también devuelve la explicación de cada pregunta.
-- (DROP necesario: cambia el tipo de retorno, no se puede solo CREATE OR REPLACE.)
drop function if exists public.get_attempt_review(uuid);
create or replace function public.get_attempt_review(p_attempt uuid)
returns table (
  number int, topic text, prompt text,
  your_choice char, correct char, is_correct boolean, explanation text
)
language plpgsql security definer
set search_path = public
as $$
declare
  v_user      text;
  v_review    boolean;
  v_submitted timestamptz;
  v_exam      uuid;
begin
  select a.user_id, e.student_review, a.submitted_at, a.exam_id
    into v_user, v_review, v_submitted, v_exam
  from public.attempts a
  join public.exams e on e.id = a.exam_id
  where a.id = p_attempt;

  if v_user is null then raise exception 'intento inexistente'; end if;
  if v_user <> (auth.jwt()->>'sub') and not public.is_teacher() then
    raise exception 'no autorizado';
  end if;
  if v_submitted is null then raise exception 'intento no entregado'; end if;
  -- El alumno solo ve la clave si el docente habilito la revision.
  if not v_review and not public.is_teacher() then
    raise exception 'revision no habilitada';
  end if;

  return query
    select q.number, q.topic, q.prompt,
           r.choice as your_choice, k.correct,
           (r.choice = k.correct) as is_correct, q.explanation
    from public.questions q
    join public.answer_keys k on k.question_id = q.id
    left join public.responses r
           on r.question_id = q.id and r.attempt_id = p_attempt
    where q.exam_id = v_exam
    order by q.number;
end;
$$;

grant execute on function public.get_attempt_review(uuid) to authenticated;

-- ================ db/08_exam_management.sql ================
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

-- ================ db/09_assignments.sql ================
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


-- =====================================================================
-- 10_onboarding.sql
-- =====================================================================

alter table public.profiles
  add column if not exists onboarded boolean not null default false;

update public.profiles set onboarded = true;

drop policy if exists "profiles: editar el propio" on public.profiles;
create policy "profiles: editar el propio"
  on public.profiles for update to authenticated
  using ( id = public.clerk_uid() )
  with check ( id = public.clerk_uid() and (role = 'student' or public.is_teacher()) );

-- =====================================================================
-- 11_waitlist.sql
-- =====================================================================

create table if not exists public.waitlist (
  id          uuid primary key default gen_random_uuid(),
  full_name   text not null,
  email       text not null unique,
  use_case    text,
  pain        text,
  created_at  timestamptz not null default now()
);

alter table public.waitlist enable row level security;


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
