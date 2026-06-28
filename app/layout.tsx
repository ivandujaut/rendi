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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="es" className={cn("font-sans", figtree.variable)}>
        <body>
          <header className="bg-ink text-[#eaf1fa] border-b border-[#08263f]">
            <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
              <Link href="/exams" className="font-disp font-semibold flex items-center gap-2">
                <span className="w-5 h-5 rounded-full border-2 border-[#5FC8CF] inline-block" />
                Rendi
              </Link>
              <SignedIn>
                <div className="flex items-center gap-4">
                  <Link href="/teacher" className="text-sm text-[#9DB9D4] hover:text-white font-mono">
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
