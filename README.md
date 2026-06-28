# Rendi — MVP (Next.js + Supabase + Clerk)

Plataforma de simulacros para la competencia OATec con corrección del lado del
servidor (la clave de respuestas nunca llega al navegador), persistencia por
alumno y panel docente con estadísticas.

## Stack
- **Next.js** (App Router) — front + BFF
- **Supabase** (Postgres + RLS) — datos
- **Clerk** — autenticación (integración nativa Third-Party Auth con Supabase)

## Puesta en marcha

### 1. Base de datos (Supabase)
Creá un proyecto en Supabase y, en el SQL Editor, ejecutá en orden:
```
db/01_schema.sql
db/02_rls.sql
db/03_seed.sql        # 40 preguntas del Modelo 2026, examen ya publicado
db/04_app_patch.sql   # columna per_topic + funciones de estadística
```
Creá un bucket **público** `figs` en Storage y subí las 6 figuras
(`q9.jpg … q30.jpg`, vienen aparte).

### 2. Clerk ↔ Supabase (integración nativa)
1. Creá una app en Clerk.
2. En Clerk: *Connect with Supabase* → copiá el **Clerk domain**.
3. En Supabase: Authentication → Sign In/Providers → **Third-Party Auth** →
   agregá **Clerk** y pegá el domain.
   (No uses "JWT templates": quedaron deprecadas en abril 2025.)

### 3. Variables de entorno
Copiá `.env.local.example` a `.env.local` y completá las 5 claves
(Supabase URL + anon + service_role; Clerk publishable + secret).

### 4. Correr
```bash
npm install
npm run dev
```
Entrá, registrate, y hacete **docente**: en Supabase ejecutá
```sql
update profiles set role = 'teacher' where id = '<tu_clerk_user_id>';
```
(tu id aparece en la tabla `profiles` luego del primer login). Con eso ves
`/teacher`.

## Cómo agregar un simulacro nuevo
Insertá filas en `exams`, `questions` y `answer_keys` (la respuesta correcta va
SOLO en `answer_keys`). El front no cambia. Próximo paso sugerido: un panel para
cargarlos sin SQL.

## Mapa del proyecto
```
app/
  exams/                 listado de simulacros (alumno)
  exam/[id]/             intro + examen (ExamClient)
  result/[attemptId]/    resultado del alumno
  teacher/               panel docente (role-gated)
  api/attempts/          crear intento / entregar + corregir
components/               ExamClient, TeacherDashboard
lib/                      supabaseServer (token Clerk), admin, profile, types
db/                       SQL (esquema, RLS, seed, patch)
```

## Seguridad (lo importante)
- La **clave de respuestas** está en `answer_keys`, ilegible para alumnos por RLS.
  La corrección la hace `grade_attempt()` (SECURITY DEFINER) y solo devuelve
  puntaje + desglose por tema.
- **Reloj autoritativo**: el `started_at` lo fija el servidor; la entrega valida
  el tiempo transcurrido.
- **RLS**: cada alumno ve solo lo suyo; el docente ve todo.

## Novedades (v2)
- **Cargar simulacros sin SQL**: `/teacher/new` (botón “＋ Nuevo simulacro” en el
  panel). Formulario con metadatos + preguntas, subida de figuras al bucket
  `figs`, e importación rápida pegando un JSON de preguntas. Se guarda en una
  sola transacción con la función `create_exam()` (solo docente).
- **Revisión para el alumno**: si activás *Mostrar revisión* en el simulacro, al
  terminar el alumno ve su respuesta vs. la correcta. La clave la entrega la
  función `get_attempt_review()`, que solo la revela si la revisión está
  habilitada y el intento ya fue entregado (nunca antes).
- Requiere ejecutar `db/05_authoring_and_review.sql` (después de 01–04) y, para
  la subida de figuras, tener cargada `SUPABASE_SERVICE_ROLE_KEY` en `.env.local`.
