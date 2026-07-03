import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { env } from "@/lib/env";
import { route, ApiError } from "@/lib/api/errors";
import { gradePendingOpenResponses } from "@/lib/domain/grading";

/**
 * Corrector asistido (async): levanta las respuestas de desarrollo entregadas que aún no
 * tienen borrador de IA, las corrige y persiste `ai_gradings`. Separa la latencia de la IA
 * de la entrega del alumno (el submit solo escribe `open_responses`).
 *
 * Lo dispara Vercel Cron (ver vercel.json), igual que close-expired: Vercel agrega
 * `Authorization: Bearer <CRON_SECRET>`. En local (app no deployada) se gatilla a mano:
 *   curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/grade-open
 *
 * Acota a un máximo por corrida para no pasar el timeout de la función (cada corrección
 * puede tardar); las que queden se toman en la próxima corrida.
 */
const MAX_PER_RUN = 10;

export const GET = route(async (req) => {
  if (req.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    throw new ApiError(401, "no autorizado");
  }

  const sb = getSupabaseAdmin();
  const result = await gradePendingOpenResponses(sb, MAX_PER_RUN);

  return NextResponse.json({ ok: true, ...result });
});
