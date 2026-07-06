"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { LETTERS, shuffleIndices } from "@/lib/types";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, ArrowRight01Icon, CheckmarkCircle02Icon, CancelCircleIcon } from "@hugeicons/core-free-icons";
import { MathText } from "@/components/MathText";

export type ReviewQuestion = {
  id: string;
  exam_id: string;
  number: number;
  topic: string | null;
  prompt: string;
  figure_url: string | null;
  options: string[];
};

type Feedback = { correct: string | null; is_correct: boolean; explanation: string | null };
type Phase = "intro" | "running" | "done";

const OK = "#23925F";
const BAD = "#D24B5E";

/**
 * Repaso de errores (active recall): re-pregunta las conceptuales que fallaste,
 * cruzando exámenes. Cada respuesta se guarda en un intento de práctica FRESCO por
 * examen (forceNew) para que sea tu "última respuesta" y actualice el dominio. Baraja
 * opciones y da feedback + explicación por pregunta. Solo MCQ conceptuales (la cola las filtra).
 */
export default function ReviewClient({ questions }: { questions: ReviewQuestion[] }) {
  const total = questions.length;
  const [phase, setPhase] = useState<Phase>("intro");
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Record<string, Feedback>>({});
  const [optionOrders, setOptionOrders] = useState<Record<string, number[]>>({});
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const attemptByExam = useRef<Record<string, string>>({}); // intento de práctica fresco por examen

  const q = questions[idx];
  const fb = q ? feedback[q.id] : undefined;
  const correctCount = Object.values(feedback).filter((f) => f.is_correct).length;

  const start = () => {
    const orders: Record<string, number[]> = {};
    questions.forEach((qq) => (orders[qq.id] = shuffleIndices(qq.options.length)));
    setOptionOrders(orders);
    setPhase("running");
  };

  const ensureAttempt = useCallback(async (examId: string): Promise<string> => {
    if (attemptByExam.current[examId]) return attemptByExam.current[examId];
    const res = await fetch("/api/attempts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ examId, mode: "practice", forceNew: true }),
    });
    if (!res.ok) throw new Error((await res.json()).error || "No se pudo iniciar el repaso");
    const data = await res.json();
    attemptByExam.current[examId] = data.attemptId;
    return data.attemptId;
  }, []);

  const answer = useCallback(
    async (L: string) => {
      if (!q || feedback[q.id] || checking) return;
      setSelected((s) => ({ ...s, [q.id]: L }));
      setChecking(true);
      setError("");
      try {
        const attemptId = await ensureAttempt(q.exam_id);
        const res = await fetch(`/api/attempts/${attemptId}/answer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question_id: q.id, choice: L }),
        });
        if (!res.ok) throw new Error((await res.json()).error || "Error");
        const data: Feedback = await res.json();
        setFeedback((f) => ({ ...f, [q.id]: data }));
      } catch (e) {
        setSelected((s) => {
          const n = { ...s };
          delete n[q.id];
          return n;
        });
        setError(e instanceof Error ? e.message : "No se pudo verificar la respuesta.");
      } finally {
        setChecking(false);
      }
    },
    [q, feedback, checking, ensureAttempt],
  );

  // ---------- INTRO ----------
  if (phase === "intro") {
    return (
      <main className="max-w-2xl mx-auto px-4 py-10">
        <div className="font-mono text-xs tracking-widest uppercase text-cyan2 mb-3">Repasar mis errores</div>
        <h1 className="font-disp text-2xl text-ink mb-4">Retrieval practice</h1>
        <div className="card p-6 mb-4">
          <ul className="list-disc pl-5 space-y-2 text-[15px]">
            <li><b>{total} preguntas conceptuales</b> que fallaste y todavía no re-dominaste.</li>
            <li>Respondé y te muestro <b>si acertaste y por qué</b>. Si la acertás, sale de tu lista.</li>
            <li>Sin nota. Las opciones vienen <b>en otro orden</b> para que no memorices la posición.</li>
          </ul>
        </div>
        <Button variant="primary" size="lg" className="w-full" onClick={start}>
          Empezar repaso
        </Button>
        <div className="mt-3">
          <Link href="/plan" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            <HugeiconsIcon icon={ArrowLeft01Icon} />
            Volver al plan
          </Link>
        </div>
      </main>
    );
  }

  // ---------- DONE ----------
  if (phase === "done") {
    const done = Object.keys(feedback).length;
    return (
      <main className="max-w-2xl mx-auto px-4 py-10">
        <div className="card p-7 text-center">
          <div className="font-mono text-xs uppercase tracking-widest text-cyan2 mb-2">Repaso terminado</div>
          <h1 className="font-disp text-3xl text-ink mb-1">
            {correctCount}/{done} re-dominadas
          </h1>
          <p className="text-[#656565] text-sm mb-5">
            Las que acertaste salen de tu lista de errores. Las que no, van a volver a aparecer.
          </p>
          <div className="flex gap-2 justify-center flex-wrap">
            <Link href="/plan" className={buttonVariants({ variant: "secondary" })}>
              <HugeiconsIcon icon={ArrowLeft01Icon} />
              Volver al plan
            </Link>
            <Link href="/exams" className={buttonVariants({ variant: "primary" })}>
              Ir a los simulacros
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // ---------- RUNNING ----------
  if (!q) return null;
  const isLast = idx === total - 1;
  const ord = optionOrders[q.id] ?? q.options.map((_, i) => i);
  const correctDisplayL = fb?.correct
    ? LETTERS[ord.indexOf((LETTERS as readonly string[]).indexOf(fb.correct))]
    : null;

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-4 flex items-center justify-between text-sm text-[#656565]">
        <span>
          Repaso <b className="font-mono text-ink">{idx + 1}</b>/{total}
        </span>
        <span>
          <b className="font-mono" style={{ color: OK }}>{correctCount}</b> re-dominadas
        </span>
      </div>
      <div className="h-1.5 rounded bg-[#f2f2f2] overflow-hidden mb-6">
        <div className="h-full rounded bg-brand" style={{ width: `${Math.round(((idx + (fb ? 1 : 0)) / total) * 100)}%` }} />
      </div>

      <div className="card p-7">
        <div className="flex items-baseline gap-3 mb-1">
          <span className="font-mono font-bold text-cyan2 text-sm">N.º {String(q.number).padStart(2, "0")}</span>
          {q.topic && <Badge variant="outline" className="text-[10px]">{q.topic}</Badge>}
        </div>
        <div className="text-[16.5px] leading-relaxed my-3" dangerouslySetInnerHTML={{ __html: q.prompt }} />
        {q.figure_url && (
          <div className="my-4 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={q.figure_url} alt={`Figura ${q.number}`} className="inline-block max-w-[340px] w-full border border-(--line) rounded-lg" />
          </div>
        )}

        <div className="mt-4 flex flex-col gap-2.5">
          {ord.map((origIdx, i) => {
            const displayL = LETTERS[i];
            const L = LETTERS[origIdx];
            const opt = q.options[origIdx];
            const isSel = selected[q.id] === L;
            const isCorrect = !!fb && fb.correct === L;
            const isWrongSel = !!fb && isSel && !fb.is_correct;
            const isPending = isSel && checking && !fb;
            const style = isCorrect
              ? { borderColor: OK, background: "#eaf6f0" }
              : isWrongSel
                ? { borderColor: BAD, background: "#fbecee" }
                : undefined;
            return (
              <button
                key={displayL}
                disabled={!!fb || checking}
                onClick={() => answer(L)}
                style={style}
                className={`flex gap-3 items-start p-3.5 rounded-xl border text-left text-[15px] transition ${
                  isPending
                    ? "border-brand bg-[#fff7e0] ring-1 ring-brand"
                    : !fb
                      ? "border-grey-200 hover:border-brand hover:bg-[#fffdf7]"
                      : "border-grey-200"
                } ${fb && !isCorrect && !isWrongSel ? "opacity-55" : ""} ${!fb ? "cursor-pointer" : "cursor-default"}`}
              >
                <span
                  className="font-mono font-bold text-[13px] rounded-md min-w-[28px] h-7 grid place-items-center border text-[#656565] border-grey-200"
                  style={isCorrect ? { color: OK, borderColor: OK } : isWrongSel ? { color: BAD, borderColor: BAD } : undefined}
                >
                  {displayL}
                </span>
                <span dangerouslySetInnerHTML={{ __html: opt }} />
                {isPending && (
                  <span
                    role="status"
                    aria-label="Verificando tu respuesta"
                    className="ml-auto h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-brand border-t-transparent"
                  />
                )}
                {isCorrect && <HugeiconsIcon icon={CheckmarkCircle02Icon} size={20} color={OK} className="ml-auto shrink-0" />}
                {isWrongSel && <HugeiconsIcon icon={CancelCircleIcon} size={20} color={BAD} className="ml-auto shrink-0" />}
              </button>
            );
          })}
        </div>

        {fb && (
          <div className="mt-4 rounded-xl border border-grey-100 bg-[#fafafa] p-4">
            <p className="text-sm font-semibold mb-1" style={{ color: fb.is_correct ? OK : BAD }}>
              {fb.is_correct ? "¡Bien! Re-dominada." : `Incorrecto. La correcta es ${correctDisplayL ?? "s/d"}`}
            </p>
            {fb.explanation ? (
              <p className="text-[14px] leading-relaxed text-ink2">
                <MathText>{fb.explanation}</MathText>
              </p>
            ) : (
              <p className="text-[13px] text-grey-600">Sin explicación cargada para esta pregunta.</p>
            )}
          </div>
        )}
        {error && <p className="text-red2 text-sm mt-3">{error}</p>}
      </div>

      <div className="mt-5 flex justify-end">
        {isLast ? (
          <Button variant="primary" disabled={!fb} onClick={() => setPhase("done")}>
            Ver resumen
          </Button>
        ) : (
          <Button variant="primary" disabled={!fb} onClick={() => setIdx((i) => i + 1)}>
            Siguiente
            <HugeiconsIcon icon={ArrowRight01Icon} />
          </Button>
        )}
      </div>
    </main>
  );
}
