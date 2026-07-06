import { NextResponse } from "next/server";
import { z } from "zod";
import { route } from "@/lib/api/errors";
import { requireTeacher, parseBody } from "@/lib/api/guards";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { gradePendingOpenResponses } from "@/lib/domain/grading";

/**
 * Disparo on-demand de la corrección con IA para UN examen (lo aprieta el docente
 * desde la cola de corrección). Separado del cron `grade-open`: el cron es la red de
 * seguridad periódica en prod, esto le da al docente control inmediato (y funciona en
 * staging, donde los Vercel Cron no corren). Solo docente; corre con service-role.
 *
 * Idempotente y reanudable: cada `open_response` se corrige una vez (la FK unique lo
 * garantiza), así que si se corta a mitad, lo ya hecho queda y un segundo click sigue.
 * Acota a `LIMIT` por corrida para no pasar el timeout de la función; el cliente hace
 * refresh y, si quedan pendientes, vuelve a disparar.
 */
const LIMIT = 20;

// `openResponseId` opcional: corrige una sola respuesta (botón por fila) en vez de
// todas las pendientes del examen (botón de arriba).
const bodySchema = z.object({
  examId: z.string().min(1),
  openResponseId: z.string().min(1).optional(),
});

export const POST = route(async (req) => {
  await requireTeacher();
  const { examId, openResponseId } = await parseBody(req, bodySchema);
  const admin = getSupabaseAdmin();
  const result = await gradePendingOpenResponses(admin, LIMIT, examId, openResponseId);
  return NextResponse.json({ ok: true, ...result });
});
