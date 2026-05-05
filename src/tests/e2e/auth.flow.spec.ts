/**
 * flow.spec.ts — Explore the full auth flow from base URL.
 *
 * Uses test mode bypass (__E2E_SIGNIN__) to skip OAuth popup.
 * Uses console logging to debug at each step.
 */
import type { Page } from "@playwright/test";
import { test } from "@playwright/test";
import { BASE } from "./helpers/auth";

const logs: string[] = [];

async function captureConsole(page: Page) {
  page.on("console", (msg: { type: () => string; text: () => string }) => {
    const text = `[${msg.type()}] ${msg.text()}`;
    logs.push(text);
    console.log(text);
  });
  page.on("pageerror", (err: { message: string }) => {
    const text = `[pageerror] ${err.message}`;
    logs.push(text);
    console.log(text);
  });
}

async function logPageState(page: Page, step: string) {
  console.log(`\n=== ${step} ===`);
  console.log(`URL: ${page.url()}`);
  console.log(`Title: ${await page.title()}`);
}

test.skip("Full auth flow exploration", () => {
  test("base URL → landing page", async ({ page }) => {
    await captureConsole(page);

    await logPageState(page, "STEP 1: Visit base URL");
    await page.goto("http://localhost:5174/pos-umkm/");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(3000);

    // Get actual page content after React renders
    const bodyText = await page
      .locator("body")
      .innerText()
      .catch(() => "");
    console.log(`Body text: ${bodyText.substring(0, 200)}`);

    // Check what's on the landing page
    const content = await page.content();
    console.log(`Page has POS text: ${content.includes("POS")}`);
    console.log(`Page has Masuk text: ${content.includes("Masuk")}`);

    await page.screenshot({ path: "/tmp/e2e-01-landing.png", fullPage: true });
  });

  test("landing → login page", async ({ page }) => {
    await captureConsole(page);

    await logPageState(page, "STEP 1: Visit base URL");
    await page.goto("http://localhost:5174/pos-umkm/");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);

    // Wait for React to render the button
    await page
      .getByRole("button", { name: /Masuk/i })
      .waitFor({ state: "visible" });

    logPageState(page, "AFTER LOAD - Landing page rendered");

    // Click the "Masuk" button
    await logPageState(page, "STEP 2: Click Masuk button");
    await page.getByRole("button", { name: /Masuk/i }).click();
    await page.waitForURL("**/login");

    // Wait for login page to render
    await page.waitForTimeout(2000);

    logPageState(page, "AFTER NAVIGATE TO /login");

    // Get login page content
    const loginText = await page
      .locator("body")
      .innerText()
      .catch(() => "");
    console.log(`Login page text: ${loginText.substring(0, 300)}`);

    // Check login page content
    const content = await page.content();
    console.log(`Has Google button: ${content.includes("Google")}`);

    await page.screenshot({ path: "/tmp/e2e-02-login.png", fullPage: true });
  });

  test("login → click sign in → stores/setup (test mode)", async ({ page }) => {
    await captureConsole(page);

    // Enable test mode + MSW BEFORE navigation
    await page.addInitScript(() => {
      (window as unknown as Record<string, unknown>).__E2E_SIGNIN__ = true;
      (window as unknown as Record<string, unknown>).__MSW_ENABLED__ = true;
    });

    // Go to login page
    await logPageState(page, "STEP 1: Go to login");
    await page.goto(`${BASE}/login`);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);

    logPageState(page, "BEFORE CLICK SIGN IN");

    // Click the Google sign-in button - should return fake user
    await page.getByRole("button", { name: /google/i }).click();

    // Wait for redirect to store picker or setup
    await page.waitForTimeout(3000);

    logPageState(page, "AFTER SIGN IN");

    const currentUrl = page.url();
    console.log(`Current URL after sign in: ${currentUrl}`);

    // We're at /setup - now test the setup flow
    await logPageState(page, "STEP 2: FILL SETUP FORM");
    await page.waitForTimeout(1000);

    // Fill business name
    const businessNameInput = page.getByLabel(/Nama Usaha/i);
    if (await businessNameInput.isVisible()) {
      await businessNameInput.fill("Toko E2E");

      // Click submit
      await logPageState(page, "CLICK MULAI SEKARANG");
      await page.getByRole("button", { name: /Mulai Sekarang/i }).click();

      // Wait for navigation to cashier
      await page.waitForTimeout(3000);

      logPageState(page, "AFTER SETUP SUBMIT");

      const finalUrl = page.url();
      console.log(`Final URL: ${finalUrl}`);

      const finalText = await page
        .locator("body")
        .innerText()
        .catch(() => "");
      console.log(`Final page content: ${finalText.substring(0, 500)}`);
    } else {
      console.log("Setup form not visible - might already be set up");
    }

    await page.screenshot({
      path: "/tmp/e2e-03-after-signin.png",
      fullPage: true,
    });

    // Print all captured logs
    console.log("\n=== CAPTURED CONSOLE LOGS ===");
    for (const log of logs) {
      console.log(log);
    }
  });
});
