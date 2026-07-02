import { generateObject } from "ai";
import type { z } from "zod";

/**
 * Cliente de IA desacoplado del feature. Un solo lugar sabe qué modelo se usa y cómo se
 * llama; el resto del código (dominio) pide "salida estructurada contra este schema" sin
 * conocer el proveedor. El LLM del corrector vive acá, NO en una función SQL.
 *
 * Server-only: importar solo desde código server (route handlers, dominio, eval). No lo
 * importa ningún Client Component.
 *
 * Va por el AI Gateway de Vercel con model string `proveedor/modelo` (requiere
 * `AI_GATEWAY_API_KEY`). Elegir el gateway y no `@ai-sdk/anthropic` directo mantiene el
 * feature provider-agnostic: cambiar de modelo/proveedor es cambiar este string, sin tocar
 * el dominio. La key se lee acá (no en `lib/env.ts`) a propósito: el corrector todavía no
 * está cableado a ninguna ruta, así que la app y el build de CI no deben exigir esta var
 * para bootear; se valida al momento de corregir.
 */
const MODEL = "anthropic/claude-opus-4-8";
const TIMEOUT_MS = 30_000;
const MAX_RETRIES = 2;

/**
 * Corre una generación estructurada contra `schema` y devuelve el objeto validado.
 * Tira si falta la key, si se pasa el timeout, o si el modelo no logra producir una
 * salida válida tras los reintentos — el dominio traduce eso a un estado `failed`.
 */
export async function generateStructured<T extends z.ZodType>(args: {
  schema: T;
  system: string;
  prompt: string;
}): Promise<z.infer<T>> {
  if (!process.env.AI_GATEWAY_API_KEY) {
    throw new Error("AI_GATEWAY_API_KEY no configurada (requerida para la corrección con IA)");
  }

  const { object } = await generateObject({
    model: MODEL,
    schema: args.schema,
    system: args.system,
    prompt: args.prompt,
    maxRetries: MAX_RETRIES,
    abortSignal: AbortSignal.timeout(TIMEOUT_MS),
  });

  // `object` ya está validado contra `args.schema` por generateObject; el cast solo salva
  // la brecha entre la inferencia genérica del AI SDK (`output<T>`) y `z.infer<T>`, que son
  // el mismo tipo en runtime.
  return object as z.infer<T>;
}
