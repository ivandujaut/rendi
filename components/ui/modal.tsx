"use client";

import { Dialog } from "@base-ui/react/dialog";

/**
 * Modal accesible construido sobre Base UI `Dialog` (ya es dependencia): trae
 * focus-trap, restauración del foco al cerrar, Escape, fondo inerte para lectores
 * de pantalla y bloqueo de scroll — todo gratis. Mantiene la API simple
 * (`open`/`onClose`/`labelledBy`) de los overlays que reemplaza.
 *
 * `dismissible={false}` para estados terminales (ej. "se acabó el tiempo"): se
 * ignora el pedido de cierre por Escape/backdrop manteniendo `open`, así el alumno
 * no puede volver al examen ya entregado.
 */
export function Modal({
  open,
  onClose,
  labelledBy,
  dismissible = true,
  children,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy?: string;
  dismissible?: boolean;
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
        <Dialog.Popup
          aria-labelledby={labelledBy}
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md max-h-[85vh] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-6 outline-none"
        >
          {children}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
