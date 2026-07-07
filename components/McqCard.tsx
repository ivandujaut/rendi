"use client";

import { LETTERS } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { HugeiconsIcon } from "@hugeicons/react";
import { CheckmarkCircle02Icon, CancelCircleIcon } from "@hugeicons/core-free-icons";
import { MathText } from "@/components/MathText";

const OK = "#23925F";
const BAD = "#D24B5E";

export type McqFeedback = { correct: string | null; is_correct: boolean; explanation: string | null };
export type McqQuestion = {
  number: number;
  topic: string | null;
  prompt: string;
  figure_url: string | null;
  options: string[];
};

/**
 * Card de una pregunta MCQ con feedback inmediato: enunciado + figura + opciones
 * barajadas (A–E reetiquetadas por posición, pero se responde/corrige por la letra
 * ORIGINAL), estados correcto/incorrecto/pendiente y el bloque de devolución +
 * explicación. La comparten práctica y repaso (mismo comportamiento; solo cambian el
 * copy de acierto y el testid).
 *
 * `order` es la permutación de índices originales; `selectedL`/`onAnswer` usan la
 * letra ORIGINAL. `feedback` null = todavía sin responder.
 */
export function McqCard({
  question,
  order,
  selectedL,
  feedback,
  checking,
  onAnswer,
  correctLabel = "¡Correcto!",
  testIdPrefix,
  error,
}: {
  question: McqQuestion;
  order: number[];
  selectedL: string | null;
  feedback: McqFeedback | null;
  checking: boolean;
  onAnswer: (L: string) => void;
  /** Titular cuando acierta (ej. "¡Correcto!" en práctica, "¡Bien! Re-dominada." en repaso). */
  correctLabel?: string;
  /** Prefijo para el data-testid de cada opción (ej. "practice-option"). */
  testIdPrefix?: string;
  error?: string;
}) {
  const q = question;
  const fb = feedback;
  // Letra MOSTRADA de la correcta (tras el shuffle), para que el texto del feedback
  // coincida con la opción marcada en verde, no con la letra original.
  const correctDisplayL = fb?.correct
    ? LETTERS[order.indexOf((LETTERS as readonly string[]).indexOf(fb.correct))]
    : null;

  return (
    <div className="card p-7">
      <div className="flex items-baseline gap-3 mb-1">
        <span className="font-mono font-bold text-cyan2 text-sm">N.º {String(q.number).padStart(2, "0")}</span>
        {q.topic && <Badge variant="outline" className="text-[10px]">{q.topic}</Badge>}
      </div>
      <div className="text-[16.5px] leading-relaxed my-3"><MathText html>{q.prompt}</MathText></div>
      {q.figure_url && (
        <div className="my-4 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={q.figure_url} alt={`Figura ${q.number}`} className="inline-block max-w-[340px] w-full border border-(--line) rounded-lg" />
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2.5">
        {order.map((origIdx, i) => {
          const displayL = LETTERS[i]; // etiqueta en pantalla (A,B,C… en orden)
          const L = LETTERS[origIdx]; // letra ORIGINAL: se guarda y corrige por esta
          const opt = q.options[origIdx];
          const isSel = selectedL === L;
          const isCorrect = !!fb && fb.correct === L;
          const isWrongSel = !!fb && isSel && !fb.is_correct;
          const isPending = isSel && checking && !fb; // elegida, esperando el feedback
          const style = isCorrect
            ? { borderColor: OK, background: "#eaf6f0" }
            : isWrongSel
              ? { borderColor: BAD, background: "#fbecee" }
              : undefined;
          return (
            <button
              key={displayL}
              data-testid={testIdPrefix ? `${testIdPrefix}-${displayL}` : undefined}
              disabled={!!fb || checking}
              onClick={() => onAnswer(L)}
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
              <MathText html>{opt}</MathText>
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
            {fb.is_correct ? correctLabel : `Incorrecto. La correcta es ${correctDisplayL ?? "s/d"}`}
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
  );
}
