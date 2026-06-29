"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { fmtClock } from "@/lib/types";
import { Button, buttonVariants } from "@/components/ui/button";
import { ExamSwitcher } from "@/components/ExamSwitcher";
import { Badge, pctBadgeVariant } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { HugeiconsIcon } from "@hugeicons/react";
import { PlusSignIcon, Download01Icon } from "@hugeicons/core-free-icons";

type Attempt = {
  id: string; student: string; group: string; score: number; total: number;
  pct: number; durationSec: number; auto: boolean; date: string; dateLabel: string;
};
type QStat = { number: number; topic: string; ok: number; tot: number; pct: number | null; correct: string };
type TStat = { topic: string; ok: number; tot: number; pct: number | null };
type ExamItem = { id: string; title: string; year: number | null };

const barColor = (p: number | null) => (p == null ? "#cccccc" : p >= 70 ? "#23925F" : p >= 40 ? "#D9912A" : "#D24B5E");

export default function TeacherDashboard({
  examList, examId, attempts, questionStats, topicStats,
}: {
  examList: ExamItem[]; examId: string | null;
  attempts: Attempt[]; questionStats: QStat[]; topicStats: TStat[];
}) {
  const [tab, setTab] = useState<"alumnos" | "preguntas" | "temas">("alumnos");
  const [sortKey, setSortKey] = useState<"student" | "group" | "pct" | "durationSec" | "date">("date");
  const [sortDir, setSortDir] = useState(-1);
  const [studentQuery, setStudentQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState("");

  // Comisiones presentes (para el filtro). Se omiten los intentos sin comisión.
  const groups = useMemo(
    () => Array.from(new Set(attempts.map((a) => a.group).filter((g) => g && g !== "—"))).sort(),
    [attempts]
  );

  // Intentos tras aplicar búsqueda por alumno + comisión.
  const filtered = useMemo(
    () =>
      attempts.filter(
        (a) =>
          (!studentQuery || a.student.toLowerCase().includes(studentQuery.trim().toLowerCase())) &&
          (!groupFilter || a.group === groupFilter)
      ),
    [attempts, studentQuery, groupFilter]
  );

  // Métricas: del conjunto filtrado (así reflejan la comisión/alumno elegidos).
  const n = attempts.length; // total (para el estado vacío)
  const fn = filtered.length; // filtrados
  const avg = fn ? Math.round(filtered.reduce((s, a) => s + a.pct, 0) / fn) : 0;
  const best = fn ? Math.max(...filtered.map((a) => a.pct)) : 0;
  const avgTime = fn ? Math.round(filtered.reduce((s, a) => s + a.durationSec, 0) / fn) : 0;

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let va: any = a[sortKey], vb: any = b[sortKey];
      if (sortKey === "student" || sortKey === "group") { va = String(va).toLowerCase(); vb = String(vb).toLowerCase(); }
      return va < vb ? -sortDir : va > vb ? sortDir : 0;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const sortBy = (k: typeof sortKey) => {
    if (sortKey === k) setSortDir((d) => -d);
    else { setSortKey(k); setSortDir(k === "student" || k === "group" ? 1 : -1); }
  };
  const arrow = (k: string) => (sortKey === k ? (sortDir > 0 ? " ▲" : " ▼") : "");

  const exportCSV = () => {
    const head = ["Estudiante", "Comision", "Puntaje", "Total", "Porcentaje", "Tiempo_seg", "Automatica", "Fecha"];
    const rows = filtered.map((a) => [a.student, a.group, a.score, a.total, a.pct, a.durationSec, a.auto ? "si" : "no", new Date(a.date).toLocaleString("es-AR")]);
    const csv = [head, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = "resultados_oatec.csv"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <main className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 flex-wrap mb-1">
        <div className="font-mono text-xs tracking-widest uppercase text-cyan2 flex-1">Panel docente</div>
        <Link href="/teacher/new" className={buttonVariants({ variant: "primary" })}><HugeiconsIcon icon={PlusSignIcon} />Nuevo simulacro</Link>
        <ExamSwitcher examList={examList} examId={examId} />
      </div>
      <h1 className="font-disp text-2xl text-ink mb-4">Resultados del curso</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-5">
        {[
          { v: fn, l: "Intentos registrados" },
          { v: `${avg}%`, l: "Promedio del curso" },
          { v: `${best}%`, l: "Mejor resultado" },
          { v: fmtClock(avgTime), l: "Tiempo promedio", mono: true },
        ].map((k, i) => (
          <div key={i} className="card p-4">
            <div className={`font-disp text-2xl text-ink ${k.mono ? "font-mono text-xl" : ""}`}>{k.v}</div>
            <div className="text-xs text-[#656565] mt-0.5">{k.l}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-1.5 border-b border-(--line) mb-4">
        {([["alumnos", "Por estudiante"], ["preguntas", "Dificultad por pregunta"], ["temas", "Desempeño por tema"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-3.5 py-2.5 font-disp font-semibold text-sm -mb-px border-b-2 ${tab === k ? "text-ink border-brand" : "text-[#656565] border-transparent"}`}>{l}</button>
        ))}
      </div>

      {n === 0 && tab !== "preguntas" && tab !== "temas" ? (
        <div className="card p-14 text-center text-[#656565]">
          Todavía no hay intentos para este simulacro.
        </div>
      ) : null}

      {tab === "alumnos" && n > 0 && (
        <>
          <div className="flex items-center gap-2.5 mb-3 flex-wrap">
            <Input
              value={studentQuery}
              onChange={(e) => setStudentQuery(e.target.value)}
              placeholder="Buscar alumno…"
              className="h-9 w-52 text-sm"
            />
            {groups.length > 0 && (
              <select
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value)}
                className="h-9 rounded-lg border border-grey-100 bg-white px-3 text-sm text-ink"
              >
                <option value="">Todas las comisiones</option>
                {groups.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            )}
            <div className="flex-1 text-sm text-grey-600">
              {fn} de {n} intento{n !== 1 ? "s" : ""}{fn !== n ? " (filtrado)" : ""}
            </div>
            <Button variant="secondary" onClick={exportCSV}><HugeiconsIcon icon={Download01Icon} />Exportar CSV</Button>
          </div>
          {fn === 0 ? (
            <div className="card p-10 text-center text-grey-600">Ningún intento coincide con el filtro.</div>
          ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left">
                  {([["student", "Estudiante"], ["group", "Comisión"], ["pct", "Puntaje"], ["durationSec", "Tiempo"], ["date", "Fecha"]] as const).map(([k, l]) => (
                    <th key={k} onClick={() => sortBy(k)} className="font-mono text-[11px] uppercase tracking-wide text-[#656565] font-medium p-3 border-b border-(--line) cursor-pointer">{l}{arrow(k)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((a) => (
                  <tr key={a.id} className="hover:bg-[#fffcf5]">
                    <td className="p-3 border-b border-[#f2f2f2]"><b>{a.student}</b></td>
                    <td className="p-3 border-b border-[#f2f2f2] text-[#656565]">{a.group}</td>
                    <td className="p-3 border-b border-[#f2f2f2]">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-[#f2f2f2] rounded min-w-[70px] overflow-hidden">
                          <div className="h-full rounded" style={{ width: `${a.pct}%`, background: barColor(a.pct) }} />
                        </div>
                        <Badge variant={pctBadgeVariant(a.pct)}>{a.score}/{a.total} · {a.pct}%</Badge>
                      </div>
                    </td>
                    <td className="p-3 border-b border-[#f2f2f2] font-mono text-[13px]">{fmtClock(a.durationSec)}{a.auto ? " ⏱" : ""}</td>
                    <td className="p-3 border-b border-[#f2f2f2] text-[#656565] text-[13px]">{a.dateLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </>
      )}

      {tab === "preguntas" && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left">
                {["N.º", "Tema", "% de aciertos del grupo", "Correcta"].map((h) => (
                  <th key={h} className="font-mono text-[11px] uppercase tracking-wide text-[#656565] font-medium p-3 border-b border-(--line)">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {questionStats.map((s) => (
                <tr key={s.number} className="hover:bg-[#fffcf5]">
                  <td className="p-3 border-b border-[#f2f2f2] font-mono font-bold">{String(s.number).padStart(2, "0")}</td>
                  <td className="p-3 border-b border-[#f2f2f2] text-[#656565]">{s.topic}</td>
                  <td className="p-3 border-b border-[#f2f2f2]">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-[#f2f2f2] rounded min-w-[70px] overflow-hidden">
                        <div className="h-full rounded" style={{ width: `${s.pct ?? 0}%`, background: barColor(s.pct) }} />
                      </div>
                      <Badge variant={pctBadgeVariant(s.pct)}>{s.pct == null ? "s/d" : `${s.pct}% (${s.ok}/${s.tot})`}</Badge>
                    </div>
                  </td>
                  <td className="p-3 border-b border-[#f2f2f2] font-mono font-bold text-green2">{s.correct}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "temas" && (
        <div className="card p-6">
          {topicStats.map((r) => (
            <div key={r.topic} className="flex items-center gap-3 my-2">
              <div className="w-52 text-sm text-ink2 shrink-0">{r.topic}</div>
              <div className="flex-1 h-2.5 bg-[#f2f2f2] rounded overflow-hidden">
                <div className="h-full rounded" style={{ width: `${r.pct ?? 0}%`, background: barColor(r.pct) }} />
              </div>
              <div className="font-mono text-xs text-[#656565] w-12 text-right">{r.pct == null ? "s/d" : `${r.pct}%`}</div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
