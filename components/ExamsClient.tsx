"use client";

import { useState } from "react";
import { buttonVariants, Spinner } from "@/components/ui/button";
import { PendingLink } from "@/components/ui/pending-link";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon, CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";

export type StudentExam = {
  id: string;
  title: string;
  year: number | null;
  durationMin: number;
  completed: boolean;
  lastResultId: string | null;
};

type Tab = "practica" | "examenes";

const TABS = [
  ["practica", "Práctica"],
  ["examenes", "Exámenes"],
] as const;

/** Flecha que se reemplaza por spinner cuando el link está navegando (aria-busy). */
function ActionIcon() {
  return (
    <>
      <HugeiconsIcon icon={ArrowRight01Icon} className="group-aria-[busy=true]:hidden" />
      <Spinner className="hidden group-aria-[busy=true]:block" />
    </>
  );
}

function ExamMeta({ children }: { children: React.ReactNode }) {
  return <div className="text-sm text-[#656565] font-mono mt-1">{children}</div>;
}

/**
 * Panel del alumno con pestañas Práctica / Exámenes. Antes cada card tenía los dos
 * botones mezclados; ahora se separan por modo, cada uno con su contexto: práctica
 * es sin nota / sin tiempo / con explicaciones e ilimitada; examen es con nota,
 * cronometrado y con un solo intento (muestra el estado entregado).
 */
export default function ExamsClient({ exams }: { exams: StudentExam[] }) {
  const [tab, setTab] = useState<Tab>("practica");

  return (
    <>
      <div className="flex gap-1.5 border-b border-(--line) mb-5">
        {TABS.map(([k, l]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            aria-current={tab === k}
            className={`px-3.5 py-2.5 font-disp font-semibold text-sm -mb-px border-b-2 ${
              tab === k ? "text-ink border-brand" : "text-[#656565] border-transparent hover:text-ink"
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      <p className="text-[#656565] text-sm mb-5">
        {tab === "practica"
          ? "Sin nota y sin límite de tiempo, con explicaciones al instante. Practicá las veces que quieras."
          : "Con nota y cronometrado. Tenés un intento por examen."}
      </p>

      <div className="grid gap-4">
        {exams.map((e) =>
          tab === "practica" ? (
            <div key={e.id} className="card p-5 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="font-disp font-semibold text-lg text-ink">{e.title}</div>
                <ExamMeta>opción múltiple A–E{e.year ? ` · ${e.year}` : ""}</ExamMeta>
              </div>
              <PendingLink
                href={`/exam/${e.id}?mode=practice`}
                spinner={false}
                className={buttonVariants({ variant: "primary", size: "md" })}
              >
                Practicar
                <ActionIcon />
              </PendingLink>
            </div>
          ) : (
            <div key={e.id} className="card p-5 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-disp font-semibold text-lg text-ink">{e.title}</span>
                  {e.completed && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#eaf6f0] text-[#23925F] text-xs font-semibold px-2 py-0.5">
                      <HugeiconsIcon icon={CheckmarkCircle02Icon} size={13} />
                      Entregado
                    </span>
                  )}
                </div>
                <ExamMeta>
                  {e.durationMin} min · 1 intento{e.year ? ` · ${e.year}` : ""}
                </ExamMeta>
              </div>
              {e.completed && e.lastResultId ? (
                <PendingLink
                  href={`/result/${e.lastResultId}`}
                  className={buttonVariants({ variant: "secondary" })}
                >
                  Ver resultado
                </PendingLink>
              ) : (
                <PendingLink
                  href={`/exam/${e.id}`}
                  spinner={false}
                  className={buttonVariants({ variant: "primary" })}
                >
                  Rendir
                  <ActionIcon />
                </PendingLink>
              )}
            </div>
          ),
        )}
      </div>
    </>
  );
}
