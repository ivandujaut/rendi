"use client";

import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="max-w-xl mx-auto px-4 py-16 text-center">
      <h1 className="font-disp text-2xl text-ink mb-2">Algo salió mal</h1>
      <p className="text-[#656565] mb-6">
        Probá de nuevo. Si el problema sigue, volvé más tarde.
      </p>
      <div className="flex items-center justify-center gap-2">
        <Button variant="primary" onClick={reset}>Reintentar</Button>
        <Link href="/" className={buttonVariants({ variant: "secondary" })}>Volver al inicio</Link>
      </div>
    </main>
  );
}
