"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { shuffleIndices } from "@/lib/types";
import { Button, buttonVariants } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { McqCard } from "@/components/McqCard";

export type ReviewQuestion = {
  id: string;
  exam_id: string;
  number: number;
  topic: string | null;
  prompt: string;
  figure_url: string | null;
  options: string[];
};

type Feedback = { correct: string | null; is_correct: boolean; explanation: string | null; nextDue?: string | null };
type Phase = "intro" | "running" | "done";

const OK = "#23925F";

/** "Lo repasás de nuevo en X días" a partir del due_at que devuelve el scheduler Leitner. */
function nextReviewLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const days = Math.max(1, Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000));
  return days === 1 ? "Lo repasás de nuevo mañana." : `Lo repasás de nuevo en ${days} días.`;
}

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
        const res = await fetch("/api/review/answer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attemptId, question_id: q.id, choice: L }),
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
            <li><b>{total} preguntas para repasar hoy</b> (conceptuales que fallaste).</li>
            <li>Respondé y te muestro <b>si acertaste y por qué</b>.</li>
            <li>Cada pregunta <b>vuelve más adelante</b>: si la acertás, dentro de más días; si no, pronto. Así la repasás justo antes de olvidarla.</li>
            <li>Sin nota. Las opciones vienen en otro orden para que no memorices la posición.</li>
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
            Las que acertaste vuelven más adelante; las que fallaste, pronto. Volvé mañana por las que toquen.
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

      <McqCard
        question={q}
        order={ord}
        selectedL={selected[q.id] ?? null}
        feedback={fb ?? null}
        checking={checking}
        onAnswer={answer}
        correctLabel="¡Bien! Re-dominada."
        error={error}
        feedbackExtra={fb?.nextDue ? <p className="text-xs text-grey-600 mt-2">{nextReviewLabel(fb.nextDue)}</p> : undefined}
      />

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
