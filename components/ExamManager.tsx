"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HugeiconsIcon } from "@hugeicons/react";
import { PencilEdit01Icon, Delete02Icon } from "@hugeicons/core-free-icons";

/** Acciones de gestión del simulacro seleccionado: editar, publicar/despublicar, eliminar. */
export function ExamManager({
  examId, title, isPublished, attemptCount,
}: { examId: string; title: string; isPublished: boolean; attemptCount: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState("");

  async function togglePublish() {
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/exams/${examId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_published: !isPublished }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Error");
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function del() {
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/exams/${examId}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error || "Error");
      setConfirmOpen(false);
      router.push("/teacher");
      router.refresh();
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <>
      <Link href={`/teacher/edit/${examId}`} className={buttonVariants({ variant: "secondary", size: "sm" })}>
        <HugeiconsIcon icon={PencilEdit01Icon} />Editar
      </Link>
      <Button variant="secondary" size="sm" onClick={togglePublish} loading={busy}>
        {isPublished ? "Despublicar" : "Publicar"}
      </Button>
      <Button variant="secondary" size="sm" className="text-red2" onClick={() => { setConfirmText(""); setConfirmOpen(true); }} disabled={busy}>
        <HugeiconsIcon icon={Delete02Icon} />Eliminar
      </Button>

      {confirmOpen && (
        <div className="fixed inset-0 bg-[rgba(58,58,58,.5)] grid place-items-center z-50 p-4" onClick={() => setConfirmOpen(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-disp text-lg text-ink mb-2">Eliminar simulacro</h3>
            <p className="text-sm text-grey-600 mb-3">
              Vas a borrar <b className="text-ink">{title}</b>
              {attemptCount > 0 ? <> y sus <b className="text-ink">{attemptCount}</b> intento{attemptCount !== 1 ? "s" : ""} de alumnos</> : null}, de forma <b className="text-ink">permanente</b>. Escribí el título para confirmar:
            </p>
            <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder={title} />
            {error && <p className="text-red2 text-sm mt-2">{error}</p>}
            <div className="flex gap-2 justify-end mt-4">
              <Button variant="secondary" onClick={() => setConfirmOpen(false)} disabled={busy}>Cancelar</Button>
              <Button
                variant="danger"
                onClick={del}
                disabled={confirmText.trim() !== title}
                loading={busy}
              >
                {busy ? "Eliminando…" : "Eliminar definitivamente"}
              </Button>
            </div>
          </div>
        </div>
      )}
      {error && !confirmOpen && <span className="text-red2 text-xs">{error}</span>}
    </>
  );
}
