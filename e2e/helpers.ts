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

/**
 * ¿Está aplicada la migración db/14 en rendi-dev? Se prueba leyendo `open_responses`.
 * El spec del corrector se saltea limpio (sin sembrar ni asignar nada) cuando devuelve
 * false, así el CI queda verde hasta aplicar la migración y NO contamina el estado
 * compartido que usan los otros flujos.
 */
export async function openSchemaReady(): Promise<boolean> {
  const sb = admin();
  // GET real (no `head`): una tabla inexistente devuelve error acá; un HEAD no lo hace.
  const { error } = await sb.from("open_responses").select("id").limit(1);
  return !error;
}

/** Siembra (idempotente) el examen de desarrollo en rendi-dev vía service-role. */
export async function ensureOpenExam() {
  const sb = admin();
  const e1 = await sb.from("exams").upsert(
    { id: OPEN_EXAM_ID, title: "Desarrollo (E2E)", duration_min: 40, is_published: true, shuffle: false, allow_back: true },
    { onConflict: "id" },
  );
  if (e1.error) throw new Error(`seed open exam: ${e1.error.message}`);
  const e2 = await sb.from("questions").upsert(
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
  if (e2.error) throw new Error(`seed open question: ${e2.error.message}`);
}

/** Asigna un examen al alumno (bypass de la UI docente, ya cubierta por el otro flujo). */
export async function assignExam(examId: string, userId: string, attemptsAllowed = 1) {
  const sb = admin();
  const { error } = await sb
    .from("exam_assignments")
    .upsert({ exam_id: examId, user_id: userId, attempts_allowed: attemptsAllowed }, { onConflict: "exam_id,user_id" });
  if (error) throw new Error(`assign exam: ${error.message}`);
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

/**
 * Siembra un intento entregado + respuesta abierta + borrador de IA en estado `pending`
 * (sin llamar al modelo), para testear la cola de corrección del docente sin costo de IA.
 */
export async function seedPendingGrading(userId: string): Promise<{ attemptId: string; gradingId: string }> {
  const sb = admin();
  const { data: at, error: e1 } = await sb
    .from("attempts")
    .insert({ exam_id: OPEN_EXAM_ID, user_id: userId, submitted_at: new Date().toISOString() })
    .select("id")
    .single();
  if (e1) throw new Error(`seed attempt: ${e1.message}`);
  const { data: or, error: e2 } = await sb
    .from("open_responses")
    .insert({ attempt_id: at!.id, question_id: OPEN_Q_ID, answer_text: "Respuesta de desarrollo de prueba (E2E)." })
    .select("id")
    .single();
  if (e2) throw new Error(`seed open_response: ${e2.message}`);
  const { data: g, error: e3 } = await sb
    .from("ai_gradings")
    .insert({ open_response_id: or!.id, estado: "pending", feedback_borrador: "Borrador de devolución (E2E).", temas_flojos: [] })
    .select("id")
    .single();
  if (e3) throw new Error(`seed ai_grading: ${e3.message}`);
  return { attemptId: at!.id, gradingId: g!.id };
}

/** Estado actual de un ai_gradings (para verificar la acción del docente). */
export async function gradingEstado(gradingId: string): Promise<string | null> {
  const sb = admin();
  const { data } = await sb.from("ai_gradings").select("estado").eq("id", gradingId).maybeSingle();
  return data?.estado ?? null;
}

/**
 * Siembra data para el plan de repaso: un intento con un tema MCQ flojo (25%) + una
 * corrección de desarrollo aprobada con un tema flojo. Sin IA.
 */
export async function seedStudyPlanData(userId: string): Promise<{ attemptId: string }> {
  const sb = admin();
  const { data: at, error: e1 } = await sb
    .from("attempts")
    .insert({
      exam_id: OPEN_EXAM_ID,
      user_id: userId,
      submitted_at: new Date().toISOString(),
      score: 1,
      total: 4,
      per_topic: { "Física: Mecánica": { ok: 1, tot: 4 } },
    })
    .select("id")
    .single();
  if (e1) throw new Error(`seed plan attempt: ${e1.message}`);
  const { data: or, error: e2 } = await sb
    .from("open_responses")
    .insert({ attempt_id: at!.id, question_id: OPEN_Q_ID, answer_text: "Respuesta (E2E)." })
    .select("id")
    .single();
  if (e2) throw new Error(`seed plan open_response: ${e2.message}`);
  const { error: e3 } = await sb.from("ai_gradings").insert({
    open_response_id: or!.id,
    estado: "approved",
    feedback_borrador: "ok",
    temas_flojos: ["complemento a 2"],
    aprobado_por: userId,
  });
  if (e3) throw new Error(`seed plan grading: ${e3.message}`);
  return { attemptId: at!.id };
}
