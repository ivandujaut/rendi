import { NextResponse } from "next/server";
import { z } from "zod";
import { route } from "@/lib/api/errors";
import { requireUser, parseBody } from "@/lib/api/guards";
import { startOrResumeAttempt } from "@/lib/domain/attempts";

const bodySchema = z.object({ examId: z.string().min(1) });

export const POST = route(async (req) => {
  const { userId, sb } = await requireUser();
  const { examId } = await parseBody(req, bodySchema);
  const result = await startOrResumeAttempt(sb, examId, userId);
  return NextResponse.json(result);
});
