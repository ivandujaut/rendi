import { createClient } from "@supabase/supabase-js";

/**
 * Cliente con service-role: IGNORA RLS. Usar solo en codigo de servidor
 * (route handlers / server actions) para tareas administrativas como
 * cargar simulacros. NUNCA exponer esta key al cliente.
 */
export function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
