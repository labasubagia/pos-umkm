/**
 * auth.ts — E2E auth helpers.
 *
 * Exports BASE, DEFAULT_STORE, navigateTo.
 * For auth flow, use auth-flow.ts (enableTestMode + loginAndSetup).
 */
import type { Page } from "@playwright/test";

export const BASE = "/pos-umkm";

export interface StoreConfig {
  storeId: string;
  mainSpreadsheetId: string;
}

export const DEFAULT_STORE: StoreConfig = {
  storeId: "e2e-store-1",
  mainSpreadsheetId: "e2e-main-id",
};

/**
 * Navigate within the SPA without a hard reload, preserving in-memory
 * React/Zustand state. Pushes a history entry and fires popstate so React
 * Router picks it up — equivalent to clicking a <Link>.
 *
 * When `readyTestId` is provided, waits for that element to appear before
 * returning — avoiding race conditions where callers interact with elements
 * that haven't rendered yet.
 */
export async function navigateTo(
  page: Page,
  path: string,
  readyTestId?: string,
): Promise<void> {
  await page.evaluate((p) => {
    window.history.pushState({}, "", p);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, path);
  if (readyTestId) {
    await page.getByTestId(readyTestId).waitFor();
  }
}
