"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Encapsula el patrón repetido de "mutación async con estado busy + errores +
 * refresh", incluida la variante optimista (aplicar el cambio al instante y
 * revertir si falla). `busy` es una clave (string) para poder marcar qué fila /
 * acción está en curso; `null` cuando no hay nada corriendo.
 */
export function useMutation() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Corre `fn` con `busy = key`. Si se pasa `optimistic`, lo aplica antes; si
   * `fn` tira, corre `revert` y guarda el error. Refresca el server component en
   * éxito (salvo `refresh: false`, para manejar la navegación a mano). Devuelve
   * `true` si salió bien.
   */
  async function run(
    key: string,
    fn: () => Promise<unknown>,
    opts: { optimistic?: () => void; revert?: () => void; refresh?: boolean } = {},
  ): Promise<boolean> {
    opts.optimistic?.();
    setBusy(key);
    setError(null);
    try {
      await fn();
      if (opts.refresh !== false) router.refresh();
      return true;
    } catch (e) {
      opts.revert?.();
      setError(e instanceof Error ? e.message : "Error");
      return false;
    } finally {
      setBusy(null);
    }
  }

  return { busy, error, setError, run };
}
