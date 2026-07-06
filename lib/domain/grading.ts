import { generateStructured } from "@/lib/ai/client";
import { gradingSchema, askSchema, type Grading } from "@/lib/ai/schema";
import { dbError, ApiError } from "@/lib/api/errors";
import type { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { getSupabaseServer } from "@/lib/supabaseServer";
import type { Database } from "@/lib/db.types";

// Capa de dominio del corrector asistido. Arma el prompt, llama al cliente de IA y
// traduce cualquier falla (timeout, key faltante, salida malformada tras reintentos) a
// un estado `failed` explícito — el manejo de fallo es un requisito del diseño: si el
// modelo no responde bien, el ítem queda para corrección manual del docente, sin borrador.
//
// Slice 1 (fundación + de-riesgo): esta función es pura respecto de la DB — recibe el
// enunciado / rúbrica / respuesta y devuelve el borrador. Persistir `open_responses` /
// `ai_gradings` y la cola de revisión son Slice 2 (necesitan migración de schema).

/**
 * Instrucciones fijas del corrector, destiladas de la validación con 2 exámenes reales
 * de Técnicas Digitales (teacher-approved). Codifican los aprendizajes de diseño:
 * - Feedback-first: NO pone nota (la decide el docente; MVP sin `nota_sugerida`).
 * - Corrección por EQUIVALENCIA lógica/numérica, no por coincidencia literal de texto
 *   (A₃A₂+A₃A₁ = A₃(A₂+A₁); caminos algebraicos distintos; formas NAND/NOR).
 * - Alcance: determinístico / verificable (aritmética binaria/hex, complemento a 2,
 *   overflow, tablas de verdad, Boole, K-map). Fuera de alcance: diseño de circuito a mano
 *   y todo lo que dependa de una figura no transcripta → decir que no se puede corregir.
 */
const SYSTEM = `Sos un asistente de corrección para un docente de Técnicas Digitales. NO ponés \
la nota final ni ningún puntaje: eso lo decide el profe. Tu único trabajo es redactar un \
borrador de devolución personalizada para el alumno y detectar qué temas tiene flojos.

Reglas de corrección:
- Corregí por EQUIVALENCIA, no por coincidencia literal. Muchas respuestas correctas se \
escriben distinto (por ejemplo A₃A₂+A₃A₁ y A₃(A₂+A₁) son la misma función; hay caminos \
algebraicos y formas NAND/NOR equivalentes). Verificá el razonamiento y el resultado \
(tabla de verdad / valor final), no que el texto coincida con una respuesta modelo.
- Trabajás sobre desarrollo determinístico o verificable: aritmética binaria/hexadecimal, \
complemento a 2, overflow, conversiones, tablas de verdad, álgebra de Boole, mapas de \
Karnaugh, condiciones "no importa".
- Si la respuesta correcta depende de una figura o un diagrama (circuito dibujado a mano, \
diagrama de tiempos) que no está transcripto como texto, decí explícitamente que no podés \
corregir esa parte sin el dato y dejala para el docente. No inventes lo que no ves.

Tono de la devolución: segunda persona, docente, 2 a 4 frases. Señalá el paso puntual que \
está mal, por qué, y qué repasar. Si está bien, decilo y por qué. Nunca incluyas una nota.

Además de la devolución, devolvés temas_flojos: elegí las etiquetas de la LISTA DE TEMAS DEL \
EXAMEN que se te da que apliquen a lo que está flojo (usá el texto exacto de esas etiquetas, \
para que el plan de repaso del alumno agregue de forma consistente). No inventes etiquetas \
nuevas; si ninguna de la lista aplica (o la respuesta está bien), dejá temas_flojos vacío.`;

function buildPrompt(input: {
  enunciado: string;
  rubrica?: string | null;
  respuesta: string;
  temasDisponibles?: string[];
}): string {
  const temas = (input.temasDisponibles ?? []).filter((t) => t.trim() !== "");
  return [
    "Temas del examen (elegí temas_flojos SOLO de esta lista, con el texto exacto):",
    temas.length ? temas.map((t) => `- ${t}`).join("\n") : "(no hay lista; dejá temas_flojos vacío)",
    "",
    "Enunciado del problema:",
    input.enunciado,
    "",
    "Criterio/rúbrica del profe (si no hay, corregí contra el enunciado):",
    input.rubrica?.trim() || "no provista",
    "",
    "Respuesta del alumno (tal cual, con sus pasos):",
    input.respuesta,
  ].join("\n");
}

export type GradeResult =
  | { status: "ok"; grading: Grading }
  | { status: "failed"; error: string };

/**
 * Corrige una respuesta de desarrollo abierto. Devuelve el borrador (`ok`) o un estado
 * `failed` con el motivo — nunca tira: la falla es un resultado esperado que el llamador
 * persiste como `ai_gradings.estado = failed` (fallback a corrección manual).
 */
export async function gradeOpenAnswer(input: {
  enunciado: string;
  rubrica?: string | null;
  respuesta: string;
  temasDisponibles?: string[];
}): Promise<GradeResult> {
  try {
    const grading = await generateStructured({
      schema: gradingSchema,
      system: SYSTEM,
      prompt: buildPrompt(input),
    });
    return { status: "ok", grading };
  } catch (e) {
    return { status: "failed", error: e instanceof Error ? e.message : "error de IA" };
  }
}

// Asistente conversacional del docente (Slice 2): responde una consulta puntual sobre
// una respuesta ya cargada. Mismas reglas de fondo que el corrector (equivalencia,
// alcance determinístico, no inventar figuras), pero acá el "usuario" es el docente.
const ASK_SYSTEM = `Sos un asistente de un docente de Técnicas Digitales que está corrigiendo \
respuestas de desarrollo. El docente te hace una consulta puntual sobre UNA respuesta de un \
alumno. Respondé de forma concisa y directa, en español.

Reglas:
- Corregí/analizá por EQUIVALENCIA lógica o numérica, no por coincidencia literal de texto.
- Alcance determinístico/verificable (aritmética binaria/hex, complemento a 2, overflow, \
tablas de verdad, Boole, Karnaugh). Si algo depende de una figura no transcripta, decilo y no \
lo inventes.
- Si el docente te pide una devolución para el alumno (ej: "hacela más corta", "reformulá"), \
devolvé SOLO la devolución lista, en segunda persona, tono docente, sin nota ni puntaje.
- Si te pregunta algo de análisis (ej: "¿está bien el paso 3?"), respondele al docente, no al \
alumno. Nunca pongas una nota.`;

function buildAskPrompt(input: {
  enunciado: string;
  rubrica?: string | null;
  respuesta: string;
  borrador?: string | null;
  pregunta: string;
}): string {
  return [
    "Enunciado del problema:",
    input.enunciado,
    "",
    "Criterio/rúbrica del profe (si no hay, usá el enunciado):",
    input.rubrica?.trim() || "no provista",
    "",
    "Respuesta del alumno (tal cual):",
    input.respuesta,
    "",
    "Borrador de devolución actual (si el docente lo quiere ajustar):",
    input.borrador?.trim() || "sin borrador todavía",
    "",
    "Consulta del docente:",
    input.pregunta,
  ].join("\n");
}

export type AskResult =
  | { status: "ok"; answer: string }
  | { status: "failed"; error: string };

/**
 * Responde una consulta del docente sobre una respuesta puntual. Nunca tira: la falla
 * (timeout, key faltante, salida inválida) vuelve como `failed` para que la ruta la
 * traduzca a un error limpio.
 */
export async function askAboutOpenAnswer(input: {
  enunciado: string;
  rubrica?: string | null;
  respuesta: string;
  borrador?: string | null;
  pregunta: string;
}): Promise<AskResult> {
  try {
    const out = await generateStructured({ schema: askSchema, system: ASK_SYSTEM, prompt: buildAskPrompt(input) });
    return { status: "ok", answer: out.respuesta };
  } catch (e) {
    return { status: "failed", error: e instanceof Error ? e.message : "error de IA" };
  }
}

type AdminClient = ReturnType<typeof getSupabaseAdmin>;

/**
 * Cola de corrección: levanta las `open_responses` de intentos entregados que aún no
 * tienen `ai_gradings`, las corrige con la IA y persiste el borrador. La corre el cron
 * con service-role (ignora RLS) — el alumno nunca escribe `ai_gradings`. Idempotente:
 * cada open_response se corrige una sola vez (FK unique). Acota a `limit` por corrida
 * para no pasar el timeout de la función serverless (cada corrección puede tardar).
 *
 * Devuelve el conteo por resultado para el log del cron.
 */
export async function gradePendingOpenResponses(
  sb: AdminClient,
  limit = 10,
  examId?: string,
  openResponseId?: string,
): Promise<{ scanned: number; graded: number; failed: number }> {
  // Candidatas: respuestas abiertas de intentos ya entregados. `examId` acota a un
  // examen (disparo on-demand del docente) y `openResponseId` a una sola respuesta
  // (botón "Corregir con IA" por fila); el cron corre sin ningún filtro.
  let query = sb
    .from("open_responses")
    .select("id, answer_text, questions(prompt, rubrica), attempts!inner(exam_id, submitted_at)")
    .not("attempts.submitted_at", "is", null);
  if (examId) query = query.eq("attempts.exam_id", examId);
  if (openResponseId) query = query.eq("id", openResponseId);
  const { data: candidates } = await query;

  // Excluir las que ya tienen corrección (la FK unique lo garantiza, pero así no
  // gastamos llamadas a la IA en balde).
  const { data: already } = await sb.from("ai_gradings").select("open_response_id");
  const done = new Set((already ?? []).map((g) => g.open_response_id));

  const pending = (candidates ?? []).filter((c) => !done.has(c.id)).slice(0, limit);

  // Temas del examen por examen (la IA elige temas_flojos de esta lista para que el plan
  // agregue consistente). Una sola query para todos los exámenes del lote.
  const examOf = (c: (typeof pending)[number]) =>
    (Array.isArray(c.attempts) ? c.attempts[0] : c.attempts)?.exam_id ?? "";
  const examIds = [...new Set(pending.map(examOf).filter(Boolean))];
  const topicsByExam = new Map<string, string[]>();
  if (examIds.length) {
    const { data: qtopics } = await sb.from("questions").select("exam_id, topic").in("exam_id", examIds);
    for (const q of qtopics ?? []) {
      if (!q.topic) continue;
      const arr = topicsByExam.get(q.exam_id) ?? [];
      if (!arr.includes(q.topic)) arr.push(q.topic);
      topicsByExam.set(q.exam_id, arr);
    }
  }

  let graded = 0;
  let failed = 0;
  for (const c of pending) {
    // Los embeds pueden venir como objeto o array según la inferencia; normalizamos.
    const q = Array.isArray(c.questions) ? c.questions[0] : c.questions;
    const res = await gradeOpenAnswer({
      enunciado: q?.prompt ?? "",
      rubrica: q?.rubrica ?? null,
      respuesta: c.answer_text,
      temasDisponibles: topicsByExam.get(examOf(c)) ?? [],
    });

    const row: Database["public"]["Tables"]["ai_gradings"]["Insert"] =
      res.status === "ok"
        ? {
            open_response_id: c.id,
            feedback_borrador: res.grading.feedback_borrador,
            temas_flojos: res.grading.temas_flojos,
            estado: "pending", // borrador listo, esperando al docente
          }
        : { open_response_id: c.id, estado: "failed" };

    const { error } = await sb.from("ai_gradings").insert(row);
    if (error) dbError("persistir corrección de IA", error);
    if (res.status === "ok") graded++;
    else failed++;
  }

  return { scanned: pending.length, graded, failed };
}

type ServerClient = Awaited<ReturnType<typeof getSupabaseServer>>;

/**
 * Revisión del docente sobre un borrador (Slice 2b). El docente es el corrector final:
 * `approve` publica la devolución al alumno (con el texto editado si lo tocó), `reject`
 * la descarta (corrige a mano). `was_edited` se calcula comparando el texto final con el
 * borrador original — separado del estado, para medir cuán seguido el borrador sirve tal
 * cual. Corre con el cliente RLS del docente (la policy `ai_gradings` le permite update).
 */
export async function reviewGrading(
  sb: ServerClient,
  gradingId: string,
  teacherId: string,
  action: "approve" | "reject",
  feedback?: string,
  nota?: number | null,
): Promise<void> {
  const { data: current } = await sb
    .from("ai_gradings")
    .select("id, feedback_borrador")
    .eq("id", gradingId)
    .maybeSingle();
  if (!current) throw new ApiError(404, "corrección no encontrada");

  const patch: Database["public"]["Tables"]["ai_gradings"]["Update"] = {
    aprobado_por: teacherId,
    updated_at: new Date().toISOString(),
  };

  if (action === "approve") {
    patch.estado = "approved";
    if (feedback != null) {
      patch.feedback_borrador = feedback;
      patch.was_edited = feedback.trim() !== (current.feedback_borrador ?? "").trim();
    }
    // Nota del docente (0-10) para la respuesta de desarrollo. Reutilizamos la columna
    // `nota_sugerida` (quedó del diseño original sin usar) como la nota final del docente.
    // `undefined` = no la tocó; `null` = la borró explícitamente.
    if (nota !== undefined) patch.nota_sugerida = nota;
  } else {
    patch.estado = "rejected";
  }

  const { error } = await sb.from("ai_gradings").update(patch).eq("id", gradingId);
  if (error) dbError("revisar corrección", error);
}
