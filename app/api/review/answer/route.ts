import { NextResponse } from "next/server";
import { z } from "zod";
import { route } from "@/lib/api/errors";
import { requireUser, parseBody } from "@/lib/api/guards";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { answerPractice } from "@/lib/domain/attempts";

const bodySchema = z.object({
  attemptId: z.string().min(1),
  question_id: z.string().min(1),
  choice: z.enum(["A", "B", "C", "D", "E"]),
});

/**
 * Respuesta dentro del loop de repaso espaciado (Leitner). Registra la respuesta (con
 * service-role, igual que práctica — mantiene la señal de temas flojos del docente) y
 * AGENDA la carta según si acertó (sube de caja o vuelve a la 1). Devuelve el feedback
 * inmediato + la próxima fecha de repaso (`nextDue`) para mostrar "la repasás en X días".
 */
export const POST = route(async (req) => {
  const { userId, sb } = await requireUser();
  const { attemptId, question_id, choice } = await parseBody(req, bodySchema);

  const result = await answerPractice(getSupabaseAdmin(), userId, attemptId, question_id, choice);

  // Agenda la carta con el cliente RLS del alumno (schedule_review_card usa clerk_uid()).
  const { data: nextDue } = await sb.rpc("schedule_review_card", {
    p_question: question_id,
    p_correct: result.is_correct,
  });

  return NextResponse.json({ ...result, nextDue });
});
