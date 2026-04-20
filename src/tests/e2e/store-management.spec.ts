/**
 * E2E specs for Store Management (T061).
 *
 * Runs with VITE_ADAPTER=mock. MockSheetRepository backs the Stores tab
 * via localStorage under the key 'mock_Stores'.
 *
 * All tests sign in as owner and navigate to /settings → Toko tab.
 */
import { test, expect } from '@playwright/test'
import { signInAsOwner, navigateTo } from './helpers/auth'

const BASE = '/pos-umkm'

/** Seed a Stores row for the owner and an additional joined store into localStorage. */
async function seedStores(page: Parameters<typeof signInAsOwner>[0]) {
  await page.evaluate(() => {
    window.localStorage.setItem(
      'mock_Stores',
      JSON.stringify([
        {
          store_id: 'store-a',
          store_name: 'Toko Utama',
          master_spreadsheet_id: 'master-a',
          drive_folder_id: 'folder-a',
          owner_email: 'owner@test.com',
          my_role: 'owner',
          joined_at: '2026-01-01T00:00:00Z',
          deleted_at: null,
        },
        {
          store_id: 'store-b',
          store_name: 'Toko Mitra',
          master_spreadsheet_id: 'master-b',
          drive_folder_id: 'folder-b',
          owner_email: 'other@test.com',
          my_role: 'manager',
          joined_at: '2026-02-01T00:00:00Z',
          deleted_at: null,
        },
      ]),
    )
  })
}

async function openStoresTab(page: Parameters<typeof signInAsOwner>[0]) {
  await navigateTo(page, `${BASE}/settings`)
  await page.getByTestId('btn-tab-stores').click()
  await page.getByRole('heading', { name: /kelola toko/i }).waitFor()
}

test.describe('Store Management', () => {
  test('owner can add a new store', async ({ page }) => {
    await signInAsOwner(page)
    await seedStores(page)
    await openStoresTab(page)

    await page.getByTestId('btn-add-store').click()
    await page.getByTestId('input-store-name').fill('Cabang Baru')
    await page.getByTestId('btn-save-store').click()

    // MockSheetRepository appends synchronously — the new row should appear.
    await expect(page.getByText('Cabang Baru')).toBeVisible({ timeout: 5000 })
  })

  test('owner can edit store name', async ({ page }) => {
    await signInAsOwner(page)
    await seedStores(page)
    await openStoresTab(page)

    await page.getByTestId('btn-edit-store-store-a').click()
    const input = page.getByTestId('input-store-name-edit')
    await input.clear()
    await input.fill('Toko Utama Renamed')
    await page.getByTestId('btn-save-store-edit').click()

    await expect(page.getByText('Toko Utama Renamed')).toBeVisible({ timeout: 5000 })
  })

  test('owner can delete owned store', async ({ page }) => {
    await signInAsOwner(page)
    await seedStores(page)
    await openStoresTab(page)

    // Ensure Toko Utama is present first
    await expect(page.getByText('Toko Utama')).toBeVisible()

    await page.getByTestId('btn-delete-store-store-a').click()
    await page.getByTestId('btn-confirm-delete-store').click()

    await expect(page.getByText('Toko Utama')).not.toBeVisible({ timeout: 5000 })
  })

  test('member can leave a non-owned store', async ({ page }) => {
    await signInAsOwner(page)
    await seedStores(page)
    // Seed a Members row in master-b so removeAccessToStore finds the caller
    await page.evaluate(() => {
      window.localStorage.setItem(
        'mock_Members',
        JSON.stringify([
          {
            id: 'm1',
            email: 'owner@test.com',
            name: 'Test Owner',
            role: 'manager',
            invited_at: '2026-02-01T00:00:00Z',
            deleted_at: null,
          },
        ]),
      )
    })
    await openStoresTab(page)

    await page.getByTestId('btn-leave-store-store-b').click()
    await page.getByTestId('btn-confirm-leave-store').click()

    // Should redirect to /stores after leaving
    await page.waitForURL(/\/stores/, { waitUntil: 'commit', timeout: 5000 })
  })

  test('error is shown when store name is empty', async ({ page }) => {
    await signInAsOwner(page)
    await seedStores(page)
    await openStoresTab(page)

    await page.getByTestId('btn-add-store').click()
    // Leave input empty — Save button should be disabled
    const saveBtn = page.getByTestId('btn-save-store')
    await expect(saveBtn).toBeDisabled()
  })
})
