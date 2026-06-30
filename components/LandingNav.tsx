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
      <Link href="/" className="font-disp text-xl font-bold tracking-tight" aria-label="Rendi">
        <span className="text-yellow">R</span><span className="text-ink">endi</span>
      </Link>
      <div className="flex items-center gap-3">
        <SignedIn>
          <Link href="/exams" className={buttonVariants({ variant: "accent", size: "sm" })}>
            Entrar a Rendi
          </Link>
          <UserButton afterSignOutUrl="/" />
        </SignedIn>
        <SignedOut>
          <Link href="/sign-in" className={buttonVariants({ variant: "accent", size: "sm" })}>
            Ingresar
          </Link>
        </SignedOut>
      </div>
    </div>
  );
}
