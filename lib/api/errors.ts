import { NextResponse } from "next/server";

/**
 * Error con un mensaje SEGURO para el cliente y un status HTTP. Lo tiran los
 * guards/validadores; el wrapper `route()` lo convierte en la respuesta JSON.
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly publicMessage: string,
  ) {
    super(publicMessage);
    this.name = "ApiError";
  }
}

/**
 * Envuelve un route handler: cualquier `ApiError` sale como `{ error }` con su
 * status; cualquier otra cosa se loguea completa del lado servidor y devuelve un
 * 500 genérico (no filtra detalles internos de Postgres/PostgREST al cliente).
 */
export function route<C = unknown>(
  handler: (req: Request, ctx: C) => Promise<Response>,
): (req: Request, ctx: C) => Promise<Response> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (e) {
      if (e instanceof ApiError) {
        return NextResponse.json({ error: e.publicMessage }, { status: e.status });
      }
      console.error("[api] error no manejado:", e);
      return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
    }
  };
}

/**
 * Para errores de una operación de Supabase que NO son feedback accionable para
 * el usuario: loguea el detalle real (constraint, columna) del lado servidor y
 * tira un ApiError con un mensaje genérico. La validación accionable ocurre antes
 * (Zod en el body / validación en el cliente).
 */
export function dbError(context: string, error: unknown, publicMessage = "No se pudo completar la acción"): never {
  console.error(`[api] error de DB (${context}):`, error);
  throw new ApiError(400, publicMessage);
}
