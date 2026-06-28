import { auth, currentUser } from "@clerk/nextjs/server";
import { getSupabaseServer } from "./supabaseServer";

/** Crea la fila en profiles la primera vez que el usuario entra. */
export async function ensureProfile() {
  const user = await currentUser();
  if (!user) return null;
  const sb = await getSupabaseServer();
  const fullName =
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
    user.username ||
    user.emailAddresses?.[0]?.emailAddress ||
    "Alumno/a";
  // ignoreDuplicates: no piso nombre ni rol si ya existe.
  await sb
    .from("profiles")
    .upsert({ id: user.id, full_name: fullName }, { onConflict: "id", ignoreDuplicates: true });
  return user.id;
}

/** Devuelve el rol del usuario actual ('student' | 'teacher'). */
export async function getRole(): Promise<"student" | "teacher"> {
  const { userId } = await auth();
  if (!userId) return "student";
  const sb = await getSupabaseServer();
  // Filtramos por el id propio: un teacher ve TODAS las filas por RLS, y sin
  // este filtro maybeSingle() falla con >1 perfil y devolvería 'student'.
  const { data } = await sb
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  return (data?.role as "student" | "teacher") ?? "student";
}
