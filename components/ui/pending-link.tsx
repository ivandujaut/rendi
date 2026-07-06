"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/button";

/**
 * Link con feedback de carga: cuando la página destino corre trabajo server-side
 * (un RPC, una consulta), el click deja al usuario esperando sin señal. Este link
 * muestra un spinner desde el click hasta que la navegación resuelve.
 *
 * Conserva la semántica de <Link>: prefetch, y cmd/ctrl/click-medio siguen
 * abriendo en pestaña nueva (solo interceptamos el click izquierdo simple).
 * Next 15.1 no tiene `useLinkStatus` (llegó en 15.3), así que usamos
 * `useTransition` + `router.push`, que mantiene el pending hasta que la ruta
 * nueva termina de renderizar en el servidor.
 *
 * El estado pending se expone como `aria-busy` en el link (que además es `group`),
 * así el spinner se controla por CSS y todos los props siguen siendo serializables
 * (esto se renderiza desde Server Components, que no pueden pasar funciones). Por
 * defecto se antepone un spinner; con `spinner={false}` lo colocás vos en los hijos
 * usando `group-aria-[busy=true]:block` / `group-aria-[busy=true]:hidden` (p. ej.
 * para reemplazar una flecha por el spinner dentro de un botón).
 */
export function PendingLink({
  href,
  className,
  children,
  spinner = true,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
  spinner?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Link
      href={href}
      aria-busy={pending || undefined}
      className={cn("group", className)}
      style={pending ? { pointerEvents: "none" } : undefined}
      onClick={(e) => {
        // Dejar que el navegador maneje abrir-en-pestaña-nueva.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        startTransition(() => router.push(href));
      }}
    >
      {spinner && <Spinner className="hidden group-aria-[busy=true]:block" />}
      {children}
    </Link>
  );
}
