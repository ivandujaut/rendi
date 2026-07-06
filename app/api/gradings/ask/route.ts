import { NextResponse } from "next/server";
import { z } from "zod";
import { route, ApiError } from "@/lib/api/errors";
import { requireTeacher, parseBody } from "@/lib/api/guards";
import { askAboutOpenAnswer } from "@/lib/domain/grading";

/**
 * "Preguntá a la IA" sobre una respuesta puntual (Slice 2). El docente hace una consulta
 * ("¿está bien el paso 3?", "hacé la devolución más corta") y la IA responde con el
 * contexto de esa respuesta. Solo docente; no persiste nada (respuesta efímera que el
 * docente puede usar como devolución si quiere). Lee con el cliente RLS del docente.
 */
const bodySchema = z.object({
  openResponseId: z.string().min(1),
  question: z.string().trim().min(1).max(1000),
});

type Embed = {
  answer_text: string;
  questions: { prompt: string; rubrica: string | null } | { prompt: string; rubrica: string | null }[] | null;
  ai_gradings: { feedback_borrador: string | null } | { feedback_borrador: string | null }[] | null;
};
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

export const POST = route(async (req) => {
  const { sb } = await requireTeacher();
  const { openResponseId, question } = await parseBody(req, bodySchema);

  const { data } = await sb
    .from("open_responses")
    .select("answer_text, questions(prompt, rubrica), ai_gradings(feedback_borrador)")
    .eq("id", openResponseId)
    .maybeSingle();
  if (!data) throw new ApiError(404, "respuesta no encontrada");

  const r = data as unknown as Embed;
  const q = one(r.questions);
  const g = one(r.ai_gradings);

  const res = await askAboutOpenAnswer({
    enunciado: q?.prompt ?? "",
    rubrica: q?.rubrica ?? null,
    respuesta: r.answer_text,
    borrador: g?.feedback_borrador ?? null,
    pregunta: question,
  });
  if (res.status === "failed") throw new ApiError(502, `La IA no pudo responder: ${res.error}`);

  return NextResponse.json({ answer: res.answer });
});
