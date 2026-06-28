"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LETTERS, fmtClock, shuffleIndices, type Exam, type Question } from "@/lib/types";

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
      setOrder(exam.shuffle ? shuffleIndices(total) : Array.from({ length: total }, (_, i) => i));
      setPhase("running");
    } catch (e: any) {
      setError(e.message || "Error al iniciar el examen.");
    }
  }, [exam.id, exam.shuffle, total]);

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
    [answers, attemptId, router]
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
    return "border-[#1D456B]";
  }, [remaining]);

  // ---------- INTRO ----------
  if (phase === "intro") {
    return (
      <main className="max-w-2xl mx-auto px-4 py-10">
        <div className="font-mono text-xs tracking-widest uppercase text-cyan2 mb-3">Antes de empezar</div>
        <h1 className="font-disp text-2xl text-ink mb-4">{exam.title}</h1>
        <div className="card p-6 mb-4">
          <ul className="list-disc pl-5 space-y-2 text-[15px]">
            <li><b>{total} preguntas</b> de opción múltiple; una sola correcta (A–E).</li>
            <li>Tenés <b>{exam.duration_min} minutos</b>. El reloj corre desde que tocás “Iniciar” y al llegar a cero se entrega solo.</li>
            <li>Para los cálculos usá <b>g = 10 m/s²</b>.</li>
            <li>No hay penalización por error: conviene responder todo.</li>
            <li><b>No recargues la página</b> durante el examen.</li>
          </ul>
        </div>
        {error && <p className="text-red2 text-sm mb-3">{error}</p>}
        <button className="btn btn-primary w-full" onClick={start}>
          Iniciar examen ▸ arranca el reloj
        </button>
      </main>
    );
  }

  // ---------- RUNNING ----------
  const oi = order[idx];
  const q = questions[oi];

  return (
    <div>
      <div className="sticky top-0 z-30 bg-ink text-[#eaf1fa]">
        <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center gap-4">
          <div>
            <div className={`font-mono font-bold text-xl px-3 py-1 rounded-lg bg-[#08263f] border ${clockClass} min-w-[96px] text-center`}>
              {fmtClock(remaining)}
            </div>
          </div>
          <div className="text-sm text-[#9DB9D4]">
            Pregunta <b className="text-white font-mono">{idx + 1}</b>/{total} · Respondidas{" "}
            <b className="text-white font-mono">{answeredCount}</b>
          </div>
          <div className="flex-1 h-[7px] bg-[#0a2a47] rounded overflow-hidden min-w-[80px]">
            <div className="h-full bg-cyan2 transition-all" style={{ width: `${Math.round((answeredCount / total) * 100)}%` }} />
          </div>
          <button className="ml-auto bg-[#16385a] text-[#cfe2f5] border border-[#2C4866] rounded-lg px-4 py-2 font-disp font-semibold text-sm hover:bg-[#1d456b]" onClick={() => setConfirming(true)}>
            Finalizar ▸
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 my-6 grid lg:grid-cols-[1fr_220px] gap-6 items-start">
        <div className="card p-7">
          <div className="flex items-baseline gap-3 mb-1">
            <span className="font-mono font-bold text-cyan2 text-sm">N.º {String(q.number).padStart(2, "0")}</span>
            {q.topic && <span className="font-mono text-[10px] uppercase tracking-wide text-[#8493A6] border border-[var(--line)] rounded-full px-2 py-0.5">{q.topic}</span>}
            <button
              className={`ml-auto text-xs rounded-lg px-2.5 py-1.5 border ${marks[q.id] ? "text-amber2 border-[#E6C994] bg-[#FBF3E2]" : "text-[#5C6B7E] border-[#c2d0e2]"}`}
              onClick={() => setMarks((m) => ({ ...m, [q.id]: !m[q.id] }))}
            >
              {marks[q.id] ? "★ Marcada" : "☆ Marcar"}
            </button>
          </div>
          <div className="text-[16.5px] leading-relaxed my-3" dangerouslySetInnerHTML={{ __html: q.prompt }} />
          {q.figure_url && (
            <div className="my-4 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={q.figure_url} alt={`Figura ${q.number}`} className="inline-block max-w-[340px] w-full border border-[var(--line)] rounded-lg" />
            </div>
          )}
          <div className="mt-4 flex flex-col gap-2.5">
            {q.options.map((opt, i) => {
              const L = LETTERS[i];
              const sel = answers[q.id] === L;
              return (
                <button
                  key={L}
                  onClick={() => setAnswers((a) => ({ ...a, [q.id]: L }))}
                  className={`flex gap-3 items-start p-3.5 rounded-xl border text-left text-[15px] transition ${sel ? "border-brand bg-[#EEF6FC] ring-1 ring-brand" : "border-[#c2d0e2] hover:border-brand hover:bg-[#F7FAFD]"}`}
                >
                  <span className={`font-mono font-bold text-[13px] rounded-md min-w-[28px] h-7 grid place-items-center border ${sel ? "bg-brand text-white border-brand" : "text-[#5C6B7E] border-[#c2d0e2]"}`}>{L}</span>
                  <span dangerouslySetInnerHTML={{ __html: opt }} />
                </button>
              );
            })}
          </div>
          <div className="flex gap-2.5 mt-6">
            <button className="btn btn-ghost disabled:opacity-40" disabled={idx === 0} onClick={() => setIdx((i) => i - 1)}>← Anterior</button>
            <div className="flex-1" />
            {idx === total - 1 ? (
              <button className="btn btn-primary" onClick={() => setConfirming(true)}>Revisar y finalizar</button>
            ) : (
              <button className="btn btn-primary" onClick={() => setIdx((i) => i + 1)}>Siguiente →</button>
            )}
          </div>
        </div>

        <div className="lg:sticky lg:top-20">
          <div className="card p-4">
            <h4 className="font-disp text-xs uppercase tracking-wide text-[#5C6B7E] mb-3">Navegador</h4>
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
                    className={`aspect-square rounded-lg border font-mono text-[12.5px] grid place-items-center relative ${a ? "bg-ink text-white border-ink" : "bg-white text-[#5C6B7E] border-[#c2d0e2]"} ${cur ? "ring-2 ring-cyan2 border-cyan2" : ""}`}
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

      {confirming && (
        <div className="fixed inset-0 bg-[rgba(10,26,47,.55)] grid place-items-center z-50 p-4" onClick={() => setConfirming(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-disp text-lg text-ink mb-2">¿Finalizar el examen?</h3>
            <p className="text-[#5C6B7E] text-sm mb-2">
              Respondiste <b>{answeredCount}</b> de {total}{total - answeredCount > 0 ? ` (quedan ${total - answeredCount} sin responder)` : ""}. Una vez que entregás no podés cambiar tus respuestas.
            </p>
            {error && <p className="text-red2 text-sm mb-2">{error}</p>}
            <div className="flex gap-2.5 justify-end mt-3">
              <button className="btn btn-ghost" onClick={() => setConfirming(false)} disabled={submitting}>Seguir respondiendo</button>
              <button className="btn btn-primary" onClick={() => submit(false)} disabled={submitting}>
                {submitting ? "Entregando…" : "Entregar examen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
