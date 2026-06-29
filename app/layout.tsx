import type { Metadata } from "next";
import { ClerkProvider, SignedIn, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import "./globals.css";
import { Figtree } from "next/font/google";
import { cn } from "@/lib/utils";

const figtree = Figtree({subsets:['latin'],variable:'--font-figtree'});

export const metadata: Metadata = {
  title: "Rendi",
  description: "Rendi — práctica para la competencia OATec.",
};

// Tema de marca para el widget de Clerk (sign-in / sign-up / UserButton).
const clerkAppearance = {
  variables: {
    colorPrimary: "#ffbb00",
    colorText: "#3a3a3a",
    colorInputText: "#3a3a3a",
    colorInputBackground: "#ffffff",
    colorDanger: "#e31d1c",
    borderRadius: "0.5rem",
    fontFamily: "var(--font-sans)",
  },
  elements: {
    formButtonPrimary:
      "bg-[linear-gradient(195deg,var(--color-yellow-light)_0%,var(--color-yellow)_100%)] text-ink! font-semibold normal-case hover:brightness-[0.97]",
    formFieldInput: "border-grey-100 focus:border-ink",
    card: "border border-grey-100",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider appearance={clerkAppearance}>
      <html lang="es" className={cn("font-sans", figtree.variable)}>
        <body>
          <header className="bg-white border-b border-grey-100">
            <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
              <Link href="/exams" className="font-disp text-xl font-bold tracking-tight" aria-label="Rendi">
                <span className="text-yellow">R</span><span className="text-ink">endi</span>
              </Link>
              <SignedIn>
                <div className="flex items-center gap-4">
                  <Link href="/teacher" className="text-sm font-medium text-grey-600 hover:text-ink">
                    Panel docente
                  </Link>
                  <UserButton afterSignOutUrl="/sign-in" />
                </div>
              </SignedIn>
            </div>
          </header>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
