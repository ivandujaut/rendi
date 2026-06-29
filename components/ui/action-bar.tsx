import * as React from "react";
import { cn } from "@/lib/utils";

export interface ActionBarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Nodo alineado a la izquierda (ej. un botón "Atrás"). */
  back?: React.ReactNode;
  /** Clase del contenedor interno (ancho/centrado). */
  contentClassName?: string;
}

/**
 * Action bar — réplica del "Action bar" de Figma: barra (footer) full-width
 * con fondo cream, borde y sombra superior. Coloca acciones a la derecha y,
 * opcionalmente, un control a la izquierda. Los botones se pasan como children.
 */
export function ActionBar({ back, children, className, contentClassName, ...props }: ActionBarProps) {
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
          "mx-auto flex max-w-3xl items-center gap-4",
          back ? "justify-between" : "justify-end",
          contentClassName
        )}
      >
        {back}
        <div className="flex items-center gap-4">{children}</div>
      </div>
    </div>
  );
}
