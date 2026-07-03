import type { Page } from "@playwright/test";
import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

// Los tests corren en workers aparte; aseguramos las env de .env.local acá también.
dotenv.config({ path: ".env.local" });

/**
 * Sign-in de un usuario de test vía Clerk. La instancia dev usa email code
 * (no password); los emails `+clerk_test` aceptan el código de test 424242.
 */
export async function signIn(page: Page, email: string) {
  await setupClerkTestingToken({ page });
  await page.goto("/");
  await clerk.loaded({ page });
  await clerk.signIn({ page, signInParams: { strategy: "email_code", identifier: email } });
}

/** Cliente service-role para preparar/limpiar estado en rendi-dev desde los tests. */
function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

/**
 * Deja al alumno sin asignación ni intentos para un examen (las respuestas caen
 * en cascada al borrar el intento). Así el flujo docente→alumno arranca fresco y
 * es repetible en cada corrida.
 */
export async function resetStudentState(examId: string, userId: string) {
  const sb = admin();
  await sb.from("attempts").delete().eq("exam_id", examId).eq("user_id", userId);
  await sb.from("exam_assignments").delete().eq("exam_id", examId).eq("user_id", userId);
}

// Examen dedicado con una sola pregunta de desarrollo, para el flujo del corrector.
// IDs fijos para que el seed sea idempotente y el cleanup determinista.
export const OPEN_EXAM_ID = "0000000a-0000-0000-0000-000000000001";
const OPEN_Q_ID = "0000000a-0000-0000-0000-000000000002";

/** Siembra (idempotente) el examen de desarrollo en rendi-dev vía service-role. */
export async function ensureOpenExam() {
  const sb = admin();
  await sb.from("exams").upsert(
    { id: OPEN_EXAM_ID, title: "Desarrollo (E2E)", duration_min: 40, is_published: true, shuffle: false, allow_back: true },
    { onConflict: "id" },
  );
  await sb.from("questions").upsert(
    {
      id: OPEN_Q_ID,
      exam_id: OPEN_EXAM_ID,
      number: 1,
      kind: "open",
      topic: "complemento a 2",
      prompt: "Explicá cómo se detecta el overflow al sumar dos números en complemento a 2.",
      options: null,
    },
    { onConflict: "id" },
  );
}

/** Asigna un examen al alumno (bypass de la UI docente, ya cubierta por el otro flujo). */
export async function assignExam(examId: string, userId: string, attemptsAllowed = 1) {
  const sb = admin();
  await sb
    .from("exam_assignments")
    .upsert({ exam_id: examId, user_id: userId, attempts_allowed: attemptsAllowed }, { onConflict: "exam_id,user_id" });
}

/** Cuenta las open_responses persistidas para un intento (para verificar el submit). */
export async function countOpenResponses(attemptId: string): Promise<number> {
  const sb = admin();
  const { count } = await sb
    .from("open_responses")
    .select("id", { count: "exact", head: true })
    .eq("attempt_id", attemptId);
  return count ?? 0;
}
