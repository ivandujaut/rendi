# Ambientes y CI/CD — Rendi

Cómo desarrollar, testear y deployar **sin tocar a los usuarios en producción**.
Regla de oro: **producción solo cambia con un release deliberado a la rama
`production`. Un merge a `main` NO llega a los usuarios** — `main` es staging.

## Modelo de ambientes

| Ambiente | App | Supabase | Clerk | Rama |
|---|---|---|---|---|
| **Local dev** | `localhost:3000` | `rendi-dev` | Clerk (dev) | ramas de feature |
| **Staging** (Preview de Vercel) | URL por deploy (tras login de Vercel) | `rendi-dev` | Clerk (dev) | **`main`** + cada PR |
| **Producción** | `getparcialito.com` | `rendi-prod` (datos reales) | Clerk (Production) | **`production`** |

`rendi-prod` = el proyecto Supabase con las cuentas y datos reales.
`rendi-dev` = proyecto de dev, con schema + seed y datos falsos.

**Por qué la rama `production` separada:** el auto-deploy de Vercel es merge→deploy
al instante. Si `main` fuera producción (como era antes), cada merge tocaría a los
usuarios — y si el código depende de una migración que todavía no está en prod, la
rompe (nos pasó con `db/16`). Con `main`=staging, cada cambio se ve primero en
staging (contra `rendi-dev`) y prod solo cambia cuando avanzás `production` a mano.

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
4. **Rama de producción = `production`** (Vercel → Settings → Git → Production Branch).
   Así `main` y cada rama → **Preview/staging** (`rendi-dev`); solo `production` → **Producción** (`rendi-prod`).

Cron: el plan **Hobby** solo permite crons 1×/día, así que `vercel.json` usa
`0 6 * * *` (06:00 UTC) para `close-expired`. Es solo la red de seguridad de
intentos huérfanos — el cliente ya auto-entrega si la pestaña está abierta. Al
pasar a **Pro** se puede restaurar `*/5 * * * *` para cerrarlos casi al instante.

## Fase 3 — Flujo de release y migraciones (expand/contract)

Hay **dos canales** que mantener sincronizados: **código** (Vercel) y **base de datos**
(SQL manual). El código **nunca** debe llegar a prod antes que la migración que necesita.

### Migraciones compatibles hacia atrás (expand/contract)
Una migración no debe romper el código que **ya** está en prod. Se hace en pasos:

1. **Expand** — solo aditivo: agregar columnas (nullable o con `default`) y **agregar**
   funciones/RPCs nuevas. **Nunca** `drop`/`rename`/cambiar la firma de algo que el
   código en prod usa. Se aplica a **`rendi-dev` y `rendi-prod`** en este paso.
2. **Migrate** — recién ahora se promueve a `production` el código que usa lo nuevo
   (prod ya lo tiene → no se rompe).
3. **Contract** — más adelante, cuando nada usa lo viejo, se limpia (drop de la
   función/columna vieja) en otra migración.

> El error de `db/16`: dropeó la RPC vieja **y** el código exigía la columna nueva, todo
> junto, con la migración **solo en dev**. Con expand/contract + prod-antes-de-promover,
> eso no puede pasar.

### El camino de un cambio, punta a punta
1. Rama de feature → PR → **CI verde** → merge a **`main`** (staging, `rendi-dev`).
2. Probar en el **Preview/staging** del deploy de `main`.
3. Si hay migración: escribirla **aditiva** (`db/NN_*.sql`), aplicarla en **`rendi-dev` y
   (con backup) `rendi-prod`**, y verificar ambas — **ANTES** de promover el código.
4. **Release:** `git checkout production && git merge --ff-only main && git push`
   → Vercel deploya a **Producción**. Recién ahí los usuarios ven el cambio.

Nunca un `drop`/`alter` improvisado en prod. Nunca desarrollar apuntando a `rendi-prod`.

---

## CI/CD — verificar flujos

### CD (deploy): lo maneja Vercel de forma nativa
- Push a `main` o a cualquier rama de feature → **Preview/staging deploy** (`rendi-dev`).
- Push/merge a **`production`** → **Production deploy** (`rendi-prod`, `getparcialito.com`).
- Configurar en Vercel: **Production Branch = `production`** (Settings → Git → Production
  Branch) + **"solo deployar Production si los checks pasan"** (require CI). Así un PR
  rojo no llega a los usuarios, y un merge a `main` tampoco (main es staging).

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

1. Producción = rama **`production`**. Un merge a `main` es staging, no toca usuarios.
2. Migraciones **aditivas** (expand/contract), aplicadas a **dev y prod ANTES** de
   promover el código que las usa. Nunca dropear/renombrar algo que prod usa.
3. Release deliberado: `main` (verde en staging) → `git merge --ff-only` a `production`.
4. Un PR rojo no deploya. Secrets de prod solo en el scope Production; nunca en el repo.
