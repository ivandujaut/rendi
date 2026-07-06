import { NextResponse } from "next/server";
import { z } from "zod";
import { route } from "@/lib/api/errors";
import { requireTeacher, parseBody } from "@/lib/api/guards";
import { reviewGrading } from "@/lib/domain/grading";

// Revisión del docente sobre un borrador de corrección: aprobar (opcionalmente editado)
// o rechazar. Solo docente (requireTeacher + RLS). El alumno nunca escribe acá.
const bodySchema = z.object({
  action: z.enum(["approve", "reject"]),
  feedback: z.string().optional(),
  // Nota del docente (0-10) para la respuesta de desarrollo. Opcional; nullable para borrarla.
  nota: z.number().int().min(0).max(10).nullable().optional(),
});

export const PATCH = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { userId, sb } = await requireTeacher();
  const { id } = await params;
  const { action, feedback, nota } = await parseBody(req, bodySchema);

  await reviewGrading(sb, id, userId, action, feedback, nota);
  return NextResponse.json({ ok: true });
});
