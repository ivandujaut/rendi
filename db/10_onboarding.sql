-- =====================================================================
-- 10_onboarding.sql  ·  Flag de onboarding para el alta de usuarios
-- Marca si el usuario ya completó el onboarding (nombre + comisión + rol).
-- Las cuentas que ya venían funcionando se marcan onboarded para no
-- interrumpirlas; los registros nuevos arrancan en false.
-- =====================================================================

alter table public.profiles
  add column if not exists onboarded boolean not null default false;

-- Backfill: los perfiles ya existentes no pasan por el onboarding.
update public.profiles set onboarded = true;

-- Endurece la edición del propio perfil: un alumno NO puede auto-promoverse
-- a docente vía RLS. La promoción a 'teacher' es server-side con service-role
-- (validando el código de invitación), por eso ignora esta policy.
-- is_teacher() lee el estado actual en la DB, así que un docente sí puede
-- seguir editando su propia fila.
drop policy if exists "profiles: editar el propio" on public.profiles;
create policy "profiles: editar el propio"
  on public.profiles for update to authenticated
  using ( id = public.clerk_uid() )
  with check ( id = public.clerk_uid() and (role = 'student' or public.is_teacher()) );
