import { expect, test } from "@playwright/test";

test("page loads and title contains POS UMKM", async ({ page }) => {
  await page.goto("/pos-umkm/");
  await expect(page).toHaveTitle(/POS UMKM/);
});
