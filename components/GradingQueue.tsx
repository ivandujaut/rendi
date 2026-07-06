"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMutation } from "@/lib/hooks/use-mutation";
import { apiRequest } from "@/lib/api/client";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon, SparklesIcon } from "@hugeicons/core-free-icons";

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
const POR_REVISAR = new Set(["pending", "failed", "sin_corregir"]);

type Tab = "por-revisar" | "corregidas" | "todas";
const TABS: [Tab, string][] = [
  ["por-revisar", "Por revisar"],
  ["corregidas", "Corregidas"],
  ["todas", "Todas"],
];

/**
 * Cola de corrección del docente. Para escalar a una clase entera, se corrige
 * PREGUNTA POR PREGUNTA (consistencia): cada N.º agrupa las respuestas de todos los
 * alumnos, con el enunciado y la rúbrica una sola vez. Cada alumno es una fila compacta
 * (nombre + preview + estado + aprobar rápido) que se expande para leer todo y editar.
 * Filtros por comisión y estado ("Por revisar" por defecto oculta lo resuelto) + barra
 * de progreso. El selector de examen cambia de ruta sin volver al panel.
 */
export function GradingQueue({
  items,
  examId,
  exams,
}: {
  items: GradingItem[];
  examId: string;
  exams: { id: string; title: string }[];
}) {
  const router = useRouter();
  const { busy, error, run } = useMutation();
  // Copia local: feedback editable + estado, para reflejar la acción al instante.
  const [list, setList] = useState(items);
  useEffect(() => setList(items), [items]);

  const [tab, setTab] = useState<Tab>("por-revisar");
  const [comision, setComision] = useState("todas");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const comisiones = useMemo(
    () => [...new Set(list.map((i) => i.group ?? "s/d"))].sort((a, b) => a.localeCompare(b, "es")),
    [list],
  );

  const setFeedback = (id: string, feedback: string) =>
    setList((prev) => prev.map((x) => (x.gradingId === id ? { ...x, feedback } : x)));

  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

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
        refresh: false, // ya reflejamos el cambio localmente; no recargamos toda la cola
      },
    );
  };

  // Alcance por comisión → progreso; después el filtro de estado arma lo visible.
  const scoped = list.filter((i) => comision === "todas" || (i.group ?? "s/d") === comision);
  const corregidas = scoped.filter((i) => RESUELTO.has(i.estado)).length;
  const total = scoped.length;
  const pct = total ? Math.round((corregidas / total) * 100) : 0;

  const visible = scoped.filter((i) =>
    tab === "todas" ? true : tab === "corregidas" ? RESUELTO.has(i.estado) : POR_REVISAR.has(i.estado),
  );

  // Agrupar por número de pregunta (secciones), ordenadas por N.º.
  const groups = useMemo(() => {
    const m = new Map<number, GradingItem[]>();
    for (const it of visible) {
      const arr = m.get(it.number);
      if (arr) arr.push(it);
      else m.set(it.number, [it]);
    }
    for (const arr of m.values()) arr.sort((a, b) => a.student.localeCompare(b.student, "es"));
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [visible]);

  return (
    <div>
      {/* Barra de filtros */}
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-grey-600">Examen</span>
          <select
            value={examId}
            onChange={(e) => router.push(`/teacher/grading/${e.target.value}`)}
            className="rounded-lg border border-grey-200 px-3 h-9 text-sm bg-white focus:border-brand outline-none"
          >
            {exams.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-grey-600">Comisión</span>
          <select
            value={comision}
            onChange={(e) => setComision(e.target.value)}
            className="rounded-lg border border-grey-200 px-3 h-9 text-sm bg-white focus:border-brand outline-none"
          >
            <option value="todas">Todas</option>
            {comisiones.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-1.5 border-b border-(--line) ml-auto self-end">
          {TABS.map(([k, l]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              aria-current={tab === k}
              className={`px-3 py-2 font-disp font-semibold text-sm -mb-px border-b-2 ${
                tab === k ? "text-ink border-brand" : "text-[#656565] border-transparent hover:text-ink"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Progreso (de la comisión filtrada) */}
      <div className="mb-5">
        <div className="flex items-center justify-between text-sm text-grey-600 mb-1">
          <span>
            <b className="text-ink">{corregidas}</b> de {total} corregidas
            {comision !== "todas" ? ` · ${comision}` : ""}
          </span>
          <span className="font-mono text-xs">{pct}%</span>
        </div>
        <div className="h-2 rounded bg-[#f2f2f2] overflow-hidden">
          <div className="h-full rounded bg-brand" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {error && <p className="text-red2 text-sm mb-3">{error}</p>}

      {groups.length === 0 ? (
        <div className="card p-10 text-center text-grey-600">
          {tab === "por-revisar" ? "No queda nada por revisar con este filtro." : "No hay respuestas con este filtro."}
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map(([number, rows]) => {
            const head = rows[0];
            return (
              <section key={number}>
                <div className="flex items-baseline gap-3 mb-2">
                  <span className="font-mono font-bold text-cyan2 text-sm">N.º {String(number).padStart(2, "0")}</span>
                  {head.topic && (
                    <Badge variant="outline" className="text-[10px]">
                      {head.topic}
                    </Badge>
                  )}
                  <span className="text-xs text-grey-600">
                    {rows.length} {rows.length === 1 ? "respuesta" : "respuestas"}
                  </span>
                </div>
                <div className="text-[15px] leading-relaxed text-ink2 mb-1" dangerouslySetInnerHTML={{ __html: head.prompt }} />
                {head.rubrica && (
                  <p className="text-xs text-grey-600 mb-3">
                    <b>Criterio:</b> {head.rubrica}
                  </p>
                )}

                <div className="flex flex-col divide-y divide-grey-100 border border-grey-100 rounded-xl overflow-hidden bg-white">
                  {rows.map((it) => (
                    <Row
                      key={it.openResponseId}
                      it={it}
                      examId={examId}
                      showGroup={comision === "todas"}
                      isOpen={expanded.has(it.openResponseId)}
                      onToggle={() => toggleExpand(it.openResponseId)}
                      onFeedback={(v) => it.gradingId && setFeedback(it.gradingId, v)}
                      onReview={(a) => review(it, a)}
                      busyReject={it.gradingId != null && busy === `${it.gradingId}:reject`}
                      busyApprove={it.gradingId != null && busy === `${it.gradingId}:approve`}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Row({
  it,
  examId,
  showGroup,
  isOpen,
  onToggle,
  onFeedback,
  onReview,
  busyReject,
  busyApprove,
}: {
  it: GradingItem;
  examId: string;
  showGroup: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onFeedback: (v: string) => void;
  onReview: (a: "approve" | "reject") => void;
  busyReject: boolean;
  busyApprove: boolean;
}) {
  const router = useRouter();
  const busyThis = busyReject || busyApprove;
  const resuelto = RESUELTO.has(it.estado);
  const preview = it.answer.replace(/\s+/g, " ").trim();

  // Corregir con IA solo esta respuesta (cuando está "sin corregir").
  const [grading, setGrading] = useState(false);
  const [gradeErr, setGradeErr] = useState("");
  const gradeThis = async () => {
    if (grading) return;
    setGrading(true);
    setGradeErr("");
    try {
      await apiRequest("/api/gradings/run", {
        method: "POST",
        body: { examId, openResponseId: it.openResponseId },
      });
      router.refresh(); // recarga con el borrador; el estado deja de ser sin_corregir
    } catch (e) {
      setGradeErr(e instanceof Error ? e.message : "No se pudo corregir con IA.");
      setGrading(false);
    }
  };

  // "Preguntá a la IA": consulta puntual sobre esta respuesta (efímera).
  const [askQ, setAskQ] = useState("");
  const [askAns, setAskAns] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [askErr, setAskErr] = useState("");

  const ask = async () => {
    const question = askQ.trim();
    if (!question || asking) return;
    setAsking(true);
    setAskErr("");
    setAskAns(null);
    try {
      const r = (await apiRequest("/api/gradings/ask", {
        method: "POST",
        body: { openResponseId: it.openResponseId, question },
      })) as { answer: string };
      setAskAns(r.answer);
    } catch (e) {
      setAskErr(e instanceof Error ? e.message : "No se pudo preguntar a la IA.");
    } finally {
      setAsking(false);
    }
  };

  return (
    <div className={resuelto ? "opacity-70" : ""}>
      {/* Fila compacta */}
      <div className="flex items-center gap-3 px-3.5 py-2.5">
        <button
          onClick={onToggle}
          aria-expanded={isOpen}
          className="flex items-center gap-2 min-w-0 flex-1 text-left"
        >
          <HugeiconsIcon
            icon={ArrowDown01Icon}
            size={16}
            className={`shrink-0 text-grey-600 transition-transform ${isOpen ? "" : "-rotate-90"}`}
          />
          <span className="text-sm text-ink shrink-0">
            {it.student}
            {showGroup && it.group ? <span className="text-grey-600"> · {it.group}</span> : ""}
          </span>
          {!isOpen && <span className="text-sm text-grey-600 truncate">{preview}</span>}
        </button>
        <EstadoBadge estado={it.estado} wasEdited={it.wasEdited} />
      </div>

      {/* Detalle expandido */}
      {isOpen && (
        <div className="px-3.5 pb-4 pt-1">
          <div className="text-xs uppercase tracking-wide text-grey-600 mb-1">Respuesta del alumno</div>
          <div className="rounded-lg border border-grey-200 bg-[#fafafa] p-3 text-[14px] whitespace-pre-wrap font-mono mb-3">
            {it.answer}
          </div>

          {it.estado === "sin_corregir" ? (
            <div className="rounded-lg border border-grey-200 bg-[#fafafa] p-3">
              <p className="text-sm text-grey-600 mb-2">Esta respuesta todavía no tiene borrador de la IA.</p>
              <Button variant="ai" size="sm" loading={grading} onClick={gradeThis}>
                {!grading && <HugeiconsIcon icon={SparklesIcon} />}
                Corregir con IA
              </Button>
              {gradeErr && <p className="text-red2 text-sm mt-1.5">{gradeErr}</p>}
            </div>
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
                <p className="text-xs text-amber2 mb-1">La IA no pudo corregir esta respuesta. Escribí la devolución a mano.</p>
              )}
              <div className="text-xs uppercase tracking-wide text-grey-600 mb-1">Borrador de devolución (editable)</div>
              <textarea
                value={it.feedback}
                onChange={(e) => onFeedback(e.target.value)}
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
                <Button variant="secondary" size="sm" onClick={() => onReview("reject")} loading={busyReject} disabled={busyThis}>
                  Rechazar
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  loading={busyApprove}
                  onClick={() => onReview("approve")}
                  disabled={busyThis || !it.feedback.trim()}
                >
                  Aprobar y publicar
                </Button>
              </div>

              {/* Preguntá a la IA sobre esta respuesta */}
              <div className="mt-3 border-t border-grey-100 pt-3">
                <div className="text-xs uppercase tracking-wide text-grey-600 mb-1.5 inline-flex items-center gap-1.5">
                  <HugeiconsIcon icon={SparklesIcon} size={13} className="text-[#7c3aed]" />
                  Preguntá a la IA sobre esta respuesta
                </div>
                <div className="flex gap-2">
                  <input
                    value={askQ}
                    onChange={(e) => setAskQ(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") ask();
                    }}
                    disabled={asking}
                    placeholder="Ej: ¿está bien el paso 3? · hacé la devolución más corta"
                    className="flex-1 rounded-lg border border-grey-200 px-3 h-9 text-sm focus:border-brand focus:ring-1 focus:ring-brand outline-none"
                  />
                  <Button variant="ai" size="sm" loading={asking} disabled={!askQ.trim()} onClick={ask}>
                    {!asking && <HugeiconsIcon icon={SparklesIcon} />}
                    Preguntar
                  </Button>
                </div>
                {askErr && <p className="text-red2 text-sm mt-1.5">{askErr}</p>}
                {askAns && (
                  <div className="mt-2 rounded-lg border border-grey-200 bg-[#fafafa] p-3">
                    <p className="text-[14px] leading-relaxed whitespace-pre-wrap text-ink2">{askAns}</p>
                    <div className="flex justify-end mt-2">
                      <Button variant="ghost" size="xs" onClick={() => onFeedback(askAns)}>
                        Usar como devolución
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function EstadoBadge({ estado, wasEdited }: { estado: GradingItem["estado"]; wasEdited: boolean }) {
  if (estado === "approved") return <Badge variant="success">Aprobada{wasEdited ? " · editada" : ""}</Badge>;
  if (estado === "rejected") return <Badge variant="outline">Rechazada</Badge>;
  if (estado === "failed") return <Badge variant="warning">IA falló</Badge>;
  if (estado === "sin_corregir") return <Badge variant="outline">Sin corregir</Badge>;
  return <Badge variant="warning">Por revisar</Badge>;
}
