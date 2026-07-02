import { z } from "zod";

/**
 * Variables de entorno validadas una sola vez, al cargar el módulo. Una var
 * faltante o vacía tira acá (con el nombre exacto) en vez de fallar más tarde
 * como un error críptico de Supabase/fetch.
 *
 * Importar SOLO desde código server-only (route handlers, Server Components,
 * o módulos que ya son exclusivamente server como supabaseServer/supabaseAdmin).
 * Este módulo valida `SUPABASE_SERVICE_ROLE_KEY` (secreto) al cargar: si un
 * Client Component lo importa transitivamente, la validación corre en el
 * navegador (donde esa var no existe) y el import rompe en runtime. Por eso
 * `lib/types.ts` (que sí importan client components) NO usa este módulo para
 * `publicFigureUrl` — lee `NEXT_PUBLIC_SUPABASE_URL` directo.
 */
const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  TEACHER_INVITE_CODE: z.string().min(1),
  CRON_SECRET: z.string().min(1),
});

export const env = schema.parse(process.env);
