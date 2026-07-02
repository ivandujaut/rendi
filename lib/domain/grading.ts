import { generateStructured } from "@/lib/ai/client";
import { gradingSchema, type Grading } from "@/lib/ai/schema";

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
está mal, por qué, y qué repasar. Si está bien, decilo y por qué. Nunca incluyas una nota.`;

function buildPrompt(input: { enunciado: string; rubrica?: string | null; respuesta: string }): string {
  return [
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
