import { NextResponse } from "next/server";
import { z } from "zod";
import { route } from "@/lib/api/errors";
import { requireUser, requireAttemptOwner, parseBody } from "@/lib/api/guards";
import { saveOpenResponse } from "@/lib/domain/attempts";

const bodySchema = z.object({
  question_id: z.string().min(1),
  answer_text: z.string(),
});

/** Auto-guardado de una respuesta de desarrollo mientras el intento está abierto. */
export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { userId, sb } = await requireUser();
  const { id: attemptId } = await params;
  const { question_id, answer_text } = await parseBody(req, bodySchema);

  const attempt = await requireAttemptOwner(sb, attemptId, userId);
  if (attempt.submitted_at) {
    return NextResponse.json({ error: "intento ya entregado" }, { status: 409 });
  }

  await saveOpenResponse(sb, attemptId, question_id, answer_text);
  return NextResponse.json({ ok: true });
});
