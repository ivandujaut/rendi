import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Completa el onboarding del usuario actual: guarda nombre + comisión y, si
 * presentó un código de invitación docente válido, lo promueve a 'teacher'.
 *
 * La asignación de rol es server-side con service-role a propósito: la policy
 * RLS impide que un alumno se auto-promueva editando su propia fila, así que
 * la única vía a 'teacher' es este endpoint validando el código.
 */
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { fullName, groupName, inviteCode } = await req.json().catch(() => ({}));

  const name = typeof fullName === "string" ? fullName.trim() : "";
  if (!name) return NextResponse.json({ error: "Falta tu nombre" }, { status: 400 });

  const group = typeof groupName === "string" ? groupName.trim() : "";
  const code = typeof inviteCode === "string" ? inviteCode.trim() : "";

  // Rol: docente solo con código válido. Código presente pero incorrecto = error.
  let role: "student" | "teacher" = "student";
  if (code) {
    const expected = process.env.TEACHER_INVITE_CODE;
    if (!expected || code !== expected) {
      return NextResponse.json({ error: "El código de docente no es válido" }, { status: 400 });
    }
    role = "teacher";
  }

  // A los alumnos les pedimos comisión; al docente no es obligatoria.
  if (role === "student" && !group) {
    return NextResponse.json({ error: "Indicá tu comisión" }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("profiles")
    .upsert(
      { id: userId, full_name: name, group_name: group || null, role, onboarded: true },
      { onConflict: "id" }
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, role });
}
