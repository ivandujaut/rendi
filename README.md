# Rendi — simulacros y evaluación (Next.js + Supabase + Clerk)

Plataforma para que docentes tomen simulacros y exámenes, con **corrección del lado
del servidor** (la clave de respuestas nunca llega al navegador), **feedback inmediato**
para el alumno, y un panel docente con estadísticas. Nació para la competencia **OATec**
y creció a una herramienta de evaluación para cursos.

## Stack
- **Next.js 15** (App Router) — front + BFF
- **Supabase** (Postgres + RLS) — datos
- **Clerk** — autenticación (Third-Party Auth nativo con Supabase)
- **Tailwind v4** (CSS-first) + design system propio en `components/ui/` + Hugeicons

## Puesta en marcha

### 1. Base de datos (Supabase)
Creá un proyecto y en el **SQL Editor** ejecutá `db/all_in_one.sql` (concatena todas
las migraciones `01`–`12`: schema, RLS, seed de 40 preguntas, autoría, autosave,
explicaciones, gestión, **asignaciones**, onboarding, waitlist y navegación de examen).
Creá un bucket **público** `figs` en Storage y subí las figuras (`q9.jpg … q30.jpg`).

### 2. Clerk ↔ Supabase
1. Creá una app en Clerk.
2. En Clerk: *Connect with Supabase* → copiá el **Clerk domain**.
3. En Supabase: Authentication → Providers → **Third-Party Auth** → Clerk → pegá el
   domain. (No uses JWT templates: deprecadas en abril 2025.)

### 3. Variables de entorno
Copiá `.env.local.example` a `.env.local` y completá:
- Supabase: URL + anon/publishable + **service_role**.
- Clerk: publishable + secret (+ las URLs de sign-in/up/redirect ya vienen por default).
- `TEACHER_INVITE_CODE` — el código que un usuario ingresa en el onboarding para
  registrarse como **docente** (sin esto, nadie puede darse de alta como docente).
- `CRON_SECRET` — lo usa el cron `/api/cron/close-expired` (cierra intentos vencidos).

### 4. Correr
```bash
npm install
npm run dev
```
Registrate en `/sign-up` → el onboarding te pide rol. Elegí **docente** e ingresá el
`TEACHER_INVITE_CODE` para acceder a `/teacher`. (El rol se escribe server-side; la RLS
impide que un alumno se auto-promueva.)

## Cómo funciona (resumen)
- **Visibilidad por asignación**: un alumno ve un examen **solo si el docente se lo
  asignó** (`exam_assignments`). Cada asignación habilita intentos; el docente puede
  asignar por alumno o **por comisión** entera (`/teacher/assign/[id]`).
- **Rendir**: autosave durante el examen; entrega con reloj autoritativo del servidor.
  Exámenes lineales opcionales (`allow_back = false`).
- **Corrección**: la hace el servidor; la clave (`answer_keys`) nunca sale al cliente.
  Con *Mostrar revisión* activo, el alumno ve su respuesta vs. la correcta + explicación.
- **Panel docente**: crear/editar/publicar/borrar exámenes (sin SQL), asignar alumnos,
  y ver estadísticas por alumno / dificultad / tema.
- **Público**: landing en `/` con waitlist para visitantes no logueados.

## Mapa del proyecto
```
app/
  page.tsx               landing (signed-out) / redirect a /exams (signed-in)
  exams/                 listado de simulacros asignados (alumno)
  exam/[id]/             intro + examen (ExamClient, autosave)
  result/[attemptId]/    resultado + revisión
  onboarding/            wizard de rol (alumno / docente con invite code)
  teacher/               panel docente (role-gated): new, edit, assign
  api/                   attempts, exams/[id]/assignments, onboarding,
                         waitlist, cron/close-expired, upload-figure
components/              ExamClient, AssignmentManager, ExamManager, ui/ (primitivas)
lib/                     supabaseServer (token Clerk), profile, types
db/                      migraciones SQL 01–12 + all_in_one.sql
docs/                    ambientes-y-cicd.md (workflow), PLAN.md (roadmap)
```

## Seguridad (lo importante)
- La **clave de respuestas** vive en `answer_keys`, ilegible para alumnos por RLS. La
  corrección corre server-side y solo devuelve puntaje + desglose.
- **RLS**: cada alumno ve solo lo suyo y solo lo asignado; el docente ve todo. Un alumno
  no puede auto-promoverse a docente (política endurecida en `db/10`).
- **Reloj autoritativo**: `started_at` lo fija el servidor; la entrega valida el tiempo.
- El `service_role` se usa **solo** en el servidor (nunca `NEXT_PUBLIC_*`).

## Desarrollo y deploy
- **Ambientes + CI/CD**: ver [`docs/ambientes-y-cicd.md`](docs/ambientes-y-cicd.md).
  Regla de oro: los usuarios viven en `main` → Supabase de producción; nunca se
  desarrolla contra esa base. Dev usa un Supabase `rendi-dev` aparte.
- **CI**: `.github/workflows/ci.yml` corre `tsc --noEmit` (y build/lint) en cada PR.
- **Roadmap**: ver [`docs/PLAN.md`](docs/PLAN.md).

## Scripts
```bash
npm run dev     # desarrollo
npm run build   # build de producción
npm run start   # servir el build
npm run lint    # ESLint
```
