import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseServer } from "@/lib/supabaseServer";

/** Asignar el examen a un alumno (lo habilita a verlo y rendirlo). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "no auth" }, { status: 401 });

  const { id } = await params;
  const { studentId } = await req.json();
  if (!studentId) return NextResponse.json({ error: "studentId requerido" }, { status: 400 });

  const sb = await getSupabaseServer();
  const { error } = await sb
    .from("exam_assignments")
    .upsert({ exam_id: id, user_id: studentId }, { onConflict: "exam_id,user_id", ignoreDuplicates: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}

/** Desasignar el examen de un alumno. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "no auth" }, { status: 401 });

  const { id } = await params;
  const { studentId } = await req.json();
  if (!studentId) return NextResponse.json({ error: "studentId requerido" }, { status: 400 });

  const sb = await getSupabaseServer();
  const { error } = await sb.from("exam_assignments").delete().eq("exam_id", id).eq("user_id", studentId);
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
