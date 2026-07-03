import { test, expect } from "@playwright/test";
import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";

// Alumno de test en la instancia dev de Clerk. Los emails `+clerk_test` no envían
// mails reales y aceptan el código de test (424242) automáticamente; por eso el
// sign-in usa la estrategia `email_code` (la instancia usa email code, no password).
const STUDENT_EMAIL = "doe+clerk_test@example.com";

test("alumno: sign-in → onboarding (si hace falta) → /exams", async ({ page }) => {
  await setupClerkTestingToken({ page });
  await page.goto("/");
  await clerk.loaded({ page });
  await clerk.signIn({ page, signInParams: { strategy: "email_code", identifier: STUDENT_EMAIL } });

  await page.goto("/exams");

  // En rendi-dev el perfil arranca sin onboardear → la app redirige a /onboarding
  // la primera vez. Idempotente: si ya está onboardeado, este bloque se saltea.
  if (page.url().includes("/onboarding")) {
    await page.getByText("Soy alumno/a").click();
    await page.getByRole("button", { name: /Continuar/i }).click();
    await page.locator("#ob-name").fill("Jhon Doe E2E");
    await page.locator("#ob-group").fill("E2E Comisión");
    await page.getByRole("button", { name: /Entrar a Parcialito/i }).click();
  }

  await page.waitForURL("**/exams");
  // Alumno sin asignaciones: ve el estado vacío (no un error de auth/RLS).
  await expect(page.getByRole("heading", { name: /Eleg[ií] un examen/i })).toBeVisible();
});
