import { NextResponse } from "next/server";
import { z } from "zod";
import { route, dbError, ApiError } from "@/lib/api/errors";
import { requireTeacher, parseBody } from "@/lib/api/guards";

type Ctx = { params: Promise<{ id: string }> };

// Acepta un alumno (`studentId`) o varios (`studentIds`), + attempts_allowed opcional.
const idsSchema = z.object({
  studentId: z.string().optional(),
  studentIds: z.array(z.string()).optional(),
  attempts_allowed: z.number().optional(),
});

/** Normaliza a una lista de ids; exige al menos uno. */
function readIds(body: z.infer<typeof idsSchema>): string[] {
  const ids = body.studentIds ?? (body.studentId ? [body.studentId] : []);
  if (ids.length === 0) throw new ApiError(400, "studentId requerido");
  return ids;
}

/**
 * Asignar el examen a uno o varios alumnos (los habilita a verlo y rendirlo).
 * `studentId` para uno; `studentIds` para asignación masiva (p. ej. una comisión).
 */
export const POST = route<Ctx>(async (req, { params }) => {
  const { sb } = await requireTeacher();
  const { id } = await params;
  const body = await parseBody(req, idsSchema);
  const ids = readIds(body);

  // Al (re)asignar un alumno con intentos previos, le pasamos attempts_allowed
  // = entregas + 1 para que pueda volver a rendir sin un paso extra. Solo aplica
  // al caso individual; en masivo se usa el default (1) para los nuevos y el
  // upsert con ignoreDuplicates deja intactas las asignaciones existentes.
  const rows = ids.map((user_id) => {
    const row: { exam_id: string; user_id: string; attempts_allowed?: number } = { exam_id: id, user_id };
    if (ids.length === 1 && typeof body.attempts_allowed === "number") row.attempts_allowed = body.attempts_allowed;
    return row;
  });

  const { error } = await sb
    .from("exam_assignments")
    .upsert(rows, { onConflict: "exam_id,user_id", ignoreDuplicates: true });
  if (error) dbError("asignar examen", error);

  return NextResponse.json({ ok: true });
});

/** Desasignar el examen de uno o varios alumnos (`studentId` o `studentIds`). */
export const DELETE = route<Ctx>(async (req, { params }) => {
  const { sb } = await requireTeacher();
  const { id } = await params;
  const ids = readIds(await parseBody(req, idsSchema));

  const { error } = await sb.from("exam_assignments").delete().eq("exam_id", id).in("user_id", ids);
  if (error) dbError("desasignar examen", error);

  return NextResponse.json({ ok: true });
});

/** Ajustar los intentos habilitados de un alumno (re-habilitar = sumar +1). */
const patchSchema = z.object({ studentId: z.string().min(1), attempts_allowed: z.number() });
export const PATCH = route<Ctx>(async (req, { params }) => {
  const { sb } = await requireTeacher();
  const { id } = await params;
  const { studentId, attempts_allowed } = await parseBody(req, patchSchema);

  const { error } = await sb
    .from("exam_assignments")
    .update({ attempts_allowed })
    .eq("exam_id", id)
    .eq("user_id", studentId);
  if (error) dbError("ajustar intentos", error);

  return NextResponse.json({ ok: true });
});
