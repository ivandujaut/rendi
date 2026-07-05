"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { LETTERS, type Exam, type Question } from "@/lib/types";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";

type Feedback = { correct: string | null; is_correct: boolean; explanation: string | null };
type Phase = "intro" | "running" | "done";

const OK = "#23925F";
const BAD = "#D24B5E";

/**
 * Modo Práctica: mismas preguntas del examen, sin cronómetro y con feedback
 * inmediato (correcta + explicación) después de cada respuesta. No cuenta para la
 * nota; la primera respuesta se persiste para la señal de temas flojos del docente.
 * Solo MCQ — las de desarrollo no tienen corrección automática.
 */
export default function PracticeClient({ exam, questions }: { exam: Exam; questions: Question[] }) {
  const mcq = useMemo(() => questions.filter((q) => q.kind !== "open"), [questions]);
  const total = mcq.length;

  const [phase, setPhase] = useState<Phase>("intro");
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Record<string, Feedback>>({});
  const [starting, setStarting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  const q = mcq[idx];
  const fb = q ? feedback[q.id] : undefined;
  const answeredCount = Object.keys(feedback).length;
  const correctCount = Object.values(feedback).filter((f) => f.is_correct).length;

  const start = useCallback(async () => {
    setError("");
    setStarting(true);
    try {
      const res = await fetch("/api/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examId: exam.id, mode: "practice" }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "No se pudo iniciar");
      const data = await res.json();
      setAttemptId(data.attemptId);
      setPhase("running");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al iniciar la práctica.");
    } finally {
      setStarting(false);
    }
  }, [exam.id]);

  const answer = useCallback(
    async (L: string) => {
      if (!attemptId || !q || feedback[q.id] || checking) return;
      setSelected((s) => ({ ...s, [q.id]: L }));
      setChecking(true);
      setError("");
      try {
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
    [attemptId, q, feedback, checking],
  );

  // ---------- INTRO ----------
  if (phase === "intro") {
    return (
      <main className="max-w-2xl mx-auto px-4 py-10">
        <div className="font-mono text-xs tracking-widest uppercase text-cyan2 mb-3">Modo práctica</div>
        <h1 className="font-disp text-2xl text-ink mb-4">{exam.title}</h1>
        <div className="card p-6 mb-4">
          <ul className="list-disc pl-5 space-y-2 text-[15px]">
            <li><b>{total} preguntas</b> de opción múltiple, sin límite de tiempo.</li>
            <li>Después de cada respuesta te muestro <b>si acertaste y la explicación</b>.</li>
            <li><b>No cuenta para tu nota</b> — es para estudiar y ver dónde flojeás.</li>
          </ul>
        </div>
        {error && <p className="text-red2 text-sm mb-3">{error}</p>}
        {total === 0 ? (
          <p className="text-grey-600 text-sm">Este simulacro no tiene preguntas de opción múltiple para practicar.</p>
        ) : (
          <Button variant="primary" size="lg" className="w-full" onClick={start} loading={starting}>
            Empezar práctica
          </Button>
        )}
        <div className="mt-3">
          <Link href="/exams" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            <HugeiconsIcon icon={ArrowLeft01Icon} />
            Volver a los simulacros
          </Link>
        </div>
      </main>
    );
  }

  // ---------- DONE ----------
  if (phase === "done") {
    const pct = answeredCount ? Math.round((correctCount / answeredCount) * 100) : 0;
    return (
      <main className="max-w-2xl mx-auto px-4 py-10">
        <div className="card p-7 text-center">
          <div className="font-mono text-xs uppercase tracking-widest text-cyan2 mb-2">Práctica terminada</div>
          <h1 className="font-disp text-3xl text-ink mb-1">
            {correctCount}/{answeredCount} correctas
          </h1>
          <p className="text-[#656565] text-sm mb-5">{pct}% en esta práctica. Sin nota — lo importante es lo que repasaste.</p>
          <div className="flex gap-2 justify-center flex-wrap">
            <Link href="/exams" className={buttonVariants({ variant: "secondary" })}>
              <HugeiconsIcon icon={ArrowLeft01Icon} />
              Volver a los simulacros
            </Link>
            <button
              className={buttonVariants({ variant: "primary" })}
              onClick={() => {
                setPhase("intro");
                setIdx(0);
                setSelected({});
                setFeedback({});
                setAttemptId(null);
              }}
            >
              Practicar de nuevo
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ---------- RUNNING ----------
  if (!q) return null;
  const isLast = idx === total - 1;

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-4 flex items-center justify-between text-sm text-[#656565]">
        <span>
          Pregunta <b className="font-mono text-ink">{idx + 1}</b>/{total}
        </span>
        <span>
          <b className="font-mono" style={{ color: OK }}>{correctCount}</b> correctas
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
          {q.options.map((opt, i) => {
            const L = LETTERS[i];
            const isSel = selected[q.id] === L;
            const isCorrect = !!fb && fb.correct === L;
            const isWrongSel = !!fb && isSel && !fb.is_correct;
            const style = isCorrect
              ? { borderColor: OK, background: "#eaf6f0" }
              : isWrongSel
                ? { borderColor: BAD, background: "#fbecee" }
                : undefined;
            return (
              <button
                key={L}
                data-testid={`practice-option-${L}`}
                disabled={!!fb || checking}
                onClick={() => answer(L)}
                style={style}
                className={`flex gap-3 items-start p-3.5 rounded-xl border text-left text-[15px] transition ${
                  !fb ? "border-grey-200 hover:border-brand hover:bg-[#fffdf7]" : "border-grey-200"
                } ${fb && !isCorrect && !isWrongSel ? "opacity-55" : ""} ${!fb ? "cursor-pointer" : "cursor-default"}`}
              >
                <span
                  className="font-mono font-bold text-[13px] rounded-md min-w-[28px] h-7 grid place-items-center border text-[#656565] border-grey-200"
                  style={isCorrect ? { color: OK, borderColor: OK } : isWrongSel ? { color: BAD, borderColor: BAD } : undefined}
                >
                  {L}
                </span>
                <span dangerouslySetInnerHTML={{ __html: opt }} />
                {isCorrect && <span className="ml-auto font-bold" style={{ color: OK }}>✓</span>}
                {isWrongSel && <span className="ml-auto font-bold" style={{ color: BAD }}>✗</span>}
              </button>
            );
          })}
        </div>

        {fb && (
          <div className="mt-4 rounded-xl border border-grey-100 bg-[#fafafa] p-4">
            <p className="text-sm font-semibold mb-1" style={{ color: fb.is_correct ? OK : BAD }}>
              {fb.is_correct ? "¡Correcto!" : `Incorrecto — la correcta es ${fb.correct ?? "—"}`}
            </p>
            {fb.explanation ? (
              <p className="text-[14px] leading-relaxed text-ink2">{fb.explanation}</p>
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
