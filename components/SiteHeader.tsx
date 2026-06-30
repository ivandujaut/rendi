"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignedIn, UserButton } from "@clerk/nextjs";

/**
 * Header global. Durante el onboarding ocultamos el link "Panel docente"
 * (es prematuro y aprieta en mobile) pero dejamos el UserButton para poder
 * salir. En sign-in/up el usuario está deslogueado, así que <SignedIn> ya
 * oculta toda la navegación.
 */
export function SiteHeader() {
  const pathname = usePathname();
  const isOnboarding = pathname === "/onboarding";

  return (
    <header className="bg-white border-b border-grey-100">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/exams" className="font-disp text-xl font-bold tracking-tight" aria-label="Rendi">
          <span className="text-yellow">R</span><span className="text-ink">endi</span>
        </Link>
        <SignedIn>
          <div className="flex items-center gap-4">
            {!isOnboarding && (
              <Link href="/teacher" className="text-sm font-medium text-grey-600 hover:text-ink">
                Panel docente
              </Link>
            )}
            <UserButton afterSignOutUrl="/sign-in" />
          </div>
        </SignedIn>
      </div>
    </header>
  );
}
