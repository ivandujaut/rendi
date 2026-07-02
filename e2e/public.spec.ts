import { test, expect } from "@playwright/test";

// Flujo público (sin auth): la landing y la waitlist. Prueba el harness
// end-to-end incluyendo una escritura real en rendi-dev (tabla waitlist).

test("landing carga para un visitante deslogueado", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Rendi/);
  await expect(page.locator("#wl-email")).toBeVisible();
});

test("waitlist: sumarse a la lista muestra el estado de éxito", async ({ page }) => {
  await page.goto("/");
  const email = `e2e-${Date.now()}@test.local`;
  await page.locator("#wl-email").fill(email);
  await page.getByRole("button", { name: /Sumarme a la lista/i }).click();
  await expect(page.getByText(/quedaste en la lista/i)).toBeVisible();
});
