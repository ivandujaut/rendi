"use client";

import Link from "next/link";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { buttonVariants } from "@/components/ui/button";

/**
 * Navbar de la landing. Va dentro del hero (sobre el gráfico amarillo).
 * Logueado: acceso directo a la app + tu foto. Deslogueado: "Ingresar".
 */
export function LandingNav() {
  return (
    <div className="flex h-16 items-center justify-between">
      <Link href="/" className="inline-flex items-center" aria-label="Parcialito">
        {/* Sobre el hero amarillo: variante tinta (la p amarilla se perdería). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-ink.svg" alt="" className="h-7 w-auto" />
      </Link>
      <div className="flex items-center gap-3">
        <SignedIn>
          <Link href="/exams" className={buttonVariants({ variant: "accent", size: "md" })}>
            Entrar a Parcialito
          </Link>
          <UserButton afterSignOutUrl="/" />
        </SignedIn>
        <SignedOut>
          <Link href="/sign-in" className={buttonVariants({ variant: "accent", size: "md" })}>
            Ingresar
          </Link>
        </SignedOut>
      </div>
    </div>
  );
}
