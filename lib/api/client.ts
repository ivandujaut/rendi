/**
 * fetch a un endpoint JSON del backend desde un client component. Centraliza el
 * `const res = await fetch(...); if (!res.ok) throw new Error((await res.json()).error)`
 * que estaba repetido en varios componentes. Tira `Error` con el mensaje `error`
 * de la respuesta cuando el status no es ok; devuelve el body parseado en éxito.
 */
export async function apiRequest(url: string, opts: { method?: string; body?: unknown } = {}): Promise<unknown> {
  const hasBody = opts.body !== undefined;
  const res = await fetch(url, {
    method: opts.method ?? "GET",
    headers: hasBody ? { "Content-Type": "application/json" } : undefined,
    body: hasBody ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || "Error");
  }
  return res.json().catch(() => ({}));
}
