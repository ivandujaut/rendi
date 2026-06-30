import * as React from "react";
import { cn } from "@/lib/utils";

export interface CheckboxProps {
  checked: boolean;
  /** Si se pasa, el checkbox es interactivo (botón role=checkbox). Si no, es decorativo. */
  onCheckedChange?: () => void;
  shape?: "square" | "round";
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

/** Tilde blanco centrado (jam-icons check del Figma). */
function CheckMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="size-[15px]" aria-hidden>
      <path d="M5 12.5 10 17.5 19 7" />
    </svg>
  );
}

/**
 * Checkbox — réplica del set "test-checkbox" del Figma: cuadrado (borde grey-600)
 * o redondo (borde grey-100); seleccionado = gradiente amarillo de marca + tilde
 * blanco. Decorativo por defecto; interactivo si se pasa `onCheckedChange`.
 */
export function Checkbox({
  checked,
  onCheckedChange,
  shape = "square",
  disabled,
  className,
  ...props
}: CheckboxProps) {
  const interactive = !!onCheckedChange;
  const classes = cn(
    "grid size-6 shrink-0 place-items-center text-white transition-colors outline-none",
    shape === "round" ? "rounded-full" : "rounded-[3px]",
    checked
      ? "border border-transparent bg-[linear-gradient(225deg,var(--color-yellow-light)_0%,var(--color-yellow)_100%)]"
      : cn("border bg-white", shape === "round" ? "border-grey-100" : "border-grey-600"),
    interactive && !disabled && "cursor-pointer focus-visible:ring-2 focus-visible:ring-ring/60",
    disabled && "cursor-not-allowed opacity-50",
    className
  );

  if (!interactive) {
    return (
      <span aria-hidden className={classes}>
        {checked && <CheckMark />}
      </span>
    );
  }
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={onCheckedChange}
      className={classes}
      {...props}
    >
      {checked && <CheckMark />}
    </button>
  );
}
