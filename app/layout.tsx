import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { esVos } from "@/lib/clerkLocalization";
import "./globals.css";
import { Figtree } from "next/font/google";
import { cn } from "@/lib/utils";
import { SiteHeader } from "@/components/SiteHeader";

const figtree = Figtree({subsets:['latin'],variable:'--font-figtree'});

export const metadata: Metadata = {
  title: "Parcialito",
  description: "Parcialito — práctica para la competencia OATec.",
};

// Tema de marca para el widget de Clerk (sign-in / sign-up / UserButton).
const clerkAppearance = {
  variables: {
    // Ink (no amarillo): los links y acciones del widget de Clerk (Administrar
    // cuenta, links de sign-in, nav activo) usan colorPrimary; en amarillo sobre
    // blanco reprobaban WCAG. El CTA principal sigue amarillo vía formButtonPrimary.
    colorPrimary: "#3a3a3a",
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
    // Quita la flechita del botón primario de Clerk.
    buttonArrowIcon: "hidden!",
    // El widget se funde en el panel crema del AuthShell: sin card visible y
    // sin el header propio de Clerk (mostramos nuestro <h1>). El UserButton usa
    // otros slots (userButtonPopover*), así que no se ve afectado.
    // overflow-visible! + padding: el card de Clerk recorta por defecto, lo que
    // cortaba los bordes/sombras de inputs y botones contra el borde.
    rootBox: "w-full overflow-visible!",
    cardBox: "w-full border-0! shadow-none! overflow-visible!",
    card: "bg-transparent! border-0! shadow-none! w-full overflow-visible! p-1!",
    header: "hidden!",
    footer: "bg-transparent!",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider appearance={clerkAppearance} localization={esVos}>
      <html lang="es" className={cn("font-sans", figtree.variable)}>
        <body>
          <SiteHeader />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
