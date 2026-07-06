-- =====================================================================
-- db/20: nota FINAL del docente para respuestas de desarrollo.
--
-- Separa dos conceptos que antes compartían columna:
--   · ai_gradings.nota_sugerida  → la nota SUGERIDA por la IA (0-10). Ya existía.
--   · ai_gradings.nota           → la nota FINAL del docente (0-10). NUEVA. Es la
--                                   que ve el alumno.
--
-- La IA sugiere una nota; el docente la confirma o la ajusta al aprobar. Aditiva.
-- Ejecutar en dev Y prod ANTES de mergear el código que la usa (regla expand/contract).
-- =====================================================================

alter table public.ai_gradings
  add column if not exists nota int
    check (nota is null or (nota between 0 and 10));

-- En la iteración anterior (db sin esta columna) la nota del docente se guardó en
-- nota_sugerida. La movemos a la columna final para no perder lo ya cargado.
update public.ai_gradings
   set nota = nota_sugerida
 where nota is null
   and nota_sugerida is not null;
