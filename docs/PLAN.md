# Roadmap — Rendi

El "dónde estamos / qué sigue" en un solo lugar. Se actualiza a medida que avanzamos.

## Hecho
- Asignación de exámenes por alumno y **por comisión** (PR #13).
- Seed con fuente única del id del examen (PR #14).
- **Diseño del feature grande**: corrector asistido por IA + plan de repaso
  personalizado (doc en `~/.gstack/projects/ivandujaut-rendi/`, aprobado 9/10).
- **Validación iniciada** (2 exámenes reales de Técnicas Digitales): la IA corrige
  bien lo determinístico/lógico (teacher-approved); el diseño de circuito y figuras
  quedan fuera del MVP. Detalle en `validacion-resultados.md`.
- **Estrategia de ambientes + CI/CD** definida (runbook `docs/ambientes-y-cicd.md`).
- **CI activo**: typecheck + lint + build en cada PR (PR #15, #17).
- **Revisión de seguridad pre-deploy**: agujero crítico de auto-promoción a
  docente cerrado (`db/13`, PR #16), aplicado en la DB viva.
- **README actualizado** al estado real del proyecto (PR #17).
- **Revisión de arquitectura** (4 agentes en paralelo: data layer, API/BFF, UI,
  estructura) — mismas 5 debilidades transversales en todas las capas. Roadmap
  abajo, en 3 grupos por apalancamiento.
- **Quick wins, primera tanda** (PR #18): clients de Supabase tipados
  (`lib/db.types.ts` + `createClient<Database>`) — destapó 3 bugs reales tapados
  por `any`/casts; `any` bajado de 26 a 2 sitios (documentados); `lib/env.ts`
  (env validada con Zod al boot, fail-fast); borrado el trío muerto
  `lib/supabase/*` (@supabase/ssr sin un solo import); `app/error.tsx` +
  `app/not-found.tsx` (no había error boundaries).

## Infra / ambientes (en orden)
- [x] **Fase 1 — Partir la base de datos** (hecha 2026-07-02): proyecto Supabase
      `rendi-dev` creado, `db/all_in_one.sql` cargado, `.env.local` repuntado a dev
      (config de prod en `.env.prod.local`), Clerk Third-Party Auth agregado.
      Verificado end-to-end. El Supabase actual queda congelado como prod.
- [ ] **Fase 2 — Deploy** con Vercel por scope (Production→prod, Preview→dev) +
      Clerk Production. Cierra el deploy diferido.
- [ ] **Fase 3 — Disciplina de migraciones** (DEV→preview→PR/CI verde→backup→prod).

## Arquitectura (backlog priorizado, ver diagnóstico completo en la sesión de
## revisión — 5 debilidades transversales: sin capa de dominio/DIP, sin tipos de
## DB, sin validación de input, transversales duplicados, env sin validar)

**Grupo 1 — Quick wins** (bajo riesgo, alto apalancamiento):
- [x] `lib/db.types.ts` + clients tipados (PR #18).
- [x] `lib/env.ts` validado con Zod (PR #18).
- [x] Borrar `lib/supabase/*` muerto (PR #18).
- [x] `app/error.tsx` + `app/not-found.tsx` (PR #18).
- [x] Helpers de API (`lib/api/`): `route()` wrapper (errores → 500 genérico +
      log server-side, corta el leak de `error.message` de Postgres),
      `requireUser`/`requireTeacher`/`requireAttemptOwner`, `parseBody(schema)`.
      Aplicados a las 10 rutas (PR #19). De paso arregló un bug latente en
      `upload-figure` (role check sin filtrar por id).

**Grupo 2 — Estructural** (media, feature por feature):
- [x] Schemas Zod por ruta (vía `parseBody`) — reemplaza los `typeof` sueltos
      y evita 500s por body inesperado (PR #19).
- [x] `lib/domain/attempts.ts`: extraída la lógica de las 3 rutas de `attempts`
      (start/resume ~80 líneas, save, submit) — las rutas quedan finas
      (guard → validar → dominio → responder). Validado por los E2E. Las rutas de
      exams/assignments quedan como están (ya finas post-PR #19: delegan a RPCs).
- [x] `lib/api/client.ts` (`apiRequest`) + `lib/hooks/use-mutation.ts`
      (`useMutation`: busy por-clave + error + `run` con optimista/revert).
      Adoptados en AssignmentManager (optimista) y ExamManager (publicar/borrar).
      **Grupo 2 completo.**

**Grupo 3 — Fundacional para el corrector con IA:**
- [x] **Slice 1 — Fundación + de-riesgo de la IA** (sin schema/UI): `lib/ai/`
      (cliente desacoplado vía AI Gateway con `generateObject` + Zod, el LLM vive
      acá y NO en una función SQL) + `lib/domain/grading.ts` (`gradeOpenAnswer`:
      arma prompt, corrige por equivalencia, feedback-first sin nota, fallback
      `failed`) + eval harness (`eval/grading/`, `npm run eval:grading`) con
      fixtures reales de los 2 exámenes validados. **Eval corrido 2026-07-02
      (modelo `claude-opus-4-8`): 6/6 en verde** — corrige por equivalencia lo
      determinístico (C2/overflow, Boole/K-map, don't-cares), no inventa temas en
      respuestas correctas, y frena ante el circuito dibujado a mano ("queda para
      el docente"). Confirma el alcance del MVP. Corre con `ANTHROPIC_API_KEY` o
      `AI_GATEWAY_API_KEY`.
- [ ] **Slice 2 — Schema + cola de corrección** (diferido): migración
      (`questions.kind`, `open_responses`, `ai_gradings`), persistencia en
      `grading.ts`, y UI de cola de revisión del docente (aprobar/rechazar de a uno).
- [ ] **Slice 3 — Plan de repaso** (diferido): `study_plans` + normalización de
      `questions.topic` a vocabulario controlado.
- [ ] Convención de carpeta por feature.

## Preparación del proyecto (backlog restante)
- [~] **E2E de flujos** (Playwright + `@clerk/testing`, corren contra rendi-dev):
      - [x] Harness: `playwright.config.ts` + global setup (testing token) + script `e2e`.
      - [x] Público: landing + waitlist (escribe en DEV).
      - [x] Auth alumno: sign-in (`email_code`, no password) → onboarding → `/exams`.
      - [x] Flujo core (serial): alumno onboardeado → docente asigna → alumno rinde
            y ve el resultado. Con reset de estado vía service-role (repetible).
      - [ ] Sumar un job de E2E al CI (webServer + secrets de DEV en GitHub).
- [ ] **Seed de dev más rico** (alumnos/comisiones falsos) para testear
      asignación y el futuro corrector.

## Feature grande (después de validación + Fase 1 + Grupo 1 de arquitectura)
- [ ] Corrector asistido MVP (feedback-first, respuestas determinísticas/verificables):
      migración de schema, endpoint de IA, cola de corrección, plan de repaso.
      Correr `/plan-eng-review` sobre el doc de diseño para el plan de ejecución.
- [ ] Gold standard de validación: guardar 5 respuestas reales del próximo examen
      antes de devolverlas, y comparar IA vs corrección del docente.
