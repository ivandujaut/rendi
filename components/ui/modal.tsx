"use client";

import { Dialog } from "@base-ui/react/dialog";
import { cn } from "@/lib/utils";

/**
 * Modal accesible construido sobre Base UI `Dialog` (ya es dependencia): trae
 * focus-trap, restauración del foco al cerrar, Escape, fondo inerte para lectores
 * de pantalla y bloqueo de scroll — todo gratis. Mantiene la API simple
 * (`open`/`onClose`/`labelledBy`) de los overlays que reemplaza.
 *
 * `dismissible={false}` para estados terminales (ej. "se acabó el tiempo").
 *
 * `sheet` = en mobile aparece como bottom-sheet (anclado abajo, ancho completo,
 * subiendo desde el borde) y en escritorio queda centrado. Solo tiene sentido para
 * diálogos ricos que se usan en el celular (ej. el repaso antes de entregar). El
 * centrado de escritorio va por `margin:auto` (no `translate`) para no chocar con la
 * animación de subida.
 */
const CENTERED =
  "fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md max-h-[85vh] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-6 outline-none";

const SHEET =
  "fixed inset-x-0 bottom-0 z-50 w-full max-h-[85vh] overflow-y-auto rounded-t-2xl bg-white p-6 outline-none " +
  "sm:inset-0 sm:m-auto sm:h-fit sm:w-[calc(100%-2rem)] sm:max-w-md sm:rounded-2xl " +
  "animate-in fade-in slide-in-from-bottom-4 duration-200";

export function Modal({
  open,
  onClose,
  labelledBy,
  dismissible = true,
  sheet = false,
  children,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy?: string;
  dismissible?: boolean;
  sheet?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next && dismissible) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-[rgba(58,58,58,.5)]" />
        <Dialog.Popup aria-labelledby={labelledBy} className={cn(sheet ? SHEET : CENTERED)}>
          {children}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
