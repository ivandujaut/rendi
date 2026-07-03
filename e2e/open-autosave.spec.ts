import { test, expect } from "@playwright/test";
import { signIn, resetStudentState, ensureOpenExam, assignExam, openSchemaReady, OPEN_EXAM_ID } from "./helpers";

// Autoguardado de la respuesta de desarrollo (CI-safe, sin IA): el alumno tipea, se
// autoguarda mientras escribe, y al reanudar el intento el texto se restaura.
const STUDENT_EMAIL = "doe+clerk_test@example.com";
const STUDENT_ID = "user_3FpKSCfPNwDXZ5tpLrFpOtx0kHq";
const TEXT = "Overflow: dos operandos del mismo signo con resultado de signo opuesto.";

test.describe.serial("corrector: autoguardado de desarrollo", () => {
  let ready = false;

  test.beforeAll(async () => {
    ready = await openSchemaReady();
    if (!ready) return;
    await ensureOpenExam();
    await resetStudentState(OPEN_EXAM_ID, STUDENT_ID);
    await assignExam(OPEN_EXAM_ID, STUDENT_ID);
  });

  test.afterAll(async () => {
    if (ready) await resetStudentState(OPEN_EXAM_ID, STUDENT_ID);
  });

  test("autoguarda mientras escribe y restaura al reanudar", async ({ page }) => {
    test.skip(!ready, "Aplicá db/14_open_questions.sql en rendi-dev para habilitar este test");

    await signIn(page, STUDENT_EMAIL);
    await page.goto(`/exam/${OPEN_EXAM_ID}`);
    await page.getByRole("button", { name: /Iniciar examen/i }).click();

    // Tipear y esperar el POST de autoguardado (debounce ~700ms).
    await page.getByTestId("open-answer").fill(TEXT);
    const resp = await page.waitForResponse(
      (r) => r.url().includes("/save-open") && r.request().method() === "POST",
    );
    expect(resp.ok()).toBeTruthy();

    // Reanudar el intento (recargar → Iniciar reanuda el en curso) y verificar restauración.
    await page.goto(`/exam/${OPEN_EXAM_ID}`);
    await page.getByRole("button", { name: /Iniciar examen/i }).click();
    await expect(page.getByTestId("open-answer")).toHaveValue(TEXT);
  });
});
