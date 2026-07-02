"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMutation } from "@/lib/hooks/use-mutation";
import { apiRequest } from "@/lib/api/client";
import { HugeiconsIcon } from "@hugeicons/react";
import { PencilEdit01Icon, Delete02Icon } from "@hugeicons/core-free-icons";

/** Acciones de gestión del simulacro seleccionado: editar, publicar/despublicar, eliminar. */
export function ExamManager({
  examId, title, isPublished, attemptCount,
}: { examId: string; title: string; isPublished: boolean; attemptCount: number }) {
  const router = useRouter();
  const { busy, error, run } = useMutation();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  async function togglePublish() {
    await run("publish", () =>
      apiRequest(`/api/exams/${examId}`, { method: "PATCH", body: { is_published: !isPublished } }),
    );
  }

  async function del() {
    // refresh: false — en éxito navegamos a /teacher a mano; en error el modal
    // queda abierto mostrando el error (comportamiento previo).
    const ok = await run("delete", () => apiRequest(`/api/exams/${examId}`, { method: "DELETE" }), { refresh: false });
    if (ok) {
      setConfirmOpen(false);
      router.push("/teacher");
      router.refresh();
    }
  }

  return (
    <>
      <Link href={`/teacher/edit/${examId}`} className={buttonVariants({ variant: "secondary", size: "sm" })}>
        <HugeiconsIcon icon={PencilEdit01Icon} />Editar
      </Link>
      <Button variant="secondary" size="sm" onClick={togglePublish} loading={busy === "publish"} disabled={!!busy}>
        {isPublished ? "Despublicar" : "Publicar"}
      </Button>
      <Button variant="secondary" size="sm" className="text-red2" onClick={() => { setConfirmText(""); setConfirmOpen(true); }} disabled={!!busy}>
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
              <Button variant="secondary" onClick={() => setConfirmOpen(false)} disabled={!!busy}>Cancelar</Button>
              <Button
                variant="danger"
                onClick={del}
                disabled={confirmText.trim() !== title}
                loading={busy === "delete"}
              >
                {busy === "delete" ? "Eliminando…" : "Eliminar definitivamente"}
              </Button>
            </div>
          </div>
        </div>
      )}
      {error && !confirmOpen && <span className="text-red2 text-xs">{error}</span>}
    </>
  );
}
