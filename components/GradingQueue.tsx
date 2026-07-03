"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMutation } from "@/lib/hooks/use-mutation";
import { apiRequest } from "@/lib/api/client";

export type GradingItem = {
  openResponseId: string;
  gradingId: string | null; // null = la IA todavía no corrigió (sin fila ai_gradings)
  number: number;
  prompt: string;
  rubrica: string | null;
  topic: string | null;
  student: string;
  group: string | null;
  answer: string;
  estado: "pending" | "failed" | "approved" | "rejected" | "sin_corregir";
  feedback: string;
  temas: string[];
  wasEdited: boolean;
};

const RESUELTO = new Set(["approved", "rejected"]);

/** Cola de corrección del docente: un ítem por respuesta de desarrollo. */
export function GradingQueue({ items }: { items: GradingItem[] }) {
  const { busy, error, run } = useMutation();
  // Copia local: feedback editable + estado, para reflejar la acción al instante.
  const [list, setList] = useState(items);
  useEffect(() => setList(items), [items]);

  const setFeedback = (id: string, feedback: string) =>
    setList((prev) => prev.map((x) => (x.gradingId === id ? { ...x, feedback } : x)));

  const review = (it: GradingItem, action: "approve" | "reject") => {
    if (!it.gradingId) return;
    const nextEstado = action === "approve" ? "approved" : "rejected";
    run(
      `${it.gradingId}:${action}`,
      () => apiRequest(`/api/gradings/${it.gradingId}`, { method: "PATCH", body: { action, feedback: it.feedback } }),
      {
        optimistic: () =>
          setList((prev) => prev.map((x) => (x.gradingId === it.gradingId ? { ...x, estado: nextEstado } : x))),
        revert: () =>
          setList((prev) => prev.map((x) => (x.gradingId === it.gradingId ? { ...x, estado: it.estado } : x))),
      },
    );
  };

  const pendientes = list.filter((x) => !RESUELTO.has(x.estado)).length;

  return (
    <div>
      <p className="text-sm text-grey-600 mb-4">
        <b className="text-ink">{pendientes}</b> por revisar · {list.length} en total.
      </p>
      {error && <p className="text-red2 text-sm mb-3">{error}</p>}

      <div className="flex flex-col gap-4">
        {list.map((it) => {
          // La key de busy incluye la acción para mostrar el spinner solo en el
          // botón clickeado (aprobar/rechazar comparten fila).
          const busyReject = it.gradingId != null && busy === `${it.gradingId}:reject`;
          const busyApprove = it.gradingId != null && busy === `${it.gradingId}:approve`;
          const busyThis = busyReject || busyApprove;
          const resuelto = RESUELTO.has(it.estado);
          return (
            <div key={it.openResponseId} className={`card p-5 ${resuelto ? "opacity-70" : ""}`}>
              <div className="flex items-baseline gap-3 mb-2">
                <span className="font-mono font-bold text-cyan2 text-sm">N.º {String(it.number).padStart(2, "0")}</span>
                {it.topic && (
                  <Badge variant="outline" className="text-[10px]">
                    {it.topic}
                  </Badge>
                )}
                <span className="ml-auto text-sm text-grey-600">
                  {it.student}
                  {it.group ? ` · ${it.group}` : ""}
                </span>
                <EstadoBadge estado={it.estado} wasEdited={it.wasEdited} />
              </div>

              <div className="text-[15px] leading-relaxed text-ink2 mb-3" dangerouslySetInnerHTML={{ __html: it.prompt }} />
              {it.rubrica && (
                <p className="text-xs text-grey-600 mb-3">
                  <b>Criterio:</b> {it.rubrica}
                </p>
              )}

              <div className="mb-3">
                <div className="text-xs uppercase tracking-wide text-grey-600 mb-1">Respuesta del alumno</div>
                <div className="rounded-lg border border-grey-200 bg-[#fafafa] p-3 text-[14px] whitespace-pre-wrap font-mono">
                  {it.answer}
                </div>
              </div>

              {it.estado === "sin_corregir" ? (
                <p className="text-sm text-grey-600 italic">Esperando la corrección de la IA…</p>
              ) : resuelto ? (
                it.feedback ? (
                  <div>
                    <div className="text-xs uppercase tracking-wide text-grey-600 mb-1">Devolución</div>
                    <p className="text-[14px] leading-relaxed text-ink2 whitespace-pre-wrap">{it.feedback}</p>
                  </div>
                ) : null
              ) : (
                <>
                  {it.estado === "failed" && (
                    <p className="text-xs text-amber2 mb-1">
                      La IA no pudo corregir esta respuesta. Escribí la devolución a mano.
                    </p>
                  )}
                  <div className="text-xs uppercase tracking-wide text-grey-600 mb-1">Borrador de devolución (editable)</div>
                  <textarea
                    value={it.feedback}
                    onChange={(e) => setFeedback(it.gradingId!, e.target.value)}
                    rows={4}
                    disabled={busyThis}
                    className="w-full rounded-lg border border-grey-200 p-3 text-[14px] leading-relaxed focus:border-brand focus:ring-1 focus:ring-brand outline-none resize-y"
                  />
                  {it.temas.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {it.temas.map((t) => (
                        <Badge key={t} variant="warning" className="text-[10px]">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2 justify-end mt-3">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => review(it, "reject")}
                      loading={busyReject}
                      disabled={busyThis}
                    >
                      Rechazar
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      loading={busyApprove}
                      onClick={() => review(it, "approve")}
                      disabled={busyThis || !it.feedback.trim()}
                    >
                      Aprobar y publicar
                    </Button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EstadoBadge({ estado, wasEdited }: { estado: GradingItem["estado"]; wasEdited: boolean }) {
  if (estado === "approved")
    return <Badge variant="success">Aprobada{wasEdited ? " · editada" : ""}</Badge>;
  if (estado === "rejected") return <Badge variant="outline">Rechazada</Badge>;
  if (estado === "failed") return <Badge variant="warning">IA falló</Badge>;
  if (estado === "sin_corregir") return <Badge variant="outline">Sin corregir</Badge>;
  return <Badge variant="warning">Por revisar</Badge>;
}
