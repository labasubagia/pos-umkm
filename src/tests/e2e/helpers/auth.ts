import { type Page } from '@playwright/test'

const BASE = '/pos-umkm'

/**
 * Sign in as owner using the mock auth flow.
 * Navigates to /login, pre-seeds masterSpreadsheetId so LoginPage takes the
 * fast path directly to /cashier (bypasses StorePickerPage).
 * MockAuthAdapter returns the preset owner user instantly.
 */
export async function signInAsOwner(page: Page): Promise<void> {
  await page.goto(`${BASE}/login`)
  // Seed masterSpreadsheetId AFTER navigating to ensure correct storage origin.
  // LoginPage reads this key: if present it skips StorePickerPage and goes to /cashier.
  await page.evaluate(() => {
    window.localStorage.setItem('masterSpreadsheetId', 'mock-master-id')
  })
  await page.getByTestId('btn-sign-in').click()
  // waitUntil: 'commit' resolves on URL change without waiting for a 'load' event
  // (SPA navigation via history.pushState does not emit 'load').
  await page.waitForURL(/\/cashier/, { waitUntil: 'commit' })
}

/**
 * Sign in as cashier by injecting auth state directly into the Zustand store
 * via localStorage + page navigation. Used for role-restriction tests.
 *
 * In mock mode, all adapter sign-ins return the preset owner. For cashier
 * role tests, we set up the store state directly.
 */
export async function signInAsCashier(page: Page): Promise<void> {
  // Inject auth state via localStorage so the Zustand store hydrates correctly.
  // This is the approved E2E bypass for role testing in a client-side app.
  await page.goto(`${BASE}/`)
  await page.evaluate(() => {
    window.localStorage.setItem('mock_auth_role', 'cashier')
    window.localStorage.setItem('masterSpreadsheetId', 'mock-master-id')
  })
  await page.goto(`${BASE}/login`)
  await page.getByTestId('btn-sign-in').click()
  await page.waitForURL(/\/cashier/, { waitUntil: 'commit' })
}

/**
 * Navigate within the SPA without a hard reload, preserving in-memory React/Zustand state.
 *
 * `page.goto()` resets the JS heap; this helper instead pushes a new history entry and
 * fires a popstate event so React Router picks it up — equivalent to clicking a <Link>.
 */
export async function navigateTo(page: Page, path: string): Promise<void> {
  await page.evaluate((p) => {
    window.history.pushState({}, '', p)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, path)
}
