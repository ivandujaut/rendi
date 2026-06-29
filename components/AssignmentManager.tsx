"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge, pctBadgeVariant } from "@/components/ui/badge";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";

type Student = {
  id: string; name: string; group: string | null;
  assigned: boolean; attemptsAllowed: number; submittedCount: number; bestPct: number | null;
};

export function AssignmentManager({ examId, examTitle, students }: {
  examId: string; examTitle: string; students: Student[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  async function call(method: string, body: object, sid: string) {
    setBusy(sid);
    try {
      await fetch(`/api/exams/${examId}/assignments`, {
        method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }
  const toggle = (s: Student) => call(s.assigned ? "DELETE" : "POST", { studentId: s.id }, s.id);
  const retry = (s: Student) => call("PATCH", { studentId: s.id, attempts_allowed: s.attemptsAllowed + 1 }, s.id);

  const filtered = students.filter((s) => !query || s.name.toLowerCase().includes(query.trim().toLowerCase()));
  const assignedCount = students.filter((s) => s.assigned).length;

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <Link href="/teacher" className="font-mono text-xs text-grey-600 hover:text-ink inline-flex items-center gap-1 mb-3">
        <HugeiconsIcon icon={ArrowLeft01Icon} size={14} />Volver al panel
      </Link>
      <h1 className="font-disp text-2xl text-ink mb-1">Asignar alumnos</h1>
      <p className="text-sm text-grey-600 mb-5">
        {examTitle} · <b className="text-ink">{assignedCount}</b> de {students.length} alumno{students.length !== 1 ? "s" : ""} asignado{assignedCount !== 1 ? "s" : ""}
      </p>

      {students.length === 0 ? (
        <div className="card p-10 text-center text-grey-600">Todavía no hay alumnos registrados.</div>
      ) : (
        <>
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar alumno…" className="h-9 mb-4 max-w-xs" />
          <div className="card divide-y divide-(--line)">
            {filtered.map((s) => (
              <div key={s.id} className="flex items-center gap-3 p-3.5">
                <input
                  type="checkbox"
                  checked={s.assigned}
                  disabled={busy === s.id}
                  onChange={() => toggle(s)}
                  className="size-4 accent-[#ffbb00] cursor-pointer"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-ink truncate">{s.name}</div>
                  {s.group && <div className="text-xs font-mono text-grey-600">{s.group}</div>}
                </div>
                {s.submittedCount > 0 ? (
                  <Badge variant={pctBadgeVariant(s.bestPct)}>Rindió · {s.bestPct}%</Badge>
                ) : s.assigned ? (
                  <Badge variant="muted">Pendiente</Badge>
                ) : null}
                {s.assigned && s.submittedCount > 0 && s.submittedCount < s.attemptsAllowed && (
                  <Badge variant="warning">Puede repetir</Badge>
                )}
                {s.assigned && s.submittedCount > 0 && s.submittedCount >= s.attemptsAllowed && (
                  <Button variant="secondary" size="sm" disabled={busy === s.id} onClick={() => retry(s)}>Re-habilitar</Button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
