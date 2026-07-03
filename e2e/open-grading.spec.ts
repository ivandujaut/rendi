import { test, expect } from "@playwright/test";
import { signIn, resetStudentState, ensureOpenExam, assignExam, countOpenResponses, OPEN_EXAM_ID } from "./helpers";

// Flujo del corrector (parte CI-safe, sin IA): el alumno responde una pregunta de
// desarrollo y al entregar la respuesta se persiste en open_responses. La corrección
// con IA es async (cron) y su calidad la cubre `npm run eval:grading`, así que este
// test NO llama al modelo — solo verifica el wiring schema + submit.
//
// Requiere que db/14_open_questions.sql esté aplicado en rendi-dev (crea open_responses).
const STUDENT_EMAIL = "doe+clerk_test@example.com";
const STUDENT_ID = "user_3FpKSCfPNwDXZ5tpLrFpOtx0kHq";

test.describe.serial("corrector: respuesta de desarrollo", () => {
  test.beforeAll(async () => {
    await ensureOpenExam();
    await resetStudentState(OPEN_EXAM_ID, STUDENT_ID);
    await assignExam(OPEN_EXAM_ID, STUDENT_ID);
  });

  test("el alumno responde el desarrollo, entrega y se persiste en open_responses", async ({ page }) => {
    await signIn(page, STUDENT_EMAIL);
    // Directo al examen de desarrollo (evita ambigüedad si hay varios "Rendir").
    await page.goto(`/exam/${OPEN_EXAM_ID}`);
    await page.getByRole("button", { name: /Iniciar examen/i }).click();

    await page
      .getByTestId("open-answer")
      .fill("Hay overflow cuando sumás dos operandos del mismo signo y el resultado da el signo opuesto.");

    await page.getByRole("button", { name: /^Finalizar/ }).click();
    await page.getByRole("button", { name: /Entregar examen/i }).click();

    await page.waitForURL("**/result/**");
    const attemptId = page.url().split("/result/")[1].split(/[?#]/)[0];
    expect(await countOpenResponses(attemptId)).toBeGreaterThan(0);
  });
});
