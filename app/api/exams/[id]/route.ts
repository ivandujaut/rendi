import { NextResponse } from "next/server";
import { z } from "zod";
import { route, dbError } from "@/lib/api/errors";
import { requireTeacher, parseBody } from "@/lib/api/guards";
import type { Json } from "@/lib/db.types";

type Ctx = { params: Promise<{ id: string }> };

/** Editar un simulacro (metadatos siempre; preguntas si no tiene intentos). */
const putSchema = z.object({ title: z.string().min(1) }).passthrough();
export const PUT = route<Ctx>(async (req, { params }) => {
  const { sb } = await requireTeacher();
  const { id } = await params;
  const payload = await parseBody(req, putSchema);

  const { error } = await sb.rpc("update_exam", { p_exam: id, p: payload as Json });
  if (error) dbError("update_exam", error, "No se pudo guardar el simulacro");

  return NextResponse.json({ examId: id });
});

/** Eliminar un simulacro (con sus intentos/respuestas en cascada). */
export const DELETE = route<Ctx>(async (_req, { params }) => {
  const { sb } = await requireTeacher();
  const { id } = await params;

  const { error } = await sb.rpc("delete_exam", { p_exam: id });
  if (error) dbError("delete_exam", error, "No se pudo eliminar el simulacro");

  return NextResponse.json({ ok: true });
});

/** Publicar / despublicar (toggle rápido). */
const patchSchema = z.object({ is_published: z.boolean() });
export const PATCH = route<Ctx>(async (req, { params }) => {
  const { sb } = await requireTeacher();
  const { id } = await params;
  const { is_published } = await parseBody(req, patchSchema);

  const { error } = await sb.from("exams").update({ is_published }).eq("id", id);
  if (error) dbError("publicar/despublicar", error);

  return NextResponse.json({ ok: true });
});
