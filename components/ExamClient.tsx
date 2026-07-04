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
  // Respuestas de desarrollo (kind='open'): texto libre, separado de los choices MCQ.
  // No se auto-guardan (a diferencia del MCQ); se persisten al entregar.
  const [openAnswers, setOpenAnswers] = useState<Record<string, string>>({});
  const [marks, setMarks] = useState<Record<string, boolean>>({});
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [remaining, setRemaining] = useState(exam.duration_min * 60);
  const [submitting, setSubmitting] = useState(false);
  const [starting, setStarting] = useState(false);
  const [eliminated, setEliminated] = useState<Record<string, string[]>>({});
  const [timerHidden, setTimerHidden] = useState(false);
  const [timeWarning, setTimeWarning] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [timeUp, setTimeUp] = useState(false);
  const [autoSubmitted, setAutoSubmitted] = useState(false);
  const submittedRef = useRef(false);
  const firedRef = useRef(false);
  const warnedRef = useRef<Set<number>>(new Set());
  // Timers de debounce del autoguardado de desarrollo, por pregunta.
  const openSaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const total = questions.length;
  const openAnsweredCount = Object.values(openAnswers).filter((t) => t.trim() !== "").length;
  const answeredCount = Object.keys(answers).length + openAnsweredCount;
  const allowBack = exam.allow_back;

  // ¿Está respondida la pregunta qid? (MCQ eligió letra, u open tiene texto)
  const isAnswered = (qid: string) => answers[qid] != null || (openAnswers[qid]?.trim() ?? "") !== "";

  const start = useCallback(async () => {
    setError("");
    setStarting(true);
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
      // Restaurar respuestas de desarrollo autoguardadas.
      const restoredOpen: Record<string, string> = {};
      (data.openResponses ?? []).forEach((r: { question_id: string; answer_text: string }) => {
        if (r.answer_text) restoredOpen[r.question_id] = r.answer_text;
      });
      setOpenAnswers(restoredOpen);
      setOrder(exam.shuffle ? shuffleIndices(total) : Array.from({ length: total }, (_, i) => i));
      setPhase("running");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al iniciar el examen.");
    } finally {
      setStarting(false);
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

  // Auto-guardado de desarrollo, con debounce (se dispara al dejar de tipear).
  const saveOpenAnswer = useCallback(
    (questionId: string, text: string) => {
      if (!attemptId) return;
      clearTimeout(openSaveTimers.current[questionId]);
      openSaveTimers.current[questionId] = setTimeout(() => {
        setSaveState("saving");
        fetch(`/api/attempts/${attemptId}/save-open`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question_id: questionId, answer_text: text }),
        })
          .then((r) => setSaveState(r.ok ? "saved" : "idle"))
          .catch(() => setSaveState("idle"));
      }, 700);
    },
    [attemptId],
  );

  const submit = useCallback(
    async (auto: boolean) => {
      if (submittedRef.current || !attemptId) return;
      submittedRef.current = true;
      setSubmitting(true);
      setError("");
      const responses = Object.entries(answers).map(([question_id, choice]) => ({ question_id, choice }));
      const openResponses = Object.entries(openAnswers)
        .map(([question_id, answer_text]) => ({ question_id, answer_text }))
        .filter((r) => r.answer_text.trim() !== "");
      try {
        const res = await fetch(`/api/attempts/${attemptId}/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ responses, openResponses, auto }),
        });
        if (!res.ok) throw new Error((await res.json()).error || "Error al entregar");
        window.onbeforeunload = null;
        // Entrega manual: va directo al resultado.
        // Entrega por tiempo: queda el aviso y el alumno pasa al resultado con el botón.
        if (auto) {
          setAutoSubmitted(true);
        } else {
          router.push(`/result/${attemptId}`);
        }
      } catch (e) {
        submittedRef.current = false;
        setSubmitting(false);
        setError(e instanceof Error ? e.message : "No se pudo entregar el examen.");
      }
    },
    [answers, openAnswers, attemptId, router],
  );

  // Reloj autoritativo desde el servidor (startedAt + duracion).
  useEffect(() => {
    if (phase !== "running") return;
    const end = startedAt + exam.duration_min * 60 * 1000;
    const tick = () => {
      const rem = Math.round((end - Date.now()) / 1000);
      setRemaining(rem);
      // Avisos no-modales a 10 y 1 min (solo si el examen dura más que el umbral).
      for (const th of [600, 60]) {
        if (exam.duration_min * 60 > th && rem <= th && rem > 0 && !warnedRef.current.has(th)) {
          warnedRef.current.add(th);
          setTimeWarning(`Queda${th === 60 ? "" : "n"} ${th / 60} minuto${th === 60 ? "" : "s"} de examen`);
        }
      }
      if (rem <= 0 && !firedRef.current) {
        firedRef.current = true;
        setTimeUp(true); // bloquea el examen con el aviso
        submit(true); // entrega lo marcado en segundo plano
      }
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [phase, startedAt, exam.duration_min, submit]);

  // El aviso de tiempo se autodescarta a los 7s.
  useEffect(() => {
    if (!timeWarning) return;
    const t = setTimeout(() => setTimeWarning(null), 7000);
    return () => clearTimeout(t);
  }, [timeWarning]);

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
            {!allowBack && (
              <li>
                Es <b>lineal</b>: una vez que avanzás, no podés volver a una pregunta anterior.
              </li>
            )}
            <li>
              Tus respuestas se <b>guardan solas</b>: si recargás o se corta la conexión, podés retomar donde estabas.
            </li>
          </ul>
        </div>
        {error && <p className="text-red2 text-sm mb-3">{error}</p>}
        <Button variant="primary" size="lg" className="w-full" onClick={start} loading={starting}>
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
      {timeWarning && (
        <div
          role="alert"
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-xl border border-[#E6C994] bg-[#FFF3D6] px-4 py-2 text-sm text-ink shadow-lg"
        >
          <span aria-hidden>⏳</span>
          <span className="font-medium">{timeWarning}</span>
        </div>
      )}

      <div className="sticky top-0 z-30 bg-ink text-[#f2f2f2]">
        <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div
              className={`font-mono tabular-nums font-bold text-xl px-3 py-1 rounded-lg bg-[#4d4d4d] border min-w-[96px] text-center ${
                timerHidden ? "border-[#4d4d4d] text-[#8a8a8a] tracking-widest" : clockClass
              }`}
              aria-label={timerHidden ? "Tiempo oculto" : `Tiempo restante: ${fmtClock(remaining)}`}
            >
              {timerHidden ? "• • •" : fmtClock(remaining)}
            </div>
            <button
              type="button"
              onClick={() => setTimerHidden((h) => !h)}
              aria-pressed={timerHidden}
              className="text-xs text-grey-300 hover:text-white underline underline-offset-2"
            >
              {timerHidden ? "Mostrar" : "Ocultar"}
            </button>
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

      <div
        className={`flex-1 w-full mx-auto px-4 my-6 grid gap-6 items-start ${
          allowBack ? "max-w-5xl lg:grid-cols-[1fr_220px]" : "max-w-2xl"
        }`}
      >
        <div className="card p-7">
          <div className="flex items-baseline gap-3 mb-1">
            <span className="font-mono font-bold text-cyan2 text-sm">N.º {String(q.number).padStart(2, "0")}</span>
            {q.topic && (
              <Badge variant="outline" className="text-[10px]">
                {q.topic}
              </Badge>
            )}
            {/* "Marcar" solo tiene sentido si podés volver a la pregunta marcada. */}
            {allowBack && (
              <button
                className={`ml-auto inline-flex items-center gap-1 text-xs rounded-lg px-2.5 py-1.5 border ${marks[q.id] ? "text-amber2 border-[#E6C994] bg-[#FBF3E2]" : "text-[#656565] border-grey-200"}`}
                onClick={() => setMarks((m) => ({ ...m, [q.id]: !m[q.id] }))}
              >
                <HugeiconsIcon icon={StarIcon} size={14} />
                {marks[q.id] ? "Marcada" : "Marcar"}
              </button>
            )}
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
          {q.kind === "open" ? (
            <div className="mt-4">
              <textarea
                data-testid="open-answer"
                value={openAnswers[q.id] ?? ""}
                onChange={(e) => {
                  const text = e.target.value;
                  setOpenAnswers((o) => ({ ...o, [q.id]: text }));
                  saveOpenAnswer(q.id, text);
                }}
                placeholder="Escribí tu resolución paso a paso, con la justificación…"
                rows={8}
                className="w-full rounded-xl border border-grey-200 p-3.5 text-[15px] leading-relaxed focus:border-brand focus:ring-1 focus:ring-brand outline-none resize-y font-mono"
              />
              <p className="text-xs text-grey-600 mt-2">
                Pregunta de <b>desarrollo</b>. Tu resolución la revisa el docente (con ayuda de una devolución
                asistida). Se guarda sola mientras escribís.
              </p>
            </div>
          ) : (
            <div className="mt-4 flex flex-col gap-2.5">
              {q.options.map((opt, i) => {
                const L = LETTERS[i];
                const sel = answers[q.id] === L;
                const elim = (eliminated[q.id] ?? []).includes(L);
                return (
                  <div key={L} className="flex items-stretch gap-1.5">
                    <button
                      data-testid={`option-${L}`}
                      onClick={() => {
                        setAnswers((a) => ({ ...a, [q.id]: L }));
                        saveAnswer(q.id, L);
                        // Seleccionar una opción tachada la restaura (tu respuesta nunca queda tachada).
                        setEliminated((e) => ({ ...e, [q.id]: (e[q.id] ?? []).filter((x) => x !== L) }));
                      }}
                      className={`flex-1 flex gap-3 items-start p-3.5 rounded-xl border text-left text-[15px] transition ${sel ? "border-brand bg-[#fff7e0] ring-1 ring-brand" : "border-grey-200 hover:border-brand hover:bg-[#fffdf7]"} ${elim && !sel ? "line-through decoration-[#9a9a9a] opacity-45" : ""}`}
                    >
                      <span
                        className={`font-mono font-bold text-[13px] rounded-md min-w-[28px] h-7 grid place-items-center border no-underline ${sel ? "bg-brand text-ink border-brand" : "text-[#656565] border-grey-200"}`}
                      >
                        {L}
                      </span>
                      <span dangerouslySetInnerHTML={{ __html: opt }} />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setEliminated((e) => {
                          const cur = e[q.id] ?? [];
                          return { ...e, [q.id]: cur.includes(L) ? cur.filter((x) => x !== L) : [...cur, L] };
                        })
                      }
                      aria-pressed={elim}
                      aria-label={elim ? `Restaurar opción ${L}` : `Descartar opción ${L}`}
                      title={elim ? "Restaurar" : "Descartar"}
                      className={`w-11 shrink-0 grid place-items-center rounded-xl border text-[15px] font-mono transition ${elim ? "border-ink bg-ink text-white" : "border-grey-200 text-[#9a9a9a] hover:border-grey-300 hover:text-ink"}`}
                    >
                      {elim ? "↺" : "✕"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Navegador clickeable: solo en modo con navegación libre. En lineal el
            progreso ya se ve en la barra superior (Pregunta X/N · Respondidas). */}
        {allowBack && (
          <div className="lg:sticky lg:top-20">
            <div className="card p-4">
              <h4 className="font-disp text-xs uppercase tracking-wide text-[#656565] mb-3">Navegador</h4>
              <div className="grid grid-cols-6 gap-1.5">
                {order.map((qq, i) => {
                  const qid = questions[qq].id;
                  const a = isAnswered(qid);
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
        )}
      </div>

      <ActionBar
        className="sticky bottom-0 z-30"
        contentClassName="max-w-5xl"
        back={
          allowBack ? (
            <Button variant="secondary" disabled={idx === 0} onClick={() => setIdx((i) => i - 1)}>
              <HugeiconsIcon icon={ArrowLeft01Icon} />
              Anterior
            </Button>
          ) : undefined
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
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-disp text-lg text-ink mb-2">¿Finalizar el examen?</h3>
            <p className="text-[#656565] text-sm mb-2">
              Respondiste <b>{answeredCount}</b> de {total}
              {total - answeredCount > 0 ? ` (quedan ${total - answeredCount} sin responder)` : ""}. Una vez que
              entregás no podés cambiar tus respuestas.
            </p>
            {allowBack && (
              <>
                {/* Repaso: saltá a cualquier pregunta antes de entregar. */}
                <div className="grid grid-cols-8 gap-1.5 my-3">
                  {order.map((qq, i) => {
                    const qid = questions[qq].id;
                    const a = isAnswered(qid);
                    const m = marks[qid];
                    return (
                      <button
                        key={i}
                        onClick={() => {
                          setConfirming(false);
                          setIdx(i);
                        }}
                        aria-label={`Ir a la pregunta ${i + 1}: ${a ? "respondida" : "sin responder"}${m ? ", marcada" : ""}`}
                        className={`relative aspect-square rounded-lg border font-mono text-[12px] grid place-items-center ${
                          a ? "bg-ink text-white border-ink" : "bg-white text-[#656565] border-grey-200"
                        }`}
                      >
                        {i + 1}
                        {m && <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-amber2" />}
                      </button>
                    );
                  })}
                </div>
                <div className="mb-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[#656565]">
                  <span className="inline-flex items-center gap-1">
                    <span className="inline-block h-2.5 w-2.5 rounded bg-ink" /> Respondida
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="inline-block h-2.5 w-2.5 rounded border border-grey-200 bg-white" /> Sin responder
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber2" /> Marcada
                  </span>
                </div>
              </>
            )}
            {error && <p className="text-red2 text-sm mb-2">{error}</p>}
            <div className="flex gap-2.5 justify-end mt-3">
              <Button variant="secondary" onClick={() => setConfirming(false)} disabled={submitting}>
                Seguir respondiendo
              </Button>
              <Button variant="primary" onClick={() => submit(false)} loading={submitting}>
                {submitting ? "Entregando…" : "Entregar examen"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {timeUp && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(10,26,47,.6)] p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-7 text-center">
            <h3 className="font-disp text-xl text-ink mb-2">Se acabó el tiempo</h3>
            <p className="text-[#656565] text-sm mb-5">
              Tu simulacro se entregó automáticamente con las respuestas que marcaste hasta ahora.
            </p>
            {error ? (
              <>
                <p className="text-red2 text-sm mb-3">{error}</p>
                <Button variant="primary" onClick={() => submit(true)} loading={submitting}>
                  {submitting ? "Reintentando…" : "Reintentar entrega"}
                </Button>
              </>
            ) : autoSubmitted ? (
              <Button variant="primary" onClick={() => router.push(`/result/${attemptId}`)}>
                Ver mi resultado
                <HugeiconsIcon icon={ArrowRight01Icon} />
              </Button>
            ) : (
              <Button variant="primary" loading>
                Entregando…
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
