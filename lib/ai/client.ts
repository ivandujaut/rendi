import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import type { z } from "zod";

/**
 * Cliente de IA desacoplado del feature. Un solo lugar sabe qué modelo se usa y cómo se
 * llama; el resto del código (dominio) pide "salida estructurada contra este schema" sin
 * conocer el proveedor. El LLM del corrector vive acá, NO en una función SQL.
 *
 * Server-only: importar solo desde código server (route handlers, dominio, eval). No lo
 * importa ningún Client Component.
 *
 * Un solo lugar decide el transporte según la key disponible:
 * - Producción (Vercel Function): AI Gateway con model string `proveedor/modelo`
 *   (`AI_GATEWAY_API_KEY`) — suma observabilidad y fallbacks.
 * - Local / eval: provider Anthropic directo (`ANTHROPIC_API_KEY`).
 * El dominio no sabe cuál se usa; cambiar de proveedor es cambiar acá, no en el feature.
 *
 * Las keys se leen acá (no en `lib/env.ts`) a propósito: el corrector todavía no está
 * cableado a ninguna ruta, así que la app y el build de CI no deben exigir estas vars para
 * bootear; se validan al momento de corregir.
 */
const MODEL = "claude-opus-4-8";
const TIMEOUT_MS = 30_000;
const MAX_RETRIES = 2;

/** Elige el modelo/transporte según qué key esté configurada; null si no hay ninguna. */
function resolveModel() {
  if (process.env.AI_GATEWAY_API_KEY) return `anthropic/${MODEL}`;
  if (process.env.ANTHROPIC_API_KEY) return anthropic(MODEL);
  return null;
}

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
  const model = resolveModel();
  if (!model) {
    throw new Error("Falta AI_GATEWAY_API_KEY o ANTHROPIC_API_KEY (requerida para la corrección con IA)");
  }

  const { object } = await generateObject({
    model,
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
