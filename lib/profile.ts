import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getSupabaseServer } from "./supabaseServer";

export type Profile = {
  id: string;
  full_name: string | null;
  group_name: string | null;
  role: "student" | "teacher";
  onboarded: boolean;
};

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

/** Devuelve la fila de perfil del usuario actual (o null si no hay sesión). */
export async function getProfile(): Promise<Profile | null> {
  const { userId } = await auth();
  if (!userId) return null;
  const sb = await getSupabaseServer();
  const { data } = await sb
    .from("profiles")
    .select("id, full_name, group_name, role, onboarded")
    .eq("id", userId)
    .maybeSingle();
  return (data as Profile) ?? null;
}

/**
 * Garantiza perfil + onboarding completo en una entrada protegida.
 * Si el usuario todavía no completó el onboarding, redirige a /onboarding.
 * Devuelve { uid, role } para que la página decida qué mostrar.
 */
export async function requireOnboarded(): Promise<{ uid: string; role: "student" | "teacher" }> {
  const uid = await ensureProfile();
  if (!uid) redirect("/sign-in");
  const sb = await getSupabaseServer();
  const { data } = await sb
    .from("profiles")
    .select("role, onboarded")
    .eq("id", uid)
    .maybeSingle();
  if (!data?.onboarded) redirect("/onboarding");
  return { uid, role: (data.role as "student" | "teacher") ?? "student" };
}
