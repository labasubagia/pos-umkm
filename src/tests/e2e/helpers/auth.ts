/**
 * auth.ts — Shared E2E navigation helpers.
 *
 * Auth injection is now done via auth-dexie.ts. This file only contains the
 * navigateTo SPA-navigation helper, kept for backward compatibility.
 */
import { type Page } from '@playwright/test'

/**
 * Navigate within the SPA without a hard reload, preserving in-memory
 * React/Zustand state. Pushes a history entry and fires popstate so React
 * Router picks it up — equivalent to clicking a <Link>.
 */
export async function navigateTo(page: Page, path: string): Promise<void> {
  await page.evaluate((p) => {
    window.history.pushState({}, '', p)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, path)
}
