"use client";

import { useState } from "react";

export type ReviewRow = {
  number: number;
  topic: string | null;
  your_choice: string | null;
  correct: string | null;
  is_correct: boolean;
  explanation: string | null;
};

/**
 * Desempeño por tema + revisión de respuestas. Las barras por tema son
 * clickeables (si hay revisión habilitada) y filtran la lista de abajo a ese
 * tema — el reporte pasa de estático a hub de próxima acción.
 */
export function ResultReview({
  topics,
  review,
}: {
  topics: [string, { ok: number; tot: number }][];
  review: ReviewRow[];
}) {
  const [topic, setTopic] = useState<string | null>(null);
  const canFilter = review.length > 0;
  const shown = topic ? review.filter((r) => r.topic === topic) : review;

  return (
    <>
      <div className="card p-6 mt-4">
        <h3 className="font-disp text-base text-ink mb-1">Tu desempeño por tema</h3>
        <p className="text-sm text-[#656565] mb-3">
          {canFilter
            ? "Tocá un tema para revisar solo esas preguntas."
            : "Dónde estuviste más sólido y dónde conviene reforzar."}
        </p>
        <div>
          {topics.map(([t, v]) => {
            const p = Math.round((v.ok / v.tot) * 100);
            const col = p >= 70 ? "#23925F" : p >= 40 ? "#D9912A" : "#D24B5E";
            const active = topic === t;
            const bar = (
              <>
                <div className="w-40 shrink-0 text-left text-sm text-ink2">{t}</div>
                <div className="h-2.5 flex-1 overflow-hidden rounded bg-[#f2f2f2]">
                  <div className="h-full rounded" style={{ width: `${p}%`, background: col }} />
                </div>
                <div className="w-14 text-right font-mono text-xs text-[#656565]">
                  {v.ok}/{v.tot}
                </div>
              </>
            );
            return canFilter ? (
              <button
                key={t}
                type="button"
                onClick={() => setTopic(active ? null : t)}
                aria-pressed={active}
                className={`-mx-2 my-1 flex w-full items-center gap-3 rounded-lg px-2 py-1 transition ${
                  active ? "bg-[#f7f7f7] ring-1 ring-grey-200" : "hover:bg-[#fafafa]"
                }`}
              >
                {bar}
              </button>
            ) : (
              <div key={t} className="my-2 flex items-center gap-3">
                {bar}
              </div>
            );
          })}
        </div>
      </div>

      {review.length > 0 && (
        <div className="card p-6 mt-4">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <h3 className="font-disp text-base text-ink">Revisión</h3>
            {topic && (
              <span className="inline-flex items-center gap-2 rounded-full bg-[#f2f2f2] px-2.5 py-1 text-xs">
                {topic} · {shown.length}
                <button
                  type="button"
                  onClick={() => setTopic(null)}
                  className="text-[#656565] underline underline-offset-2 hover:text-ink"
                >
                  ver todas
                </button>
              </span>
            )}
          </div>
          <div className="flex flex-col gap-2">
            {shown.map((r) => (
              <div key={r.number} className="rounded-lg border border-[#f2f2f2] p-2.5 text-[13.5px]">
                <div className="flex items-center gap-3">
                  <b className="w-9 font-mono">{String(r.number).padStart(2, "0")}</b>
                  <span className="flex-1 text-[#656565]">{r.topic}</span>
                  <span className="font-mono">
                    Tu resp.:{" "}
                    <b style={{ color: r.is_correct ? "#23925F" : "#D24B5E" }}>{r.your_choice || "—"}</b>
                  </span>
                  <span className="font-mono">
                    Correcta: <b className="text-green2">{r.correct}</b>
                  </span>
                </div>
                {r.explanation && (
                  <p className="mt-2 pl-12 text-[13px] leading-relaxed text-[#656565]">{r.explanation}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
