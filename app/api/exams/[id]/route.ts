import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseServer } from "@/lib/supabaseServer";

/** Editar un simulacro (metadatos siempre; preguntas si no tiene intentos). */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "no auth" }, { status: 401 });

  const { id } = await params;
  const payload = await req.json();
  if (!payload?.title) return NextResponse.json({ error: "Falta el título." }, { status: 400 });

  const sb = await getSupabaseServer();
  const { error } = await sb.rpc("update_exam", { p_exam: id, p: payload });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ examId: id });
}

/** Eliminar un simulacro (con sus intentos/respuestas en cascada). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "no auth" }, { status: 401 });

  const { id } = await params;
  const sb = await getSupabaseServer();
  const { error } = await sb.rpc("delete_exam", { p_exam: id });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}

/** Publicar / despublicar (toggle rápido, vía RLS de docente). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "no auth" }, { status: 401 });

  const { id } = await params;
  const { is_published } = await req.json();
  if (typeof is_published !== "boolean") {
    return NextResponse.json({ error: "is_published requerido" }, { status: 400 });
  }

  const sb = await getSupabaseServer();
  const { error } = await sb.from("exams").update({ is_published }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
