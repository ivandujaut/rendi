import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Alta en la lista de espera desde la landing pública (sin sesión).
 * Escribe con service-role; la tabla tiene RLS sin políticas.
 */
export async function POST(req: Request) {
  const { fullName, email, useCase, pain } = await req.json().catch(() => ({}));

  const name = typeof fullName === "string" ? fullName.trim() : "";
  const mail = typeof email === "string" ? email.trim().toLowerCase() : "";
  // Solo el email es obligatorio (menos fricción). El nombre cae al email si no lo dan.
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) {
    return NextResponse.json({ error: "Revisá el email" }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const { error } = await sb.from("waitlist").upsert(
    {
      full_name: name || mail,
      email: mail,
      use_case: typeof useCase === "string" && useCase ? useCase : null,
      pain: typeof pain === "string" && pain.trim() ? pain.trim() : null,
    },
    { onConflict: "email" }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
