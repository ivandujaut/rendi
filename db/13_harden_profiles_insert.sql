-- =====================================================================
-- 13_harden_profiles_insert.sql  ·  Cierra la auto-promoción a docente por INSERT
-- El UPDATE de profiles se endureció en db/10, pero el INSERT seguía permitiendo
-- crear el propio perfil con CUALQUIER rol. Como el navegador tiene la anon key y
-- todo usuario autenticado tiene un JWT de Clerk, se podía hacer POST /rest/v1/profiles
-- con role='teacher' y escalar privilegios (leer answer_keys, ver todos los intentos).
-- Fix: un usuario solo puede crear su propio perfil como 'student'. La promoción a
-- docente pasa EXCLUSIVAMENTE por la ruta de onboarding con service_role (ignora RLS).
-- Ejecutar después de 01–12.
-- =====================================================================

drop policy if exists "profiles: crear el propio" on public.profiles;
create policy "profiles: crear el propio"
  on public.profiles for insert to authenticated
  with check ( id = public.clerk_uid() and role = 'student' );
