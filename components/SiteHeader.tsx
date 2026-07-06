"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignedIn, UserButton } from "@clerk/nextjs";
import { PendingLink } from "@/components/ui/pending-link";

/**
 * Header global de la app (no de la landing). Muestra el link al panel docente
 * (solo a docentes, y oculto durante el onboarding) + UserButton. En la landing
 * devolvemos null: ahí el navbar lo renderiza el propio hero (LandingNav) para
 * que el gráfico amarillo pueda sangrar por detrás hasta el borde superior.
 */
export function SiteHeader({ isTeacher = false }: { isTeacher?: boolean }) {
  const pathname = usePathname();
  if (pathname === "/") return null;
  const isOnboarding = pathname === "/onboarding";

  return (
    <header className="bg-white border-b border-grey-100">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="inline-flex items-center" aria-label="Parcialito">
          {/* Fondo blanco: variante color (p amarilla + texto gris). */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="" className="h-7 w-auto" />
        </Link>
        <SignedIn>
          <div className="flex items-center gap-4">
            {!isOnboarding && isTeacher && (
              <PendingLink href="/teacher" className="inline-flex items-center gap-1.5 text-sm font-medium text-grey-600 hover:text-ink [&_svg]:size-4">
                Panel docente
              </PendingLink>
            )}
            <UserButton afterSignOutUrl="/" />
          </div>
        </SignedIn>
      </div>
    </header>
  );
}
