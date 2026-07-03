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
        "Si está correcto, decilo y por qué. NO incluyas una nota ni un puntaje.",
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
