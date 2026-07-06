import { test, expect } from "@playwright/test";
import {
  signIn,
  resetStudentState,
  ensureOpenExam,
  seedPendingGrading,
  gradingEstado,
  openSchemaReady,
  OPEN_EXAM_ID,
} from "./helpers";

// Corazón del Slice 2b (CI-safe, sin IA): el docente ve un borrador de corrección en la
// cola y lo aprueba. El borrador se siembra directo (estado 'pending'), sin llamar al
// modelo — la calidad de la IA ya la cubren el eval y la verificación de pipeline.
// Ejercita: página de la cola + PATCH /api/gradings + reviewGrading + RLS docente.
const STUDENT_ID = "user_3FpKSCfPNwDXZ5tpLrFpOtx0kHq";
const TEACHER_EMAIL = "teacher+clerk_test@example.com";

test.describe.serial("corrector: cola de corrección del docente", () => {
  let ready = false;
  let gradingId = "";

  test.beforeAll(async () => {
    ready = await openSchemaReady();
    if (!ready) return;
    await ensureOpenExam();
    await resetStudentState(OPEN_EXAM_ID, STUDENT_ID);
    const seed = await seedPendingGrading(STUDENT_ID);
    gradingId = seed.gradingId;
  });

  test.afterAll(async () => {
    if (ready) await resetStudentState(OPEN_EXAM_ID, STUDENT_ID);
  });

  test("el docente aprueba un borrador y queda approved", async ({ page }) => {
    test.skip(!ready, "Aplicá db/14_open_questions.sql en rendi-dev para habilitar este test");

    await signIn(page, TEACHER_EMAIL);
    await page.goto(`/teacher/grading/${OPEN_EXAM_ID}`);
    // Onboarding defensivo (si el docente de test aún no lo hizo en este proyecto).
    if (page.url().includes("/onboarding")) {
      await page.getByText("Soy docente").click();
      await page.getByRole("button", { name: /Continuar/i }).click();
      await page.locator("#ob-name").fill("Profe E2E");
      await page.locator("#ob-code").fill("oatec-docente-2026");
      await page.getByRole("button", { name: /Entrar a Parcialito/i }).click();
      await page.waitForURL("**/teacher");
      await page.goto(`/teacher/grading/${OPEN_EXAM_ID}`);
    }

    // La fila del alumno arranca colapsada (vista compacta por pregunta): el preview
    // de la respuesta está visible; hay que expandirla para ver el borrador y aprobar.
    await expect(page.getByText(/Respuesta de desarrollo de prueba/i)).toBeVisible();
    await page.getByText(/Respuesta de desarrollo de prueba/i).click();

    // Aprobar; esperar el PATCH antes de terminar (la UI es optimista).
    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/gradings/") && r.request().method() === "PATCH"),
      page.getByRole("button", { name: /Aprobar y publicar/i }).click(),
    ]);
    expect(resp.ok()).toBeTruthy();

    expect(await gradingEstado(gradingId)).toBe("approved");
  });
});
