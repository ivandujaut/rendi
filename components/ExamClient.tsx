"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LETTERS, fmtClock, shuffleIndices, type Exam, type Question } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ActionBar } from "@/components/ui/action-bar";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, ArrowRight01Icon, StarIcon } from "@hugeicons/core-free-icons";

type Phase = "intro" | "running";

export default function ExamClient({ exam, questions }: { exam: Exam; questions: Question[] }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("intro");
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number>(0);
  const [order, setOrder] = useState<number[]>([]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [marks, setMarks] = useState<Record<string, boolean>>({});
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [remaining, setRemaining] = useState(exam.duration_min * 60);
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const submittedRef = useRef(false);

  const total = questions.length;
  const answeredCount = Object.keys(answers).length;

  const start = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examId: exam.id }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "No se pudo iniciar");
      const data = await res.json();
      setAttemptId(data.attemptId);
      setStartedAt(new Date(data.startedAt).getTime());
      // Restaurar respuestas ya guardadas (si se reanuda un intento en curso).
      const restored: Record<string, string> = {};
      (data.responses ?? []).forEach((r: { question_id: string; choice: string }) => {
        if (r.choice) restored[r.question_id] = r.choice;
      });
      setAnswers(restored);
      setOrder(exam.shuffle ? shuffleIndices(total) : Array.from({ length: total }, (_, i) => i));
      setPhase("running");
    } catch (e: any) {
      setError(e.message || "Error al iniciar el examen.");
    }
  }, [exam.id, exam.shuffle, total]);

  // Auto-guardado: persiste cada respuesta apenas se selecciona.
  const saveAnswer = useCallback(
    (questionId: string, choice: string) => {
      if (!attemptId) return;
      setSaveState("saving");
      fetch(`/api/attempts/${attemptId}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question_id: questionId, choice }),
      })
        .then((r) => setSaveState(r.ok ? "saved" : "idle"))
        .catch(() => setSaveState("idle"));
    },
    [attemptId],
  );

  const submit = useCallback(
    async (auto: boolean) => {
      if (submittedRef.current || !attemptId) return;
      submittedRef.current = true;
      setSubmitting(true);
      const responses = Object.entries(answers).map(([question_id, choice]) => ({ question_id, choice }));
      try {
        const res = await fetch(`/api/attempts/${attemptId}/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ responses, auto }),
        });
        if (!res.ok) throw new Error((await res.json()).error || "Error al entregar");
        window.onbeforeunload = null;
        router.push(`/result/${attemptId}`);
      } catch (e: any) {
        submittedRef.current = false;
        setSubmitting(false);
        setError(e.message || "No se pudo entregar el examen.");
      }
    },
    [answers, attemptId, router],
  );

  // Reloj autoritativo desde el servidor (startedAt + duracion).
  useEffect(() => {
    if (phase !== "running") return;
    const end = startedAt + exam.duration_min * 60 * 1000;
    const tick = () => {
      const rem = Math.round((end - Date.now()) / 1000);
      setRemaining(rem);
      if (rem <= 0) submit(true);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [phase, startedAt, exam.duration_min, submit]);

  // Aviso al recargar/cerrar durante el examen.
  useEffect(() => {
    if (phase !== "running") return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.onbeforeunload = () => "";
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [phase]);

  const clockClass = useMemo(() => {
    if (remaining <= 60) return "text-[#FF9AA8] border-[#7a3340] animate-pulse";
    if (remaining <= 300) return "text-[#FFD58A] border-[#6b5121]";
    return "border-[#4d4d4d]";
  }, [remaining]);

  // ---------- INTRO ----------
  if (phase === "intro") {
    return (
      <main className="max-w-2xl mx-auto px-4 py-10">
        <div className="font-mono text-xs tracking-widest uppercase text-cyan2 mb-3">Antes de empezar</div>
        <h1 className="font-disp text-2xl text-ink mb-4">{exam.title}</h1>
        <div className="card p-6 mb-4">
          <ul className="list-disc pl-5 space-y-2 text-[15px]">
            <li>
              <b>{total} preguntas</b> de opción múltiple; una sola correcta (A–E).
            </li>
            <li>
              Tenés <b>{exam.duration_min} minutos</b>. El reloj corre desde que tocás “Iniciar” y al llegar a cero se
              entrega solo.
            </li>
            <li>
              Para los cálculos usá <b>g = 10 m/s²</b>.
            </li>
            <li>No hay penalización por error: conviene responder todo.</li>
            <li>
              Tus respuestas se <b>guardan solas</b>: si recargás o se corta la conexión, podés retomar donde estabas.
            </li>
          </ul>
        </div>
        {error && <p className="text-red2 text-sm mb-3">{error}</p>}
        <Button variant="primary" size="lg" className="w-full" onClick={start}>
          Iniciar examen
        </Button>
      </main>
    );
  }

  // ---------- RUNNING ----------
  const oi = order[idx];
  const q = questions[oi];

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col">
      <div className="sticky top-0 z-30 bg-ink text-[#f2f2f2]">
        <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center gap-4">
          <div>
            <div
              className={`font-mono font-bold text-xl px-3 py-1 rounded-lg bg-[#4d4d4d] border ${clockClass} min-w-[96px] text-center`}
            >
              {fmtClock(remaining)}
            </div>
          </div>
          <div className="text-sm text-grey-300">
            Pregunta <b className="text-white font-mono">{idx + 1}</b>/{total} · Respondidas{" "}
            <b className="text-white font-mono">{answeredCount}</b>
          </div>
          <div className="flex-1 h-[7px] bg-[#4d4d4d] rounded overflow-hidden min-w-[80px]">
            <div
              className="h-full bg-yellow transition-all"
              style={{ width: `${Math.round((answeredCount / total) * 100)}%` }}
            />
          </div>
          <span className="hidden sm:inline text-xs text-grey-300 min-w-[78px] text-right">
            {saveState === "saving" ? "Guardando…" : saveState === "saved" ? "✓ Guardado" : ""}
          </span>
          <Button variant="secondary" size="sm" onClick={() => setConfirming(true)}>
            Finalizar
            <HugeiconsIcon icon={ArrowRight01Icon} />
          </Button>
        </div>
      </div>

      <div className="flex-1 max-w-5xl w-full mx-auto px-4 my-6 grid lg:grid-cols-[1fr_220px] gap-6 items-start">
        <div className="card p-7">
          <div className="flex items-baseline gap-3 mb-1">
            <span className="font-mono font-bold text-cyan2 text-sm">N.º {String(q.number).padStart(2, "0")}</span>
            {q.topic && (
              <Badge variant="outline" className="text-[10px]">
                {q.topic}
              </Badge>
            )}
            <button
              className={`ml-auto inline-flex items-center gap-1 text-xs rounded-lg px-2.5 py-1.5 border ${marks[q.id] ? "text-amber2 border-[#E6C994] bg-[#FBF3E2]" : "text-[#656565] border-grey-200"}`}
              onClick={() => setMarks((m) => ({ ...m, [q.id]: !m[q.id] }))}
            >
              <HugeiconsIcon icon={StarIcon} size={14} />
              {marks[q.id] ? "Marcada" : "Marcar"}
            </button>
          </div>
          <div className="text-[16.5px] leading-relaxed my-3" dangerouslySetInnerHTML={{ __html: q.prompt }} />
          {q.figure_url && (
            <div className="my-4 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={q.figure_url}
                alt={`Figura ${q.number}`}
                className="inline-block max-w-[340px] w-full border border-(--line) rounded-lg"
              />
            </div>
          )}
          <div className="mt-4 flex flex-col gap-2.5">
            {q.options.map((opt, i) => {
              const L = LETTERS[i];
              const sel = answers[q.id] === L;
              return (
                <button
                  key={L}
                  onClick={() => {
                    setAnswers((a) => ({ ...a, [q.id]: L }));
                    saveAnswer(q.id, L);
                  }}
                  className={`flex gap-3 items-start p-3.5 rounded-xl border text-left text-[15px] transition ${sel ? "border-brand bg-[#fff7e0] ring-1 ring-brand" : "border-grey-200 hover:border-brand hover:bg-[#fffdf7]"}`}
                >
                  <span
                    className={`font-mono font-bold text-[13px] rounded-md min-w-[28px] h-7 grid place-items-center border ${sel ? "bg-brand text-ink border-brand" : "text-[#656565] border-grey-200"}`}
                  >
                    {L}
                  </span>
                  <span dangerouslySetInnerHTML={{ __html: opt }} />
                </button>
              );
            })}
          </div>
        </div>

        <div className="lg:sticky lg:top-20">
          <div className="card p-4">
            <h4 className="font-disp text-xs uppercase tracking-wide text-[#656565] mb-3">Navegador</h4>
            <div className="grid grid-cols-6 gap-1.5">
              {order.map((qq, i) => {
                const qid = questions[qq].id;
                const a = answers[qid] != null;
                const m = marks[qid];
                const cur = i === idx;
                return (
                  <button
                    key={i}
                    onClick={() => setIdx(i)}
                    className={`aspect-square rounded-lg border font-mono text-[12.5px] grid place-items-center relative ${a ? "bg-ink text-white border-ink" : "bg-white text-[#656565] border-grey-200"} ${cur ? "ring-2 ring-cyan2 border-cyan2" : ""}`}
                  >
                    {i + 1}
                    {m && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber2" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <ActionBar
        className="sticky bottom-0 z-30"
        contentClassName="max-w-5xl"
        back={
          <Button variant="secondary" disabled={idx === 0} onClick={() => setIdx((i) => i - 1)}>
            <HugeiconsIcon icon={ArrowLeft01Icon} />
            Anterior
          </Button>
        }
      >
        {idx === total - 1 ? (
          <Button variant="primary" onClick={() => setConfirming(true)}>
            Revisar y finalizar
          </Button>
        ) : (
          <Button variant="primary" onClick={() => setIdx((i) => i + 1)}>
            Siguiente
            <HugeiconsIcon icon={ArrowRight01Icon} />
          </Button>
        )}
      </ActionBar>

      {confirming && (
        <div
          className="fixed inset-0 bg-[rgba(10,26,47,.55)] grid place-items-center z-50 p-4"
          onClick={() => setConfirming(false)}
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-disp text-lg text-ink mb-2">¿Finalizar el examen?</h3>
            <p className="text-[#656565] text-sm mb-2">
              Respondiste <b>{answeredCount}</b> de {total}
              {total - answeredCount > 0 ? ` (quedan ${total - answeredCount} sin responder)` : ""}. Una vez que
              entregás no podés cambiar tus respuestas.
            </p>
            {error && <p className="text-red2 text-sm mb-2">{error}</p>}
            <div className="flex gap-2.5 justify-end mt-3">
              <Button variant="secondary" onClick={() => setConfirming(false)} disabled={submitting}>
                Seguir respondiendo
              </Button>
              <Button variant="primary" onClick={() => submit(false)} disabled={submitting}>
                {submitting ? "Entregando…" : "Entregar examen"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
