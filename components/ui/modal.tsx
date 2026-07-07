"use client";

import { useEffect, useRef } from "react";

/**
 * Modal accesible: `role="dialog"` + `aria-modal`, cierra con Escape o click en el
 * backdrop, mueve el foco al panel al abrir y bloquea el scroll del body. Reemplaza
 * los overlays hechos a mano (que no tenían teclado ni semántica de diálogo).
 *
 * `labelledBy` debe apuntar al id del título del modal (para que el lector de
 * pantalla lo anuncie). No hace focus-trap completo (pendiente); con Escape + foco
 * inicial + aria-modal cubre lo principal.
 */
export function Modal({
  open,
  onClose,
  labelledBy,
  children,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy?: string;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-[rgba(58,58,58,.5)] grid place-items-center z-50 p-4" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className="bg-white rounded-2xl max-w-md w-full p-6 outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
