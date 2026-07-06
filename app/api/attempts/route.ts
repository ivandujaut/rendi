import { NextResponse } from "next/server";
import { z } from "zod";
import { route } from "@/lib/api/errors";
import { requireUser, parseBody } from "@/lib/api/guards";
import { startOrResumeAttempt } from "@/lib/domain/attempts";

const bodySchema = z.object({
  examId: z.string().min(1),
  mode: z.enum(["exam", "practice"]).optional(),
  forceNew: z.boolean().optional(),
});

export const POST = route(async (req) => {
  const { userId, sb } = await requireUser();
  const { examId, mode, forceNew } = await parseBody(req, bodySchema);
  const result = await startOrResumeAttempt(sb, examId, userId, mode ?? "exam", forceNew ?? false);
  return NextResponse.json(result);
});
