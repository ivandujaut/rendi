-- =====================================================================
-- 11_waitlist.sql  ·  Lista de espera de docentes (landing pública)
-- La landing es pública (sin sesión). El alta la inserta la API
-- /api/waitlist con service-role, por eso la tabla tiene RLS habilitada
-- y SIN políticas: nadie lee ni escribe desde el cliente.
-- =====================================================================

create table if not exists public.waitlist (
  id          uuid primary key default gen_random_uuid(),
  full_name   text not null,
  email       text not null unique,
  use_case    text,                 -- 'oatec' | 'aula' | 'ambas' | 'otra'
  pain        text,                 -- "mayor dolor al evaluar" (opcional)
  created_at  timestamptz not null default now()
);

alter table public.waitlist enable row level security;
