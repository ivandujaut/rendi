import { NextResponse } from "next/server";
import { z } from "zod";
import { route, dbError } from "@/lib/api/errors";
import { requireUser, requireAttemptOwner, parseBody } from "@/lib/api/guards";

const bodySchema = z.object({
  question_id: z.string().min(1),
  choice: z.enum(["A", "B", "C", "D", "E"]),
});

/** Auto-guardado de una respuesta mientras el intento está abierto. */
export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { userId, sb } = await requireUser();
  const { id: attemptId } = await params;
  const { question_id, choice } = await parseBody(req, bodySchema);

  // El intento debe ser del usuario y seguir abierto.
  const attempt = await requireAttemptOwner(sb, attemptId, userId);
  if (attempt.submitted_at) {
    return NextResponse.json({ error: "intento ya entregado" }, { status: 409 });
  }

  const { error } = await sb
    .from("responses")
    .upsert({ attempt_id: attemptId, question_id, choice }, { onConflict: "attempt_id,question_id" });
  if (error) dbError("auto-guardar respuesta", error);

  return NextResponse.json({ ok: true });
});
