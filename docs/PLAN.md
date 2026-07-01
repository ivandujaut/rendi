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
- **CI activo**: `tsc --noEmit` en cada PR (PR #15).

## Infra / ambientes (en orden)
- [ ] **Fase 1 — Partir la base de datos** (pendiente, acción del usuario): crear
      proyecto Supabase `rendi-dev`, correr `db/all_in_one.sql` ahí, repuntar
      `.env.local` a dev, congelar el Supabase actual como prod. Ver runbook.
- [ ] **Fase 2 — Deploy** con Vercel por scope (Production→prod, Preview→dev) +
      Clerk Production. Cierra el deploy diferido.
- [ ] **Fase 3 — Disciplina de migraciones** (DEV→preview→PR/CI verde→backup→prod).

## Preparación del proyecto (backlog, antes de construir el feature)
- [ ] Lint real (ESLint; `next lint` está deprecado) + sumarlo al CI.
- [ ] Job de **build** en el CI (verificar que `next build` compila, con env de DEV).
- [ ] **E2E de flujos** (Playwright + `@clerk/testing`): sign-up/onboarding, asignar,
      rendir, revisión. Requiere ambiente DEV (Fase 1).
- [ ] **README** del proyecto (setup, env vars, arquitectura) — portfolio-facing.
- [ ] **Revisión de seguridad pre-deploy** (RLS, uso de service-role, endpoints
      onboarding/waitlist) antes de que haya usuarios reales.
- [ ] **Seed de dev más rico** (alumnos/comisiones falsos) para testear asignación
      y el futuro corrector.

## Feature grande (después de validación + Fase 1)
- [ ] Corrector asistido MVP (feedback-first, respuestas determinísticas/verificables):
      migración de schema, endpoint de IA, cola de corrección, plan de repaso.
      Correr `/plan-eng-review` sobre el doc de diseño para el plan de ejecución.
- [ ] Gold standard de validación: guardar 5 respuestas reales del próximo examen
      antes de devolverlas, y comparar IA vs corrección del docente.
