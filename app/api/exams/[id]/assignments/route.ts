import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseServer } from "@/lib/supabaseServer";

/** Normaliza el body: acepta un alumno (`studentId`) o varios (`studentIds`). */
function readIds(body: { studentId?: string; studentIds?: string[] }): string[] {
  if (Array.isArray(body.studentIds)) return body.studentIds.filter((x) => typeof x === "string");
  return body.studentId ? [body.studentId] : [];
}

/**
 * Asignar el examen a uno o varios alumnos (los habilita a verlo y rendirlo).
 * `studentId` para uno; `studentIds` para asignación masiva (p. ej. una comisión).
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "no auth" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const ids = readIds(body);
  if (ids.length === 0) return NextResponse.json({ error: "studentId requerido" }, { status: 400 });

  // Al (re)asignar un alumno con intentos previos, le pasamos attempts_allowed
  // = entregas + 1 para que pueda volver a rendir sin un paso extra. Solo aplica
  // al caso individual; en masivo se usa el default (1) para los nuevos y el
  // upsert con ignoreDuplicates deja intactas las asignaciones existentes.
  const rows = ids.map((user_id) => {
    const row: { exam_id: string; user_id: string; attempts_allowed?: number } = { exam_id: id, user_id };
    if (ids.length === 1 && typeof body.attempts_allowed === "number") row.attempts_allowed = body.attempts_allowed;
    return row;
  });

  const sb = await getSupabaseServer();
  const { error } = await sb
    .from("exam_assignments")
    .upsert(rows, { onConflict: "exam_id,user_id", ignoreDuplicates: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}

/** Desasignar el examen de uno o varios alumnos (`studentId` o `studentIds`). */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "no auth" }, { status: 401 });

  const { id } = await params;
  const ids = readIds(await req.json());
  if (ids.length === 0) return NextResponse.json({ error: "studentId requerido" }, { status: 400 });

  const sb = await getSupabaseServer();
  const { error } = await sb.from("exam_assignments").delete().eq("exam_id", id).in("user_id", ids);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}

/** Ajustar los intentos habilitados de un alumno (re-habilitar = sumar +1). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "no auth" }, { status: 401 });

  const { id } = await params;
  const { studentId, attempts_allowed } = await req.json();
  if (!studentId || typeof attempts_allowed !== "number") {
    return NextResponse.json({ error: "datos inválidos" }, { status: 400 });
  }

  const sb = await getSupabaseServer();
  const { error } = await sb
    .from("exam_assignments")
    .update({ attempts_allowed })
    .eq("exam_id", id)
    .eq("user_id", studentId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
