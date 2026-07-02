import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db.types";
import { env } from "@/lib/env";

/**
 * Cliente Supabase autenticado con el token de sesion de Clerk
 * (integracion nativa Third-Party Auth). Respeta las politicas RLS:
 * un alumno solo accede a lo suyo; un docente, a todo.
 */
export async function getSupabaseServer() {
  const authObj = await auth();
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    accessToken: async () => (await authObj.getToken()) ?? null,
  });
}
