import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOnboarded } from "@/lib/profile";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { GradingQueue, type GradingItem } from "@/components/GradingQueue";
import { GradeNowButton } from "@/components/GradeNowButton";
import { buttonVariants } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";

export const dynamic = "force-dynamic";

type Embedded = {
  id: string;
  answer_text: string;
  questions: { number: number; prompt: string; rubrica: string | null; topic: string | null } | null;
  attempts: { profiles: { full_name: string | null; group_name: string | null } | null } | null;
  ai_gradings:
    | { id: string; estado: string; feedback_borrador: string | null; temas_flojos: string[]; was_edited: boolean }
    | { id: string; estado: string; feedback_borrador: string | null; temas_flojos: string[]; was_edited: boolean }[]
    | null;
};

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

export default async function GradingQueuePage({ params }: { params: Promise<{ examId: string }> }) {
  const { examId } = await params;
  const { role } = await requireOnboarded();
  if (role !== "teacher") notFound();

  const sb = await getSupabaseServer();

  const { data: exam } = await sb.from("exams").select("title").eq("id", examId).maybeSingle();
  if (!exam) notFound();

  // Lista de exámenes para el selector (cambiar de examen sin volver al panel).
  const { data: exams } = await sb.from("exams").select("id, title").order("title");

  // Respuestas de desarrollo de intentos entregados de este examen, con su borrador de IA.
  const { data } = await sb
    .from("open_responses")
    .select(
      "id, answer_text, questions!inner(number, prompt, rubrica, topic), attempts!inner(exam_id, submitted_at, profiles(full_name, group_name)), ai_gradings(id, estado, feedback_borrador, temas_flojos, was_edited)",
    )
    .eq("attempts.exam_id", examId)
    .not("attempts.submitted_at", "is", null);

  const items: GradingItem[] = ((data ?? []) as unknown as Embedded[])
    .map((r): GradingItem => {
      const g = one(r.ai_gradings);
      const prof = r.attempts?.profiles ?? null;
      return {
        openResponseId: r.id,
        gradingId: g?.id ?? null,
        number: r.questions?.number ?? 0,
        prompt: r.questions?.prompt ?? "",
        rubrica: r.questions?.rubrica ?? null,
        topic: r.questions?.topic ?? null,
        student: prof?.full_name ?? "s/d",
        group: prof?.group_name ?? null,
        answer: r.answer_text,
        estado: (g?.estado as GradingItem["estado"]) ?? "sin_corregir",
        feedback: g?.feedback_borrador ?? "",
        temas: g?.temas_flojos ?? [],
        wasEdited: g?.was_edited ?? false,
      };
    })
    // Por revisar primero (pending/failed/sin_corregir), luego resueltos; dentro, por N.º.
    .sort((a, b) => rank(a.estado) - rank(b.estado) || a.number - b.number || a.student.localeCompare(b.student, "es"));

  // Respuestas que la IA todavía no tocó (sin fila ai_gradings) → habilitan el disparo on-demand.
  const sinCorregir = items.filter((i) => i.estado === "sin_corregir").length;

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <Link
        href={`/teacher?exam=${examId}`}
        className="font-mono text-xs text-grey-600 hover:text-ink inline-flex items-center gap-1 mb-3"
      >
        <HugeiconsIcon icon={ArrowLeft01Icon} size={14} />
        Volver al panel
      </Link>
      <h1 className="font-disp text-2xl text-ink mb-1">Corrección de desarrollo</h1>
      <p className="text-sm text-grey-600 mb-6">
        {exam.title} · Revisá cada borrador de la IA, editalo si hace falta y aprobalo o rechazalo. Vos ponés la
        corrección final; el alumno solo ve lo que aprobás.
      </p>

      {items.length === 0 ? (
        <div className="card p-10 text-center text-grey-600">
          Este simulacro no tiene respuestas de desarrollo entregadas todavía.
        </div>
      ) : (
        <>
          {sinCorregir > 0 && <GradeNowButton examId={examId} pending={sinCorregir} />}
          <GradingQueue items={items} examId={examId} exams={exams ?? []} />
        </>
      )}

      <div className="mt-6">
        <Link href={`/teacher?exam=${examId}`} className={buttonVariants({ variant: "secondary" })}>
          <HugeiconsIcon icon={ArrowLeft01Icon} />
          Volver al panel
        </Link>
      </div>
    </main>
  );
}

// Orden de prioridad: lo que necesita acción del docente primero.
function rank(estado: GradingItem["estado"]): number {
  switch (estado) {
    case "pending":
      return 0;
    case "failed":
      return 1;
    case "sin_corregir":
      return 2;
    case "approved":
      return 3;
    case "rejected":
      return 4;
  }
}
