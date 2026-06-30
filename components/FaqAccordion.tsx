"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon } from "@hugeicons/core-free-icons";

/**
 * FAQ desplegable (patrón clásico tipo Stripe / Tailwind UI): cada pregunta es
 * una fila clickeable con chevron que rota; la respuesta se despliega con una
 * transición de altura suave (técnica grid-rows 0fr→1fr). Single-open.
 */
export function FaqAccordion({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="grid gap-3">
      {items.map((f, i) => {
        const isOpen = open === i;
        return (
          <div key={f.q} className="card overflow-hidden">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="flex w-full cursor-pointer items-center justify-between gap-4 p-6 text-left"
            >
              <span className="font-disp font-bold text-ink">{f.q}</span>
              <span className={cn("shrink-0 text-grey-600 transition-transform duration-300", isOpen && "rotate-180")}>
                <HugeiconsIcon icon={ArrowDown01Icon} size={20} />
              </span>
            </button>
            <div
              className={cn(
                "grid transition-[grid-template-rows] duration-300 ease-out",
                isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
              )}
            >
              <div className="overflow-hidden">
                <p className="px-6 pb-6 text-[#656565] leading-relaxed">{f.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
