import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Cliente Supabase autenticado con el token de sesion de Clerk
 * (integracion nativa Third-Party Auth). Respeta las politicas RLS:
 * un alumno solo accede a lo suyo; un docente, a todo.
 */
export async function getSupabaseServer() {
  const authObj = await auth();
  return createClient(URL, ANON, {
    accessToken: async () => (await authObj.getToken()) ?? null,
  });
}
