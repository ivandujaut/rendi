import { notFound } from "next/navigation";
import { requireOnboarded } from "@/lib/profile";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { publicFigureUrl, type Exam, type Question } from "@/lib/types";
import ExamClient from "@/components/ExamClient";
import PracticeClient from "@/components/PracticeClient";

export const dynamic = "force-dynamic";

export default async function ExamPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const { id } = await params;
  const { mode } = await searchParams;
  await requireOnboarded();
  const sb = await getSupabaseServer();

  const { data: exam } = await sb
    .from("exams")
    .select("id, title, year, duration_min, shuffle, student_review, allow_back, pass_mark")
    .eq("id", id)
    .eq("is_published", true)
    .maybeSingle();

  if (!exam) notFound();

  // Las preguntas NO contienen la respuesta correcta (vive en answer_keys,
  // tabla que el alumno no puede leer por RLS).
  const { data: qs } = await sb
    .from("questions")
    .select("id, number, topic, prompt, figure_url, options, kind")
    .eq("exam_id", id)
    .order("number");

  const questions: Question[] = (qs ?? []).map((q) => ({
    ...q,
    kind: q.kind === "open" ? "open" : "mcq",
    options: (Array.isArray(q.options) ? q.options : []).map((o) => String(o)),
    figure_url: publicFigureUrl(q.figure_url),
  }));

  const examData: Exam = exam;

  if (mode === "practice") {
    return <PracticeClient exam={examData} questions={questions} />;
  }
  return <ExamClient exam={examData} questions={questions} />;
}
