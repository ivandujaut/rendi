import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { env } from "@/lib/env";
import { route, dbError, ApiError } from "@/lib/api/errors";
import { requireUser, parseBody } from "@/lib/api/guards";

/**
 * Completa el onboarding del usuario actual: guarda nombre + comisión y, si
 * presentó un código de invitación docente válido, lo promueve a 'teacher'.
 *
 * La asignación de rol es server-side con service-role a propósito: la policy
 * RLS impide que un alumno se auto-promueva editando su propia fila, así que
 * la única vía a 'teacher' es este endpoint validando el código.
 */
const bodySchema = z.object({
  fullName: z.string(),
  groupName: z.string().optional(),
  inviteCode: z.string().optional(),
});

export const POST = route(async (req) => {
  const { userId } = await requireUser();
  const body = await parseBody(req, bodySchema);

  const name = body.fullName.trim().slice(0, 120);
  if (!name) throw new ApiError(400, "Falta tu nombre");

  const group = (body.groupName ?? "").trim().slice(0, 80);
  const code = (body.inviteCode ?? "").trim();

  // Rol: docente solo con código válido. Código presente pero incorrecto = error.
  let role: "student" | "teacher" = "student";
  if (code) {
    if (code !== env.TEACHER_INVITE_CODE) {
      throw new ApiError(400, "El código de docente no es válido");
    }
    role = "teacher";
  }

  // A los alumnos les pedimos comisión; al docente no es obligatoria.
  if (role === "student" && !group) throw new ApiError(400, "Indicá tu comisión");

  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("profiles")
    .upsert({ id: userId, full_name: name, group_name: group || null, role, onboarded: true }, { onConflict: "id" });
  if (error) dbError("onboarding upsert", error, "No se pudo completar el registro");

  return NextResponse.json({ ok: true, role });
});
