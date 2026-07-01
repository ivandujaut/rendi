"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge, pctBadgeVariant } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  // Copia local para UI optimista; se reconcilia cuando el server refresca.
  const [list, setList] = useState(students);
  useEffect(() => setList(students), [students]);

  const patchLocal = (id: string, changes: Partial<Student>) =>
    setList((prev) => prev.map((s) => (s.id === id ? { ...s, ...changes } : s)));

  async function call(method: string, body: object, sid: string, optimistic: Partial<Student>) {
    patchLocal(sid, optimistic); // refleja el cambio al instante
    setBusy(sid);
    try {
      const res = await fetch(`/api/exams/${examId}/assignments`, {
        method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (!res.ok) {
        // revierte ese alumno al valor del server
        const server = students.find((x) => x.id === sid);
        if (server) patchLocal(sid, server);
        return;
      }
      router.refresh();
    } catch {
      const server = students.find((x) => x.id === sid);
      if (server) patchLocal(sid, server);
    } finally {
      setBusy(null);
    }
  }
  const toggle = (s: Student) => {
    if (s.assigned) return call("DELETE", { studentId: s.id }, s.id, { assigned: false });
    // Si ya rindió antes, lo re-habilitamos con un intento extra de una.
    if (s.submittedCount > 0) {
      const attempts = s.submittedCount + 1;
      return call("POST", { studentId: s.id, attempts_allowed: attempts }, s.id, {
        assigned: true,
        attemptsAllowed: attempts,
      });
    }
    return call("POST", { studentId: s.id }, s.id, { assigned: true, attemptsAllowed: 1 });
  };
  const retry = (s: Student) =>
    call("PATCH", { studentId: s.id, attempts_allowed: s.attemptsAllowed + 1 }, s.id, {
      attemptsAllowed: s.attemptsAllowed + 1,
    });

  const filtered = list.filter((s) => !query || s.name.toLowerCase().includes(query.trim().toLowerCase()));
  const assignedCount = list.filter((s) => s.assigned).length;

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <Link href="/teacher" className="font-mono text-xs text-grey-600 hover:text-ink inline-flex items-center gap-1 mb-3">
        <HugeiconsIcon icon={ArrowLeft01Icon} size={14} />Volver al panel
      </Link>
      <h1 className="font-disp text-2xl text-ink mb-1">Asignar alumnos</h1>
      <p className="text-sm text-grey-600 mb-1">
        {examTitle} · <b className="text-ink">{assignedCount}</b> de {students.length} alumno{students.length !== 1 ? "s" : ""} asignado{assignedCount !== 1 ? "s" : ""}
      </p>
      <p className="text-sm text-grey-600 mb-5">
        Tildá un alumno para <b className="text-ink">habilitarle</b> este simulacro; destildalo para quitarle el acceso.
      </p>

      {students.length === 0 ? (
        <div className="card p-10 text-center text-grey-600">Todavía no hay alumnos registrados.</div>
      ) : (
        <>
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar alumno…" className="h-9 mb-4 max-w-xs" />
          <div className="card divide-y divide-(--line)">
            {filtered.map((s) => (
              <div key={s.id} className="flex items-center gap-3 p-3.5">
                <Checkbox
                  checked={s.assigned}
                  disabled={busy === s.id}
                  onCheckedChange={() => toggle(s)}
                  aria-label={`${s.assigned ? "Quitar acceso a" : "Habilitar a"} ${s.name}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-ink truncate">{s.name}</div>
                  {s.group && <div className="text-xs font-mono text-grey-600">{s.group}</div>}
                </div>
                {s.submittedCount > 0 ? (
                  <Badge variant={pctBadgeVariant(s.bestPct)}>Rindió · {s.bestPct}%</Badge>
                ) : s.assigned ? (
                  <Badge variant="success">Habilitado · sin rendir</Badge>
                ) : null}
                {s.assigned && s.submittedCount > 0 && s.submittedCount < s.attemptsAllowed && (
                  <Badge variant="warning">Puede repetir</Badge>
                )}
                {s.assigned && s.submittedCount > 0 && s.submittedCount >= s.attemptsAllowed && (
                  <Button variant="secondary" size="sm" loading={busy === s.id} onClick={() => retry(s)}>Re-habilitar</Button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
