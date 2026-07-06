import Link from "next/link";
import { notFound } from "next/navigation";
import { ensureProfile, getRole } from "@/lib/profile";
import { getSupabaseServer } from "@/lib/supabaseServer";
import ExamBuilder, { type ExamBuilderInitial } from "@/components/ExamBuilder";
import { buttonVariants } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function EditExamPage({ params }: { params: Promise<{ id: string }> }) {
  await ensureProfile();
  const role = await getRole();
  if (role !== "teacher") {
    return (
      <main className="max-w-xl mx-auto px-4 py-16 text-center">
        <h1 className="font-disp text-2xl text-ink mb-2">Acceso restringido</h1>
        <p className="text-[#656565] mb-6">Esta sección es para docentes.</p>
        <Link href="/exams" className={buttonVariants({ variant: "secondary" })}>← Volver</Link>
      </main>
    );
  }

  const { id } = await params;
  const sb = await getSupabaseServer();

  const { data: exam } = await sb
    .from("exams")
    .select("id, title, year, duration_min, shuffle, student_review, allow_back, pass_mark, is_published")
    .eq("id", id)
    .maybeSingle();
  if (!exam) notFound();

  const { data: questions } = await sb
    .from("questions")
    .select("id, number, topic, prompt, figure_url, options, explanation, nature")
    .eq("exam_id", id)
    .order("number");

  const ids = (questions ?? []).map((q) => q.id);
  const { data: keys } = ids.length
    ? await sb.from("answer_keys").select("question_id, correct").in("question_id", ids)
    : { data: [] as { question_id: string; correct: string }[] };
  const keyMap = new Map((keys ?? []).map((k) => [k.question_id, k.correct]));

  const { count } = await sb
    .from("attempts")
    .select("id", { count: "exact", head: true })
    .eq("exam_id", id);
  const hasAttempts = (count ?? 0) > 0;

  const initial: ExamBuilderInitial = {
    title: exam.title ?? "",
    year: exam.year != null ? String(exam.year) : "",
    durationMin: String(exam.duration_min ?? 40),
    shuffle: exam.shuffle,
    studentReview: exam.student_review,
    allowBack: exam.allow_back,
    isPublished: exam.is_published,
    passMark: String(exam.pass_mark ?? 60),
    questions: (questions ?? []).map((q) => {
      const opts = (Array.isArray(q.options) ? q.options : []).map((o) => String(o));
      while (opts.length < 5) opts.push("");
      return {
        topic: q.topic ?? "",
        prompt: q.prompt ?? "",
        options: opts.slice(0, 5),
        correct: keyMap.get(q.id) ?? "A",
        explanation: q.explanation ?? "",
        nature: q.nature === "numeric" ? "numeric" : "conceptual",
        figure_url: q.figure_url ?? null,
        figureName: q.figure_url ? q.figure_url.split("/").pop()! : null,
      };
    }),
  };

  return <ExamBuilder examId={id} initial={initial} hasAttempts={hasAttempts} />;
}
