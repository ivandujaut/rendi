"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useMutation } from "@/lib/hooks/use-mutation";
import { apiRequest } from "@/lib/api/client";

/**
 * Dispara la corrección con IA on-demand para las respuestas de desarrollo de este
 * examen que aún no tienen borrador. Antes el docente dependía del cron (que no corría
 * en staging y era diario en prod), así que la cola quedaba en "Esperando la corrección
 * de la IA…" para siempre. `useMutation` refresca el server component al terminar, así
 * los borradores aparecen sin recargar a mano.
 */
export function GradeNowButton({ examId, pending }: { examId: string; pending: number }) {
  const { busy, error, run } = useMutation();
  const [done, setDone] = useState<{ graded: number; failed: number } | null>(null);
  const loading = busy === "grade-open";

  const grade = () =>
    run("grade-open", async () => {
      const r = (await apiRequest("/api/gradings/run", { method: "POST", body: { examId } })) as {
        graded: number;
        failed: number;
      };
      setDone(r);
    });

  return (
    <div className="mb-5 flex flex-wrap items-center gap-3">
      <Button variant="primary" size="sm" onClick={grade} loading={loading}>
        {loading ? "Corrigiendo con IA…" : `Corregir ${pending} con IA`}
      </Button>
      {done && !error && (
        <span className="text-sm text-grey-600">
          Listo: {done.graded} con borrador
          {done.failed ? ` · ${done.failed} que la IA no pudo (corregí a mano)` : ""}.
        </span>
      )}
      {error && <span className="text-sm text-red2">{error}</span>}
    </div>
  );
}
