import { NextResponse } from "next/server";
import { z } from "zod";
import { route, dbError } from "@/lib/api/errors";
import { requireUser, requireAttemptOwner, parseBody } from "@/lib/api/guards";

const bodySchema = z.object({
  responses: z.array(z.object({ question_id: z.string(), choice: z.string() })).optional(),
  auto: z.boolean().optional(),
});

export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { userId, sb } = await requireUser();
  const { id: attemptId } = await params;
  const { responses, auto } = await parseBody(req, bodySchema);

  // El intento debe ser del usuario y no estar entregado.
  const attempt = await requireAttemptOwner(sb, attemptId, userId);
  if (attempt.submitted_at) {
    return NextResponse.json({ ok: true, alreadySubmitted: true });
  }

  // Reloj autoritativo: si se agotó el tiempo, igual se corrige lo que haya.
  const { data: exam } = await sb
    .from("exams")
    .select("duration_min")
    .eq("id", attempt.exam_id)
    .single();
  const elapsedSec = (Date.now() - new Date(attempt.started_at).getTime()) / 1000;
  const overtime = elapsedSec > (exam?.duration_min ?? 40) * 60 + 5; // 5s de gracia

  // Guardar respuestas (upsert por si reenvía). Filtramos por choice válido
  // (A-E) en vez de confiar en el body: antes una entrada inválida hacía
  // fallar todo el upsert por la CHECK de la tabla; ahora se descarta sola.
  const VALID_CHOICES = ["A", "B", "C", "D", "E"] as const;
  type Choice = (typeof VALID_CHOICES)[number];
  const rows = (responses ?? [])
    .filter(
      (r): r is { question_id: string; choice: Choice } =>
        !!r?.question_id && (VALID_CHOICES as readonly string[]).includes(r?.choice),
    )
    .map((r) => ({ attempt_id: attemptId, question_id: r.question_id, choice: r.choice }));

  if (rows.length > 0) {
    const { error: insErr } = await sb
      .from("responses")
      .upsert(rows, { onConflict: "attempt_id,question_id" });
    if (insErr) dbError("guardar respuestas al entregar", insErr);
  }

  // Marcar entrega automática si corresponde.
  await sb.from("attempts").update({ auto: !!auto || overtime }).eq("id", attemptId);

  // Corrección server-side (la función lee la clave sin devolverla).
  const { data: graded, error: gradeErr } = await sb.rpc("grade_attempt", { p_attempt: attemptId });
  if (gradeErr) dbError("corregir intento", gradeErr, "No se pudo corregir el examen");

  const result = Array.isArray(graded) ? graded[0] : graded;
  return NextResponse.json({ ok: true, ...result });
});
