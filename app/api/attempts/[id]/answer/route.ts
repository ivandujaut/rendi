import { NextResponse } from "next/server";
import { z } from "zod";
import { route } from "@/lib/api/errors";
import { requireUser, parseBody } from "@/lib/api/guards";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { answerPractice } from "@/lib/domain/attempts";

const bodySchema = z.object({
  question_id: z.string().min(1),
  choice: z.enum(["A", "B", "C", "D", "E"]),
});

/**
 * Modo Práctica: registra la primera respuesta del alumno y devuelve el feedback
 * inmediato (correcta + si acertó + explicación). Solo para intentos de práctica.
 */
export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { userId } = await requireUser();
  const { id: attemptId } = await params;
  const { question_id, choice } = await parseBody(req, bodySchema);
  const result = await answerPractice(getSupabaseAdmin(), userId, attemptId, question_id, choice);
  return NextResponse.json(result);
});
