import { z } from "zod";

/**
 * Forma de la salida estructurada del corrector asistido. El modelo DEBE devolver
 * exactamente esto (generateObject valida contra el schema y reintenta si no matchea).
 *
 * MVP feedback-first (decisión de diseño, honra P2 "el docente pone la nota"): en esta
 * iteración NO pedimos `nota_sugerida`. La nota sugerida por IA se difiere a la 2da
 * iteración (Slice 2+). Por eso el schema tiene solo devolución + temas, y el sistema
 * le prohíbe explícitamente poner nota.
 */
export const gradingSchema = z.object({
  feedback_borrador: z
    .string()
    .min(1)
    .describe(
      "Borrador de devolución para el alumno, 2-4 frases, en segunda persona y tono " +
        "docente. Señalá dónde está el error (qué paso), por qué está mal y qué repasar. " +
        "Si está correcto, decilo y por qué. NO incluyas la nota en el texto (va aparte).",
    ),
  nota_sugerida: z
    .number()
    .int()
    .min(0)
    .max(10)
    .describe(
      "Nota SUGERIDA para esta respuesta, entero de 0 a 10, según qué tan correcta y " +
        "completa está respecto del enunciado/rúbrica (corregí por equivalencia, no por " +
        "texto literal). Es solo una sugerencia: el docente la confirma o la ajusta. Si no " +
        "podés evaluarla (depende de una figura no transcripta), estimá con lo que haya.",
    ),
  temas_flojos: z
    .array(z.string())
    .describe(
      "Temas a repasar detectados en esta respuesta, ELEGIDOS de la lista de temas del examen " +
        "que se te provee (para que el plan de repaso agregue de forma consistente). Usá EXACTAMENTE " +
        "las etiquetas de esa lista que apliquen a lo que está flojo. Vacía si la respuesta está " +
        "correcta, o si ningún tema de la lista aplica.",
    ),
});

export type Grading = z.infer<typeof gradingSchema>;

/**
 * Respuesta del asistente cuando el docente le PREGUNTA algo puntual sobre una
 * respuesta (Slice 2): "¿está bien el paso 3?", "hacé la devolución más corta", etc.
 * Salida en un solo campo de texto (usable como devolución si el docente quiere).
 */
export const askSchema = z.object({
  respuesta: z
    .string()
    .min(1)
    .describe(
      "Respuesta a la consulta del docente sobre esta respuesta del alumno, concisa y en " +
        "español. Si el docente pide una devolución (ej: 'hacela más corta'), devolvé la " +
        "devolución lista para el alumno, en segunda persona y sin nota. Si pregunta algo de " +
        "análisis (ej: '¿está bien el paso 3?'), respondele al docente de forma directa.",
    ),
});

export type Ask = z.infer<typeof askSchema>;
