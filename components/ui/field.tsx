import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Estilos base del control (input / select / textarea) — réplica del set
 * "Inputs" de Figma: borde grey-100, radio 8px, texto 14px, placeholder
 * grey-300, focus borde ink, error rojo, disabled gris.
 */
export const fieldBase =
  "w-full rounded-lg border border-grey-100 bg-white font-sans text-sm text-ink leading-[1.6] outline-none transition-colors placeholder:text-grey-300 focus:border-ink focus-visible:border-ink disabled:cursor-not-allowed disabled:bg-grey-100 disabled:text-grey-300 aria-[invalid=true]:border-[#e31d1c] aria-[invalid=true]:focus:border-[#e31d1c]";

export interface FieldProps {
  label?: React.ReactNode;
  htmlFor?: string;
  error?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

/** Wrapper label + control + mensaje de error (layout del Figma, gap 4px). */
export function Field({ label, htmlFor, error, className, children }: FieldProps) {
  return (
    <div className={cn("flex w-full flex-col gap-1", className)}>
      {label && (
        <label htmlFor={htmlFor} className="text-sm leading-[1.6] text-ink">
          {label}
        </label>
      )}
      {children}
      {error && <p className="text-xs font-semibold leading-4 text-[#ff1a5d]">{error}</p>}
    </div>
  );
}
