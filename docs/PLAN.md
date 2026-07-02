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
- [ ] **Fase 1 — Partir la base de datos** (pendiente, acción del usuario): crear
      proyecto Supabase `rendi-dev`, correr `db/all_in_one.sql` ahí, repuntar
      `.env.local` a dev, congelar el Supabase actual como prod. Ver runbook.
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
- [ ] `lib/domain/*` (attempts, exams, assignments): extraer lógica de las
      rutas más pesadas (`attempts` POST). **Diferido hasta tener E2E** (Fase 1):
      mover lógica de negocio sin red de tests es donde se rompe un flujo en silencio.
- [ ] Hook para el patrón optimista repetido (`call()` de
      AssignmentManager/ExamManager).

**Grupo 3 — Fundacional para el corrector con IA:**
- [ ] `lib/ai/` — cliente de IA desacoplado (provider-agnostic). El LLM del
      corrector vive acá, NO en una función SQL `SECURITY DEFINER`.
- [ ] `lib/domain/grading.ts` — servicio de corrección (escribe
      `open_responses`, llama IA, persiste `ai_gradings`). Parte del build.
- [ ] Convención de carpeta por feature.

## Preparación del proyecto (backlog restante)
- [ ] **E2E de flujos** (Playwright + `@clerk/testing`): sign-up/onboarding,
      asignar, rendir, revisión. Requiere ambiente DEV (Fase 1).
- [ ] **Seed de dev más rico** (alumnos/comisiones falsos) para testear
      asignación y el futuro corrector.

## Feature grande (después de validación + Fase 1 + Grupo 1 de arquitectura)
- [ ] Corrector asistido MVP (feedback-first, respuestas determinísticas/verificables):
      migración de schema, endpoint de IA, cola de corrección, plan de repaso.
      Correr `/plan-eng-review` sobre el doc de diseño para el plan de ejecución.
- [ ] Gold standard de validación: guardar 5 respuestas reales del próximo examen
      antes de devolverlas, y comparar IA vs corrección del docente.
