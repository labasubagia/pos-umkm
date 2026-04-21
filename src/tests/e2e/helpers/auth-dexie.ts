/**
 * auth-dexie.ts — E2E auth injection for the Dexie (Google) adapter.
 *
 * Injects auth state into localStorage before the page loads so that:
 *   1. GoogleAuthAdapter.restoreSession() returns the fake user immediately
 *      (reads `gsi_*` keys — no OAuth popup needed).
 *   2. Zustand `persist` middleware rehydrates the auth store from the injected
 *      `pos-umkm-auth` key, so ProtectedRoute sees isAuthenticated=true on the
 *      first render.
 *
 * Usage:
 *   await injectAuthState(page, storeConfig)
 *   await page.goto(`${BASE}/cashier`)
 *   await page.waitForSelector('[data-testid="product-search-input"]')
 */
import { type Page } from '@playwright/test'
import { stubGoogleApis } from './route-stubs'

export const BASE = '/pos-umkm'

export interface StoreConfig {
  storeId: string
  masterSpreadsheetId: string
  mainSpreadsheetId: string
  monthlySpreadsheetId: string
}

export const DEFAULT_STORE: StoreConfig = {
  storeId: 'e2e-store-1',
  masterSpreadsheetId: 'e2e-master-id',
  mainSpreadsheetId: 'e2e-main-id',
  monthlySpreadsheetId: 'e2e-monthly-id',
}

/**
 * Injects GoogleAuthAdapter session tokens + Zustand auth state into
 * localStorage via page.addInitScript (runs before any page JavaScript).
 * Must be called before page.goto().
 */
export async function injectAuthState(
  page: Page,
  store: StoreConfig = DEFAULT_STORE,
): Promise<void> {
  await stubGoogleApis(page)

  await page.addInitScript(
    ({ store }) => {
      // GoogleAuthAdapter reads these to restore session without OAuth popup.
      localStorage.setItem('gsi_access_token', 'fake-e2e-token')
      localStorage.setItem('gsi_token_expiry', String(Date.now() + 3_600_000))
      localStorage.setItem('gsi_user_id', 'e2e-owner-1')
      localStorage.setItem('gsi_user_email', 'owner@e2e.test')
      localStorage.setItem('gsi_user_name', 'E2E Owner')

      // Zustand persist key — rehydrates isAuthenticated + sheet IDs on load.
      localStorage.setItem(
        'pos-umkm-auth',
        JSON.stringify({
          state: {
            user: {
              id: 'e2e-owner-1',
              email: 'owner@e2e.test',
              name: 'E2E Owner',
              role: 'owner',
            },
            role: 'owner',
            isAuthenticated: true,
            spreadsheetId: store.masterSpreadsheetId,
            mainSpreadsheetId: store.mainSpreadsheetId,
            monthlySpreadsheetId: store.monthlySpreadsheetId,
            activeStoreId: store.storeId,
          },
          version: 0,
        }),
      )

      // Individual keys used by legacy setup.service helpers.
      localStorage.setItem('masterSpreadsheetId', store.masterSpreadsheetId)
      localStorage.setItem('mainSpreadsheetId', store.mainSpreadsheetId)
      localStorage.setItem('activeStoreId', store.storeId)
    },
    { store },
  )
}

/**
 * Full sign-in helper: injects auth, navigates to /cashier, waits for the
 * product-search-input to confirm the page is ready.
 */
export async function signInAsDexie(
  page: Page,
  store: StoreConfig = DEFAULT_STORE,
): Promise<void> {
  await injectAuthState(page, store)
  await page.goto(`${BASE}/cashier`)
  await page.getByTestId('product-search-input').waitFor()
}
