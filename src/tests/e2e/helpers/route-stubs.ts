/**
 * route-stubs.ts — Playwright route stubs for Google APIs.
 *
 * Stubs all googleapis.com and accounts.google.com routes with 200 `{}` so
 * E2E tests run without real credentials. Sheets API calls (SyncManager outbox
 * drain) return success silently; OAuth token endpoints are never reached
 * because auth state is injected via localStorage before page load.
 */
import { type Page } from '@playwright/test'

export async function stubGoogleApis(page: Page): Promise<void> {
  await page.route('**/*.googleapis.com/**', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })
  await page.route('**accounts.google.com/**', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })
}
