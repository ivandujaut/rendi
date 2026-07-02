import { clerkSetup } from "@clerk/testing/playwright";
import { test as setup } from "@playwright/test";

// Obtiene un Testing Token de Clerk una vez para toda la corrida.
setup("clerk global setup", async () => {
  await clerkSetup();
});
