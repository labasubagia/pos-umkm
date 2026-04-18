import { Page } from '@playwright/test'

const BASE = '/pos-umkm'

/**
 * Sign in as owner using the mock auth flow.
 * Navigates to /login and clicks "Masuk dengan Google".
 * MockAuthAdapter returns the preset owner user instantly.
 */
export async function signInAsOwner(page: Page): Promise<void> {
  await page.goto(`${BASE}/login`)
  await page.getByRole('button', { name: /masuk dengan google/i }).click()
  // After sign-in, owner is routed to /setup (first time) or /cashier
  await page.waitForURL(/\/(setup|cashier)/)
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
  })
  await page.goto(`${BASE}/login`)
  await page.getByRole('button', { name: /masuk dengan google/i }).click()
  await page.waitForURL(/\/cashier/)
}

