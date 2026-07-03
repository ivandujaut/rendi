import { NextResponse } from "next/server";
import { z } from "zod";
import { route } from "@/lib/api/errors";
import { requireUser, requireAttemptOwner, parseBody } from "@/lib/api/guards";
import { submitAttempt } from "@/lib/domain/attempts";

const bodySchema = z.object({
  responses: z.array(z.object({ question_id: z.string(), choice: z.string() })).optional(),
  openResponses: z.array(z.object({ question_id: z.string(), answer_text: z.string() })).optional(),
  auto: z.boolean().optional(),
});

export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { userId, sb } = await requireUser();
  const { id: attemptId } = await params;
  const { responses, openResponses, auto } = await parseBody(req, bodySchema);

  const attempt = await requireAttemptOwner(sb, attemptId, userId);
  if (attempt.submitted_at) {
    return NextResponse.json({ ok: true, alreadySubmitted: true });
  }

  const result = await submitAttempt(sb, attempt, responses, auto, openResponses);
  return NextResponse.json({ ok: true, ...result });
});
