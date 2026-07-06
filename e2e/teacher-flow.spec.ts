import { test, expect } from "@playwright/test";
import { signIn, resetStudentState } from "./helpers";

// Flujo core del producto, en serie: el alumno existe → el docente le asigna un
// examen → el alumno lo rinde y ve el resultado. Corren contra rendi-dev.
const STUDENT_EMAIL = "doe+clerk_test@example.com";
const STUDENT_ID = "user_3FpKSCfPNwDXZ5tpLrFpOtx0kHq"; // Clerk id del alumno de test
const TEACHER_EMAIL = "teacher+clerk_test@example.com";
const SEED_EXAM = "00000000-0000-0000-0000-000000000026";

test.describe.serial("docente asigna, alumno rinde", () => {
  // Estado fresco: sin asignación ni intentos previos, para que el flujo completo
  // (asignar → rendir) se ejercite en cada corrida.
  test.beforeAll(async () => {
    await resetStudentState(SEED_EXAM, STUDENT_ID);
  });

  test("el alumno queda onboardeado (aparece para el docente)", async ({ page }) => {
    await signIn(page, STUDENT_EMAIL);
    await page.goto("/exams");
    if (page.url().includes("/onboarding")) {
      await page.getByText("Soy alumno/a").click();
      await page.getByRole("button", { name: /Continuar/i }).click();
      await page.locator("#ob-name").fill("Jhon Doe E2E");
      await page.locator("#ob-group").fill("E2E Comisión");
      await page.getByRole("button", { name: /Entrar a Parcialito/i }).click();
    }
    await page.waitForURL("**/exams");
  });

  test("el docente se onboardea y asigna el examen al alumno", async ({ page }) => {
    await signIn(page, TEACHER_EMAIL);
    await page.goto("/teacher");
    if (page.url().includes("/onboarding")) {
      await page.getByText("Soy docente").click();
      await page.getByRole("button", { name: /Continuar/i }).click();
      await page.locator("#ob-name").fill("Profe E2E");
      await page.locator("#ob-code").fill("oatec-docente-2026");
      await page.getByRole("button", { name: /Entrar a Parcialito/i }).click();
      await page.waitForURL("**/teacher");
    }

    await page.goto(`/teacher/assign/${SEED_EXAM}`);
    // Idempotente: si ya está asignado, el checkbox dice "Quitar acceso a" y no lo tocamos.
    const habilitar = page.getByRole("checkbox", { name: /Habilitar a Jhon Doe E2E/i });
    if (await habilitar.isVisible().catch(() => false)) {
      // La UI es optimista: hay que esperar la respuesta del POST, si no el test
      // termina, se cierra el contexto y el fetch en vuelo se aborta (no persiste).
      const [resp] = await Promise.all([
        page.waitForResponse((r) => r.url().includes("/assignments") && r.request().method() === "POST"),
        habilitar.click(),
      ]);
      expect(resp.ok()).toBeTruthy();
    }
    await expect(page.getByRole("checkbox", { name: /Quitar acceso a Jhon Doe E2E/i })).toBeVisible();
  });

  test("el alumno rinde el examen asignado y ve el resultado", async ({ page }) => {
    await signIn(page, STUDENT_EMAIL);
    await page.goto("/exams");

    // El examen con nota vive en la pestaña "Exámenes" (la default es "Práctica").
    await page.getByRole("button", { name: /Exámenes/i }).click();
    // El examen asignado aparece con "Rendir".
    await page.getByRole("link", { name: /Rendir/i }).click();
    await page.getByRole("button", { name: /Iniciar examen/i }).click();

    // Responde la primera pregunta (auto-guardado) y entrega.
    await page.getByTestId("option-A").click();
    await page.getByRole("button", { name: /^Finalizar/ }).click(); // barra superior
    await page.getByRole("button", { name: /Entregar examen/i }).click();

    await page.waitForURL("**/result/**");
    await expect(page.getByText(/respuestas correctas/i)).toBeVisible();
  });
});
