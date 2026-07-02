# Ambientes y CI/CD — Rendi

Cómo desarrollar, testear y deployar **sin tocar a los usuarios en producción**.
Regla de oro: **los usuarios viven en `main` → Supabase-PROD. Nunca se desarrolla
contra la base de los usuarios.**

## Modelo de ambientes

| Ambiente | App | Supabase | Clerk | Quién |
|---|---|---|---|---|
| **Local dev** | `localhost:3000` | `rendi-dev` | Clerk (dev) | vos construyendo |
| **Preview** (Vercel) | URL por rama | `rendi-dev` | Clerk (dev) | QA de cada PR |
| **Producción** (Vercel `main`) | dominio real | `rendi-prod` (datos reales) | Clerk (Production) | usuarios reales |

`rendi-prod` = el proyecto Supabase que se usa hoy (tiene las cuentas y datos reales).
`rendi-dev` = proyecto nuevo, con schema + seed y datos falsos.

---

## Fase 1 — Partir la base de datos (hacer ahora)

Desbloquea construir el feature sin riesgo. Pasos:

1. En Supabase, crear un **segundo proyecto**: `rendi-dev` (el free tier permite 2).
2. Correr `db/all_in_one.sql` en el SQL editor de `rendi-dev` (schema + seed).
3. Repuntar `.env.local` a `rendi-dev` (URL + anon/publishable + service-role de DEV).
4. Congelar `rendi-prod`: **no** correrle más migraciones sueltas; solo en un release.

Verificación: `npm run dev` y confirmar que la app levanta contra `rendi-dev`
(el examen semilla aparece, podés romper/migrar sin miedo).

## Fase 2 — Deploy con ambientes (al lanzar)

1. Linkear el repo a Vercel (`vercel link`).
2. Cargar env vars por **scope** en Vercel:
   - **Production**: keys de `rendi-prod` + Clerk **Production** + `TEACHER_INVITE_CODE` + `CRON_SECRET`.
   - **Preview**: keys de `rendi-dev` + Clerk dev.
3. Crear la instancia **Clerk Production** (requiere dominio) para los usuarios reales.
4. `main` → deploy a Producción; cada rama → Preview automático.

Caveat: el cron de `vercel.json` (`*/5 * * * *`) requiere plan **Pro**; en Hobby corre
1×/día (es solo red de seguridad; el cliente ya auto-entrega). Ver notas de deploy.

## Fase 3 — Disciplina de migraciones (flujo permanente)

Toda migración de DB sigue este camino, nunca directo a prod:

1. Escribir `db/NN_*.sql` (numerado, incremental).
2. Aplicar en **`rendi-dev`** y testear (local + preview).
3. PR → CI verde → merge a `main`.
4. **Backup de `rendi-prod`** (Supabase → Database → Backups).
5. Aplicar la **misma** `db/NN_*.sql` en `rendi-prod` como paso deliberado del release.

Nunca un `drop`/`alter` improvisado en prod. Nunca desarrollar apuntando a `rendi-prod`.

---

## CI/CD — verificar flujos

### CD (deploy): lo maneja Vercel de forma nativa
- Push a una rama → **Preview deploy** (URL propia, contra `rendi-dev`).
- Merge a `main` → **Production deploy** (contra `rendi-prod`).
- Configurar en Vercel: **"solo deployar Production si los checks de GitHub pasan"**
  (Settings → Git → require CI). Así un PR rojo no llega a los usuarios.

### CI capa 1 — estática (activa: `.github/workflows/ci.yml`)
Corre en cada PR y push a `main`, tres jobs en paralelo:
- **Typecheck** (`tsc --noEmit`) — errores de tipos.
- **Lint** (`eslint .`) — reglas de Next + TypeScript (los `any` quedan como warning).
- **Build** (`next build`) — verifica que compile. Usa env placeholder (el build no
  toca el backend: todas las rutas son dinámicas); la config real vive en Vercel.

### CI capa 2 — flujos E2E (agregar después de la Fase 1)
Verifica los **caminos reales** de usuario, no solo tipos. Stack recomendado:
- **Playwright** + **`@clerk/testing`** (login programático con usuarios de test;
  los emails `+clerk_test` usan el código `424242` en Clerk dev).
- Corre contra un `next build && next start` en CI, apuntando a `rendi-dev`
  (keys vía GitHub Secrets), o contra la Preview URL del PR.

Flujos mínimos a cubrir (los críticos del producto):
1. **Sign-up → onboarding** (alumno y docente con invite code).
2. **Docente asigna** un examen a un alumno / a una comisión.
3. **Alumno ve solo lo asignado**, rinde, auto-guarda y entrega.
4. **Revisión**: el alumno ve nota + explicaciones cuando `student_review` está on.
5. (Al construir el corrector) **entrega de desarrollo → borrador de IA → aprueba docente**.

**Estado:** los E2E existen (`e2e/*.spec.ts`, `npm run e2e`) y cubren público
(landing/waitlist), auth de alumno, y el flujo core docente→asignar→alumno rinde. En
local corren contra el dev server que ya está levantado (Playwright no arranca otro).

### Activar el job de E2E en el CI
El job `e2e` de `.github/workflows/ci.yml` corre **solo si** la repo variable
`RUN_E2E == 'true'`. Pasos para prenderlo (una vez):

1. GitHub → repo → **Settings → Secrets and variables → Actions → Secrets** → agregar
   (apuntando a **rendi-dev**):
   - `DEV_SUPABASE_URL`, `DEV_SUPABASE_ANON_KEY`, `DEV_SUPABASE_SERVICE_ROLE`
   - `DEV_CLERK_PK` (publishable), `DEV_CLERK_SK` (secret)
   - `DEV_TEACHER_INVITE_CODE` (`oatec-docente-2026`), `DEV_CRON_SECRET`
2. En la pestaña **Variables** (al lado de Secrets) → agregar `RUN_E2E` = `true`.
3. Listo: el CI construye la app, la arranca (`npm run start` como webServer) y corre
   Playwright en cada PR. Sube el `playwright-report/` como artifact.

Ojo: el CI corre contra la **misma** `rendi-dev` compartida con el dev local; los tests
limpian su propio estado (`resetStudentState`), pero evitá correr E2E local y en CI a la
vez sobre datos que te importen.

---

## Reglas de oro (TL;DR)

1. Los usuarios viven en `main` → `rendi-prod`. No se desarrolla contra esa base.
2. Toda migración: DEV → preview → PR/CI verde → backup prod → aplicar en prod.
3. Un PR rojo no deploya a Producción.
4. Secrets de prod solo en el scope Production de Vercel; nunca en el repo.
