import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { env } from "@/lib/env";
import { route, dbError, ApiError } from "@/lib/api/errors";

/**
 * Red de seguridad: cierra y corrige los intentos vencidos sin entregar (cuando
 * el alumno cerró la pestaña justo al agotarse el tiempo). El cliente ya
 * auto-entrega si la pestaña está abierta; esto cubre el resto.
 *
 * Lo dispara Vercel Cron (ver vercel.json). Vercel agrega el header
 * `Authorization: Bearer <CRON_SECRET>` cuando la env var CRON_SECRET existe.
 */
const GRACE_SEC = 10;

export const GET = route(async (req) => {
  if (req.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    throw new ApiError(401, "no autorizado");
  }

  const sb = getSupabaseAdmin();
  const { data: open, error } = await sb
    .from("attempts")
    .select("id, started_at, exams(duration_min)")
    .is("submitted_at", null);
  if (error) dbError("cron: leer intentos abiertos", error);

  const now = Date.now();
  // El join embebido puede venir como objeto o array según la inferencia; lo normalizamos.
  const expired = (open ?? []).filter((a) => {
    const ex = Array.isArray(a.exams) ? a.exams[0] : a.exams;
    const dur = ex?.duration_min ?? 40;
    return now > new Date(a.started_at).getTime() + (dur * 60 + GRACE_SEC) * 1000;
  });

  let closed = 0;
  for (const a of expired as { id: string }[]) {
    await sb.from("attempts").update({ auto: true }).eq("id", a.id);
    const { error: gradeErr } = await sb.rpc("grade_attempt", { p_attempt: a.id });
    if (!gradeErr) closed++;
  }

  return NextResponse.json({ ok: true, scanned: open?.length ?? 0, closed });
});
