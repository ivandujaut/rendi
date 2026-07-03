import { test, expect } from "@playwright/test";
import { signIn, resetStudentState, ensureOpenExam, seedStudyPlanData, openSchemaReady, OPEN_EXAM_ID } from "./helpers";

// Slice 3 (CI-safe, sin IA): el alumno ve su plan de repaso acumulado. Se siembra un
// intento con un tema MCQ flojo + una corrección de desarrollo aprobada, y se verifica
// que ambos aparecen en /plan. El plan se computa al vuelo (sin tabla), así que esto
// ejercita getStudyPlan + la agregación/canonicalización + la página.
const STUDENT_EMAIL = "doe+clerk_test@example.com";
const STUDENT_ID = "user_3FpKSCfPNwDXZ5tpLrFpOtx0kHq";

test.describe.serial("corrector: plan de repaso del alumno", () => {
  let ready = false;

  test.beforeAll(async () => {
    ready = await openSchemaReady();
    if (!ready) return;
    await ensureOpenExam();
    await resetStudentState(OPEN_EXAM_ID, STUDENT_ID);
    await seedStudyPlanData(STUDENT_ID);
  });

  test.afterAll(async () => {
    if (ready) await resetStudentState(OPEN_EXAM_ID, STUDENT_ID);
  });

  test("el alumno ve sus temas flojos en /plan", async ({ page }) => {
    test.skip(!ready, "Aplicá db/14_open_questions.sql en rendi-dev para habilitar este test");

    await signIn(page, STUDENT_EMAIL);
    await page.goto("/plan");

    // Tema MCQ flojo (25%) y tema de desarrollo aprobado.
    await expect(page.getByText("Física: Mecánica")).toBeVisible();
    await expect(page.getByText("complemento a 2")).toBeVisible();
  });
});
