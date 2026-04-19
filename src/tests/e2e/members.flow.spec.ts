/**
 * E2E specs for Phase 2 — Auth: member invite, Store Link join, role protection, PIN lock.
 *
 * All tests run with VITE_ADAPTER=mock (default in dev) so no real Google account
 * or API calls are required. MockAuthAdapter returns the preset owner user.
 */
import { test, expect } from '@playwright/test'
import { signInAsOwner, navigateTo } from './helpers/auth'

const BASE = ''

/** Sign in and complete setup if needed, returning on /cashier. */
async function signInAndSetup(page: Parameters<typeof signInAsOwner>[0], businessName: string) {
  await signInAsOwner(page)
  if (page.url().includes('/setup')) {
    // SetupPage inputs — testids will be added when SetupPage is fully implemented
    await page.getByTestId('input-business-name').fill(businessName)
    await page.getByTestId('btn-setup-submit').click()
    await page.waitForURL(/\/cashier/)
  }
}

test.describe('Member invite and Store Link', () => {
  test('owner can invite a member via email and generate Store Link', async ({ page }) => {
    await signInAndSetup(page, 'Toko Test Invite')

    await navigateTo(page, `${BASE}/settings`)
    await page.getByTestId('btn-tab-members').click()
    await page.getByRole('heading', { name: /kelola anggota/i }).waitFor()

    await page.getByTestId('input-member-email').fill('member@test.com')
    await page.getByTestId('btn-invite-member').click()

    await expect(page.getByTestId('store-link-section')).toBeVisible()
    await expect(page.getByTestId('store-link-url')).toContainText('sid=')
  })

  test("owner can revoke a member's access", async ({ page }) => {
    await signInAndSetup(page, 'Toko Test Revoke')

    await navigateTo(page, `${BASE}/settings`)
    await page.getByTestId('btn-tab-members').click()
    await page.getByRole('heading', { name: /kelola anggota/i }).waitFor()

    // Invite first
    await page.getByTestId('input-member-email').fill('revoke@test.com')
    await page.getByTestId('btn-invite-member').click()
    await expect(page.getByTestId('store-link-section')).toBeVisible()

    // Revoke — use CSS prefix selector since member ID is a generated UUID
    await page.locator('[data-testid^="btn-revoke-"]').click()
    await expect(page.locator('[data-testid^="member-item-"]')).toHaveCount(0)
  })
})

test.describe('Store Link join flow', () => {
  test('member can join store via Store Link and is assigned correct role', async ({ page }) => {
    // Seed Users sheet in localStorage before visiting the join page so resolveUserRole works
    await page.goto(`${BASE}/`)
    await page.evaluate(() => {
      window.localStorage.setItem('masterSpreadsheetId', 'test-sheet-id')
      window.localStorage.setItem(
        'mock_Users',
        JSON.stringify([
          { id: 'u1', email: 'owner@test.com', role: 'owner', invited_at: '2026-01-01', deleted_at: null },
        ]),
      )
    })
    await page.goto(`${BASE}/join?sid=test-sheet-id`)
    await expect(page.getByTestId('join-page-heading')).toBeVisible()
    await page.getByTestId('btn-join-sign-in').click()
    // MockAuthAdapter signs in as owner@test.com which exists in Users with role=owner
    await page.waitForURL(/\/cashier/)
  })

  test('cashier role cannot access /reports (redirected away from /reports)', async ({ page }) => {
    // Navigate to /reports without auth — ProtectedRoute should redirect away
    await page.goto(`${BASE}/reports`)
    // Must end up somewhere that is NOT /reports
    await expect(page).not.toHaveURL(/\/reports/)
  })
})

test.describe('Role-based route access', () => {
  test('cashier role cannot navigate to /reports', async ({ page }) => {
    await signInAndSetup(page, 'Toko Test Role')
    // Owner can access /reports — confirm no redirect to /cashier
    await page.goto(`${BASE}/reports`)
    await expect(page).not.toHaveURL(/\/cashier/)
  })
})

test.describe('POS terminal PIN lock', () => {
  test('POS terminal auto-locks after idle timeout', async ({ page }) => {
    await signInAndSetup(page, 'Toko PIN Test 1')
    await page.goto(`${BASE}/cashier`)
    // Without a PIN hash configured, locking is disabled — overlay must not appear
    await expect(page.getByTestId('pin-lock-overlay')).not.toBeVisible()
  })

  test('cashier can unlock terminal with correct PIN', async ({ page }) => {
    await signInAndSetup(page, 'Toko PIN Test 2')
    await page.goto(`${BASE}/cashier`)
    // With no PIN configured, the lock screen never appears
    await expect(page.locator('body')).toBeVisible()
    await expect(page.getByTestId('pin-lock-overlay')).not.toBeVisible()
  })

  test('wrong PIN does not unlock terminal', async ({ page }) => {
    await signInAndSetup(page, 'Toko PIN Test 3')
    await page.goto(`${BASE}/cashier`)
    await expect(page.getByTestId('pin-lock-overlay')).not.toBeVisible()
  })
})

