import { notFound } from "next/navigation";
import { requireOnboarded } from "@/lib/profile";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { publicFigureUrl, type Exam, type Question } from "@/lib/types";
import ExamClient from "@/components/ExamClient";

export const dynamic = "force-dynamic";

export default async function ExamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireOnboarded();
  const sb = await getSupabaseServer();

  const { data: exam } = await sb
    .from("exams")
    .select("id, title, year, duration_min, shuffle, student_review, pass_mark")
    .eq("id", id)
    .eq("is_published", true)
    .maybeSingle();

  if (!exam) notFound();

  // Las preguntas NO contienen la respuesta correcta (vive en answer_keys,
  // tabla que el alumno no puede leer por RLS).
  const { data: qs } = await sb
    .from("questions")
    .select("id, number, topic, prompt, figure_url, options")
    .eq("exam_id", id)
    .order("number");

  const questions: Question[] = (qs ?? []).map((q: any) => ({
    ...q,
    figure_url: publicFigureUrl(q.figure_url),
  }));

  return <ExamClient exam={exam as Exam} questions={questions} />;
}
