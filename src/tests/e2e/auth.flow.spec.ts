/**
 * flow.spec.ts — Explore the full auth flow from base URL.
 *
 * Uses test mode bypass (__E2E_SIGNIN__) to skip OAuth popup.
 * Uses console logging to debug at each step.
 */
import { test } from "@playwright/test";
import { BASE } from "./helpers/auth";

test.describe("Full auth flow exploration", () => {
  test("base URL → landing page", async ({ page }) => {
    await page.goto("http://localhost:5174/pos-umkm/");
    await page.waitForLoadState("domcontentloaded");
    await page.screenshot({ path: "/tmp/e2e-01-landing.png", fullPage: true });
  });

  test("landing → login page", async ({ page }) => {
    await page.goto("http://localhost:5174/pos-umkm/");
    await page.waitForLoadState("domcontentloaded");

    // Wait for React to render the button
    await page
      .getByRole("button", { name: /Masuk/i })
      .waitFor({ state: "visible" });

    // Click the "Masuk" button
    await page.getByRole("button", { name: /Masuk/i }).click();
    await page.waitForURL("**/login");
    await page.screenshot({ path: "/tmp/e2e-02-login.png", fullPage: true });
  });

  test("login → click sign in → stores/setup (test mode)", async ({ page }) => {
    // Enable test mode + MSW BEFORE navigation
    await page.addInitScript(() => {
      (window as unknown as Record<string, unknown>).__E2E_SIGNIN__ = true;
      (window as unknown as Record<string, unknown>).__MSW_ENABLED__ = true;
    });

    // Go to login page
    await page.goto(`${BASE}/login`);
    await page.waitForLoadState("domcontentloaded");

    // Click the Google sign-in button - should return fake user
    await page.getByRole("button", { name: /google/i }).click();

    const businessNameInput = page.getByLabel(/Nama Usaha/i);
    await businessNameInput.fill("Toko E2E");
    await page.getByRole("button", { name: /Mulai Sekarang/i }).click();

    await page.screenshot({
      path: "/tmp/e2e-03-after-signin.png",
      fullPage: true,
    });
  });
});
