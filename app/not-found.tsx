import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="max-w-xl mx-auto px-4 py-16 text-center">
      <h1 className="font-disp text-2xl text-ink mb-2">No encontramos esta página</h1>
      <p className="text-[#656565] mb-6">
        El link puede estar roto o el contenido ya no existe.
      </p>
      <Link href="/" className={buttonVariants({ variant: "secondary" })}>← Volver al inicio</Link>
    </main>
  );
}
