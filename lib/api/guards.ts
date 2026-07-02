import { auth } from "@clerk/nextjs/server";
import type { z } from "zod";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { ApiError } from "@/lib/api/errors";

type ServerClient = Awaited<ReturnType<typeof getSupabaseServer>>;

/** Exige sesión. Devuelve el userId de Clerk y un cliente Supabase RLS-scoped. */
export async function requireUser(): Promise<{ userId: string; sb: ServerClient }> {
  const { userId } = await auth();
  if (!userId) throw new ApiError(401, "No autenticado");
  const sb = await getSupabaseServer();
  return { userId, sb };
}

/**
 * Exige sesión + rol docente (defensa en profundidad además de las RLS/RPCs, que
 * ya lo verifican). Devuelve un 403 limpio en vez de que reviente una policy.
 */
export async function requireTeacher(): Promise<{ userId: string; sb: ServerClient }> {
  const { userId, sb } = await requireUser();
  const { data } = await sb.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (data?.role !== "teacher") throw new ApiError(403, "Acción solo para docentes");
  return { userId, sb };
}

/**
 * Verifica que el intento exista y sea del usuario (si no, 404 — no revela si el
 * intento existe pero es de otro). Devuelve la fila con los campos que las rutas
 * de intento necesitan; el manejo del estado entregado queda en cada ruta.
 */
export async function requireAttemptOwner(sb: ServerClient, attemptId: string, userId: string) {
  const { data: attempt } = await sb
    .from("attempts")
    .select("id, user_id, submitted_at, started_at, exam_id")
    .eq("id", attemptId)
    .maybeSingle();
  if (!attempt || attempt.user_id !== userId) throw new ApiError(404, "intento no encontrado");
  return attempt;
}

/**
 * Parsea y valida el body JSON contra un schema Zod. JSON malformado → 400;
 * datos que no matchean el schema → 422. Reemplaza los `typeof` sueltos por ruta
 * y evita los 500 por body inesperado.
 */
export async function parseBody<T>(req: Request, schema: z.ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiError(400, "El cuerpo del pedido no es JSON válido");
  }
  const result = schema.safeParse(raw);
  if (!result.success) throw new ApiError(422, "Datos inválidos");
  return result.data;
}
