"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge, pctBadgeVariant } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Modal } from "@/components/ui/modal";
import { useMutation } from "@/lib/hooks/use-mutation";
import { apiRequest } from "@/lib/api/client";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";

type Student = {
  id: string; name: string; group: string | null;
  assigned: boolean; attemptsAllowed: number; submittedCount: number; bestPct: number | null;
};

const NO_GROUP = "Sin comisión";

export function AssignmentManager({ examId, examTitle, students }: {
  examId: string; examTitle: string; students: Student[];
}) {
  // busy = id de alumno (acción individual) o `group:<comisión>` (masiva); null si libre.
  const { busy, run } = useMutation();
  const [query, setQuery] = useState("");
  // Comisión pendiente de confirmar para "quitar a todos" (modal in-app, no confirm() nativo).
  const [confirmGroup, setConfirmGroup] = useState<{ name: string; ids: string[] } | null>(null);
  // Copia local para UI optimista; se reconcilia cuando el server refresca.
  const [list, setList] = useState(students);
  useEffect(() => setList(students), [students]);

  const patchLocal = (ids: Set<string>, changes: Partial<Student>) =>
    setList((prev) => prev.map((s) => (ids.has(s.id) ? { ...s, ...changes } : s)));
  // Revierte los alumnos afectados al valor del server (fuente de verdad al cargar).
  const revert = (ids: Set<string>) =>
    setList((prev) => prev.map((s) => (ids.has(s.id) ? students.find((x) => x.id === s.id) ?? s : s)));

  async function call(method: string, ids: string[], busyKey: string, optimistic: Partial<Student>, extra?: object) {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    const body = ids.length === 1 ? { studentId: ids[0], ...extra } : { studentIds: ids };
    await run(busyKey, () => apiRequest(`/api/exams/${examId}/assignments`, { method, body }), {
      optimistic: () => patchLocal(idSet, optimistic), // refleja el cambio al instante
      revert: () => revert(idSet), // vuelve al valor del server si falla
    });
  }

  const toggle = (s: Student) => {
    if (s.assigned) return call("DELETE", [s.id], s.id, { assigned: false });
    // Si ya rindió antes, lo re-habilitamos con un intento extra de una.
    if (s.submittedCount > 0) {
      const attempts = s.submittedCount + 1;
      return call("POST", [s.id], s.id, { assigned: true, attemptsAllowed: attempts }, { attempts_allowed: attempts });
    }
    return call("POST", [s.id], s.id, { assigned: true, attemptsAllowed: 1 });
  };
  const retry = (s: Student) =>
    call("PATCH", [s.id], s.id, { attemptsAllowed: s.attemptsAllowed + 1 }, { attempts_allowed: s.attemptsAllowed + 1 });

  // Agrupamos por comisión; "Sin comisión" siempre al final.
  const groups = useMemo(() => {
    const map = new Map<string, Student[]>();
    for (const s of list) {
      const key = s.group ?? NO_GROUP;
      const arr = map.get(key);
      if (arr) arr.push(s); else map.set(key, [s]);
    }
    return [...map.entries()]
      .map(([name, members]) => ({ name, members }))
      .sort((a, b) =>
        a.name === NO_GROUP ? 1 : b.name === NO_GROUP ? -1 : a.name.localeCompare(b.name, "es")
      );
  }, [list]);

  const q = query.trim().toLowerCase();
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
        Tildá un alumno para <b className="text-ink">habilitarle</b> este simulacro; destildalo para quitarle el acceso. También podés habilitar una <b className="text-ink">comisión</b> entera de una.
      </p>

      {students.length === 0 ? (
        <div className="card p-10 text-center text-grey-600">Todavía no hay alumnos registrados.</div>
      ) : (
        <>
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar alumno…" className="h-9 mb-4 max-w-xs" />
          <div className="space-y-6">
            {groups.map(({ name, members }) => {
              const shown = q ? members.filter((s) => s.name.toLowerCase().includes(q)) : members;
              if (shown.length === 0) return null; // la búsqueda no toca a nadie de esta comisión

              const groupKey = `group:${name}`;
              const assignedInGroup = members.filter((s) => s.assigned).length;
              const allAssigned = assignedInGroup === members.length;
              const unassignedIds = members.filter((s) => !s.assigned).map((s) => s.id);
              const assignedIds = members.filter((s) => s.assigned).map((s) => s.id);

              return (
                <section key={name}>
                  <div className="flex items-center justify-between gap-3 mb-2 px-0.5">
                    <div className="text-sm font-semibold text-ink">
                      {name}
                      <span className="ml-2 font-normal font-mono text-xs text-grey-600">{assignedInGroup}/{members.length}</span>
                    </div>
                    {members.length > 1 && (
                      allAssigned ? (
                        <Button
                          variant="ghost" size="xs" loading={busy === groupKey}
                          onClick={() => setConfirmGroup({ name, ids: assignedIds })}
                        >
                          Quitar a todos
                        </Button>
                      ) : (
                        <Button
                          variant="secondary" size="xs" loading={busy === groupKey}
                          onClick={() => call("POST", unassignedIds, groupKey, { assigned: true, attemptsAllowed: 1 })}
                        >
                          Habilitar {unassignedIds.length}
                        </Button>
                      )
                    )}
                  </div>

                  <div className="card divide-y divide-(--line)">
                    {shown.map((s) => {
                      const rowBusy = busy === s.id || busy === groupKey;
                      return (
                        <div key={s.id} className="flex items-center gap-3 p-3.5">
                          <Checkbox
                            checked={s.assigned}
                            disabled={rowBusy}
                            onCheckedChange={() => toggle(s)}
                            aria-label={`${s.assigned ? "Quitar acceso a" : "Habilitar a"} ${s.name}`}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-ink truncate">{s.name}</div>
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
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}

      <Modal
        open={!!confirmGroup}
        onClose={() => setConfirmGroup(null)}
        labelledBy="remove-group-title"
      >
        {confirmGroup && (
          <>
            <h3 id="remove-group-title" className="font-disp text-lg text-ink mb-2">Quitar acceso a la comisión</h3>
            <p className="text-sm text-grey-600 mb-4">
              Vas a quitarle el acceso a este simulacro a{" "}
              <b className="text-ink">{confirmGroup.ids.length}</b> alumno{confirmGroup.ids.length !== 1 ? "s" : ""} de{" "}
              <b className="text-ink">{confirmGroup.name === NO_GROUP ? "sin comisión" : confirmGroup.name}</b>. Podés volver a habilitarlos cuando quieras.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => setConfirmGroup(null)} disabled={busy === `group:${confirmGroup.name}`}>
                Cancelar
              </Button>
              <Button
                variant="danger"
                loading={busy === `group:${confirmGroup.name}`}
                onClick={() => {
                  const { name, ids } = confirmGroup;
                  call("DELETE", ids, `group:${name}`, { assigned: false });
                  setConfirmGroup(null);
                }}
              >
                Quitar a todos
              </Button>
            </div>
          </>
        )}
      </Modal>
    </main>
  );
}
