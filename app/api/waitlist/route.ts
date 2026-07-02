import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { route, dbError, ApiError } from "@/lib/api/errors";
import { parseBody } from "@/lib/api/guards";

/**
 * Alta en la lista de espera desde la landing pública (sin sesión).
 * Escribe con service-role; la tabla tiene RLS sin políticas.
 */
const bodySchema = z.object({
  fullName: z.string().optional(),
  email: z.string(),
  useCase: z.string().optional(),
  pain: z.string().optional(),
});

export const POST = route(async (req) => {
  const body = await parseBody(req, bodySchema);

  const name = (body.fullName ?? "").trim().slice(0, 120);
  const mail = body.email.trim().toLowerCase().slice(0, 200);
  // Solo el email es obligatorio (menos fricción). El nombre cae al email si no lo dan.
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) {
    throw new ApiError(400, "Revisá el email");
  }

  const sb = getSupabaseAdmin();
  const { error } = await sb.from("waitlist").upsert(
    {
      full_name: name || mail,
      email: mail,
      use_case: body.useCase ? body.useCase.slice(0, 500) : null,
      pain: body.pain?.trim() ? body.pain.trim().slice(0, 2000) : null,
    },
    { onConflict: "email" },
  );
  if (error) dbError("waitlist upsert", error, "No pudimos registrarte, probá de nuevo");

  return NextResponse.json({ ok: true });
});
