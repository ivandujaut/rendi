import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

// Los tests corren contra el dev server local (que apunta a rendi-dev).
// Cargamos .env.local para que Clerk testing tenga las keys.
dotenv.config({ path: ".env.local" });
// @clerk/testing busca CLERK_PUBLISHABLE_KEY; en el proyecto la var es NEXT_PUBLIC_*.
process.env.CLERK_PUBLISHABLE_KEY ||= process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export default defineConfig({
  testDir: "./e2e",
  // Los tests mutan estado compartido en rendi-dev (onboarding, waitlist),
  // así que serial y un solo worker para que sean deterministas.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["line"], ["html", { open: "never" }]] : "line",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  // En CI arrancamos la app (checkout limpio, sin riesgo para el .next). En local
  // se reusa el dev server que ya está corriendo (no definimos webServer).
  webServer: process.env.CI
    ? {
        command: "npm run start",
        url: "http://localhost:3000",
        timeout: 120_000,
        reuseExistingServer: false,
      }
    : undefined,
  projects: [
    // Obtiene el testing token de Clerk (bypassa la protección anti-bot).
    { name: "setup", testMatch: /global\.setup\.ts/ },
    { name: "chromium", use: { ...devices["Desktop Chrome"] }, dependencies: ["setup"] },
  ],
});
