import * as React from "react";
import { cn } from "@/lib/utils";

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Avance 0-100. */
  value: number;
  /** Texto a la izquierda debajo de la barra (ej. "Improving"). */
  label?: React.ReactNode;
  /** Texto a la derecha debajo de la barra (ej. "1/5 completed"). */
  caption?: React.ReactNode;
  trackClassName?: string;
  /** Permite cambiar el relleno (ej. colores semánticos). */
  barClassName?: string;
}

/**
 * Progress bar — réplica del "Progress bar for feedback" de Figma:
 * track blanco con borde grey-100 y padding, relleno gradiente amarillo,
 * con label/caption opcionales debajo.
 */
export function Progress({ value, label, caption, className, trackClassName, barClassName, ...props }: ProgressProps) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("flex w-full flex-col gap-2", className)} {...props}>
      <div className={cn("w-full rounded-[10px] border border-grey-100 bg-white p-1", trackClassName)}>
        <div
          role="progressbar"
          aria-valuenow={Math.round(pct)}
          aria-valuemin={0}
          aria-valuemax={100}
          className={cn(
            "h-1.5 rounded-[10px] bg-[linear-gradient(182deg,var(--color-yellow-light)_0%,var(--color-yellow)_100%)] transition-[width] duration-300",
            barClassName
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      {(label || caption) && (
        <div className="flex items-center justify-between">
          {label && <span className="font-sans text-base font-semibold leading-tight text-ink">{label}</span>}
          {caption && <span className="font-sans text-sm text-grey-600">{caption}</span>}
        </div>
      )}
    </div>
  );
}
