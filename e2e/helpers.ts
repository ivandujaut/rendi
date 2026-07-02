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
