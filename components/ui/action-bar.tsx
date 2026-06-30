import * as React from "react";
import { cn } from "@/lib/utils";

export interface ActionBarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Nodo alineado a la izquierda (ej. un botón "Atrás"). */
  back?: React.ReactNode;
  /** Clase del contenedor interno (ancho/centrado). */
  contentClassName?: string;
  /**
   * En mobile apila las acciones full-width (primario arriba, back abajo) y
   * pasa a fila izq/der desde `sm`. Los botones deben llevar `w-full sm:w-auto`.
   */
  stack?: boolean;
}

/**
 * Action bar — réplica del "Action bar" de Figma: barra (footer) full-width
 * con fondo cream, borde y sombra superior. Coloca acciones a la derecha y,
 * opcionalmente, un control a la izquierda. Los botones se pasan como children.
 */
export function ActionBar({ back, children, className, contentClassName, stack = false, ...props }: ActionBarProps) {
  return (
    <div
      className={cn(
        "w-full border-t border-grey-100 bg-cream px-4 pb-7 pt-6 shadow-[0_-2px_2px_rgba(0,0,0,0.05)]",
        className
      )}
      {...props}
    >
      <div
        className={cn(
          "mx-auto flex gap-4",
          // stack: columna centrada (mobile + tablet) → fila ancha en desktop.
          stack
            ? "max-w-md flex-col-reverse gap-3 lg:max-w-2xl lg:flex-row lg:items-center"
            : "max-w-3xl items-center",
          stack
            ? back ? "lg:justify-between" : "lg:justify-end"
            : back ? "justify-between" : "justify-end",
          contentClassName
        )}
      >
        {back}
        <div className={cn("flex items-center gap-4", stack && "w-full lg:w-auto [&>*]:w-full lg:[&>*]:w-auto")}>
          {children}
        </div>
      </div>
    </div>
  );
}
