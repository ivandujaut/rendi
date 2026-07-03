import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabaseServer";
import { fmtClock, type PerTopic } from "@/lib/types";
import { buttonVariants } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";

export const dynamic = "force-dynamic";

export default async function ResultPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  const sb = await getSupabaseServer();

  const { data: a } = await sb
    .from("attempts")
    .select("id, score, total, per_topic, started_at, submitted_at, auto, exam_id, exams(title, duration_min, pass_mark, student_review)")
    .eq("id", attemptId)
    .maybeSingle();

  if (!a || a.score == null) notFound();

  const exam = a.exams;
  const pct = a.total ? Math.round((a.score / a.total) * 100) : 0;
  const durationSec = a.submitted_at
    ? Math.round((new Date(a.submitted_at).getTime() - new Date(a.started_at).getTime()) / 1000)
    : 0;
  const perTopic = (a.per_topic ?? {}) as PerTopic;
  const topics = Object.entries(perTopic).sort((x, y) => y[1].ok / y[1].tot - x[1].ok / x[1].tot);
  const passed = pct >= (exam?.pass_mark ?? 60);

  // Revisión: solo si el docente la habilitó (la función valida del lado servidor).
  let review: Awaited<ReturnType<typeof sb.rpc<"get_attempt_review">>>["data"] = [];
  if (exam?.student_review) {
    const { data: rev } = await sb.rpc("get_attempt_review", { p_attempt: attemptId });
    review = rev ?? [];
  }

  // Devolución de desarrollo: solo lo que el docente aprobó (la RLS de ai_gradings ya
  // filtra a estado='approved' para el alumno, así que un borrador no aprobado ni
  // aparece). Se muestra apenas está, sin depender de student_review (que es de MCQ).
  const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
  const { data: openRaw } = await sb
    .from("open_responses")
    .select("answer_text, questions(number, prompt, topic), ai_gradings(feedback_borrador, temas_flojos, estado)")
    .eq("attempt_id", attemptId);
  const openFeedback = (openRaw ?? [])
    .map((r) => {
      const q = one(r.questions);
      const g = one(r.ai_gradings);
      return { number: q?.number ?? 0, topic: q?.topic ?? null, answer: r.answer_text, grading: g };
    })
    .filter((r) => r.grading?.estado === "approved")
    .sort((a, b) => a.number - b.number);

  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      <div className="card p-7 flex items-center gap-6 flex-wrap">
        <div
          className="w-32 h-32 rounded-full grid place-items-center relative shrink-0"
          style={{ background: `conic-gradient(${passed ? "#23925F" : "#D9912A"} ${pct}%, #f2f2f2 0)` }}
        >
          <div className="absolute inset-3 bg-white rounded-full" />
          <div className="relative text-center">
            <div className="font-disp text-3xl text-ink">{a.score}/{a.total}</div>
            <div className="font-mono text-xs text-[#656565]">{pct}%</div>
          </div>
        </div>
        <div>
          <div className="font-mono text-xs uppercase tracking-widest" style={{ color: passed ? "#23925F" : "#D9912A" }}>
            {a.auto ? "Tiempo agotado · entregado" : "Examen entregado"}
          </div>
          <h1 className="font-disp text-2xl text-ink my-1">{a.score} respuestas correctas</h1>
          <div className="text-sm text-[#656565]">Tiempo utilizado: <b className="font-mono text-ink">{fmtClock(durationSec)}</b></div>
          <div className="text-sm text-[#656565]">{exam?.title}</div>
        </div>
      </div>

      <div className="card p-6 mt-4">
        <h3 className="font-disp text-base text-ink mb-1">Tu desempeño por tema</h3>
        <p className="text-sm text-[#656565] mb-3">Dónde estuviste más sólido y dónde conviene reforzar.</p>
        <div>
          {topics.map(([t, v]) => {
            const p = Math.round((v.ok / v.tot) * 100);
            const col = p >= 70 ? "#23925F" : p >= 40 ? "#D9912A" : "#D24B5E";
            return (
              <div key={t} className="flex items-center gap-3 my-2">
                <div className="w-40 text-sm text-ink2 shrink-0">{t}</div>
                <div className="flex-1 h-2.5 bg-[#f2f2f2] rounded overflow-hidden">
                  <div className="h-full rounded" style={{ width: `${p}%`, background: col }} />
                </div>
                <div className="font-mono text-xs text-[#656565] w-14 text-right">{v.ok}/{v.tot}</div>
              </div>
            );
          })}
        </div>
      </div>

      {review.length > 0 && (
        <div className="card p-6 mt-4">
          <h3 className="font-disp text-base text-ink mb-3">Revisión</h3>
          <div className="flex flex-col gap-2">
            {review.map((r) => (
              <div key={r.number} className="text-[13.5px] p-2.5 border border-[#f2f2f2] rounded-lg">
                <div className="flex items-center gap-3">
                  <b className="font-mono w-9">{String(r.number).padStart(2, "0")}</b>
                  <span className="flex-1 text-[#656565]">{r.topic}</span>
                  <span className="font-mono">Tu resp.: <b style={{ color: r.is_correct ? "#23925F" : "#D24B5E" }}>{r.your_choice || "—"}</b></span>
                  <span className="font-mono">Correcta: <b className="text-green2">{r.correct}</b></span>
                </div>
                {r.explanation && <p className="mt-2 pl-12 text-[13px] text-[#656565] leading-relaxed">{r.explanation}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {openFeedback.length > 0 && (
        <div className="card p-6 mt-4">
          <h3 className="font-disp text-base text-ink mb-1">Devolución de desarrollo</h3>
          <p className="text-sm text-[#656565] mb-3">Corrección de tus respuestas de desarrollo, revisada por el docente.</p>
          <div className="flex flex-col gap-3">
            {openFeedback.map((r) => (
              <div key={r.number} className="p-3.5 border border-[#f2f2f2] rounded-lg">
                <div className="flex items-center gap-2 mb-1.5">
                  <b className="font-mono text-sm">{String(r.number).padStart(2, "0")}</b>
                  {r.topic && <span className="text-xs text-[#656565]">{r.topic}</span>}
                </div>
                <p className="text-[14px] leading-relaxed text-ink2 whitespace-pre-wrap">{r.grading!.feedback_borrador}</p>
                {r.grading!.temas_flojos.length > 0 && (
                  <div className="mt-2 text-xs text-[#656565]">
                    Para repasar: <b className="text-ink2">{r.grading!.temas_flojos.join(", ")}</b>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 flex gap-2 flex-wrap">
        <Link href="/exams" className={buttonVariants({ variant: "secondary" })}><HugeiconsIcon icon={ArrowLeft01Icon} />Volver a los simulacros</Link>
        <Link href="/plan" className={buttonVariants({ variant: "primary" })}>Ver mi plan de repaso</Link>
      </div>
    </main>
  );
}
