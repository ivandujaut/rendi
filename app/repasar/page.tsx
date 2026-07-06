import { redirect } from "next/navigation";
import { requireOnboarded } from "@/lib/profile";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { publicFigureUrl } from "@/lib/types";
import ReviewClient, { type ReviewQuestion } from "@/components/ReviewClient";

export const dynamic = "force-dynamic";

export default async function RepasarPage() {
  await requireOnboarded();
  const sb = await getSupabaseServer();

  // Cola de errores: conceptuales cuya última respuesta fue incorrecta (el RPC filtra
  // por el alumno actual y no devuelve la clave).
  const { data } = await sb.rpc("get_review_queue", { p_limit: 30 });
  const questions: ReviewQuestion[] = (data ?? []).map((q) => ({
    id: q.id,
    exam_id: q.exam_id,
    number: q.number,
    topic: q.topic,
    prompt: q.prompt,
    figure_url: publicFigureUrl(q.figure_url),
    options: (Array.isArray(q.options) ? q.options : []).map((o) => String(o)),
  }));

  if (questions.length === 0) redirect("/plan");

  return <ReviewClient questions={questions} />;
}
