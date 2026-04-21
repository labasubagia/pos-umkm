/**
 * E2E specs for Store Management (T061).
 *
 * Auth is injected via localStorage. Store data is seeded into Dexie.
 * Google Drive/Sheets API calls (createSpreadsheet for new stores) are
 * stubbed via page.route() to return a fake spreadsheetId.
 */
import { test, expect } from '@playwright/test'
import { injectAuthState, DEFAULT_STORE, BASE } from './helpers/auth-dexie'
import { seedDexie, reloadAndWait } from './helpers/dexie-seed'
import { navigateTo } from './helpers/auth'

const STORE = DEFAULT_STORE
const now = new Date().toISOString()

const SEED_STORES = [
  {
    id: 'store-a',
    store_id: 'store-a',
    store_name: 'Toko Utama',
    master_spreadsheet_id: 'master-a',
    drive_folder_id: 'folder-a',
    owner_email: 'owner@e2e.test',
    my_role: 'owner',
    joined_at: '2026-01-01T00:00:00Z',
    deleted_at: null,
  },
  {
    id: 'store-b',
    store_id: 'store-b',
    store_name: 'Toko Mitra',
    master_spreadsheet_id: 'master-b',
    drive_folder_id: 'folder-b',
    owner_email: 'other@test.com',
    my_role: 'manager',
    joined_at: '2026-02-01T00:00:00Z',
    deleted_at: null,
  },
]

async function openStoresTab(page: Parameters<typeof injectAuthState>[0]) {
  await navigateTo(page, `${BASE}/settings`)
  await page.getByTestId('btn-tab-stores').click()
  await page.getByRole('heading', { name: /kelola toko/i }).waitFor()
}

async function signInToSettings(page: Parameters<typeof injectAuthState>[0]) {
  await injectAuthState(page, STORE)
  await page.goto(`${BASE}/settings`)
  await page.getByTestId('btn-tab-stores').waitFor()
  await seedDexie(page, STORE.storeId, { Stores: SEED_STORES })
  await reloadAndWait(page, 'btn-tab-stores')
  await page.getByTestId('btn-tab-stores').click()
  await page.getByRole('heading', { name: /kelola toko/i }).waitFor()
}

test.describe('Store Management', () => {
  test('owner can add a new store', async ({ page }) => {
    // Stub createSpreadsheet to return a fake spreadsheetId
    await page.route('**googleapis.com/drive/v3/files**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'new-folder-id', name: 'POS UMKM' }),
      })
    })
    await page.route('**googleapis.com/v4/spreadsheets**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ spreadsheetId: 'new-sheet-id', properties: { title: 'Cabang Baru' } }),
      })
    })

    await signInToSettings(page)
    await page.getByTestId('btn-add-store').click()
    await page.getByTestId('input-store-name').fill('Cabang Baru')
    await page.getByTestId('btn-save-store').click()

    await expect(page.getByText('Cabang Baru')).toBeVisible({ timeout: 5000 })
  })

  test('owner can edit store name', async ({ page }) => {
    await signInToSettings(page)

    await page.getByTestId('btn-edit-store-store-a').click()
    const input = page.getByTestId('input-store-name-edit')
    await input.clear()
    await input.fill('Toko Utama Renamed')
    await page.getByTestId('btn-save-store-edit').click()

    await expect(page.getByText('Toko Utama Renamed')).toBeVisible({ timeout: 5000 })
  })

  test('owner can delete owned store', async ({ page }) => {
    await signInToSettings(page)

    await expect(page.getByText('Toko Utama')).toBeVisible()
    await page.getByTestId('btn-delete-store-store-a').click()
    await page.getByTestId('btn-confirm-delete-store').click()
    await expect(page.getByText('Toko Utama')).not.toBeVisible({ timeout: 5000 })
  })

  test('member can leave a non-owned store', async ({ page }) => {
    const storeMembers = [
      {
        id: 'm1',
        email: 'owner@e2e.test',
        name: 'E2E Owner',
        role: 'manager',
        invited_at: '2026-02-01T00:00:00Z',
        deleted_at: null,
        created_at: now,
      },
    ]

    await injectAuthState(page, STORE)
    await page.goto(`${BASE}/settings`)
    await page.getByTestId('btn-tab-stores').waitFor()
    await seedDexie(page, STORE.storeId, { Stores: SEED_STORES, Members: storeMembers })
    await reloadAndWait(page, 'btn-tab-stores')
    await page.getByTestId('btn-tab-stores').click()
    await page.getByRole('heading', { name: /kelola toko/i }).waitFor()

    await page.getByTestId('btn-leave-store-store-b').click()
    await page.getByTestId('btn-confirm-leave-store').click()
    await page.waitForURL(/\/stores/, { waitUntil: 'commit', timeout: 5000 })
  })

  test('Save button is disabled when store name is empty', async ({ page }) => {
    await signInToSettings(page)

    await page.getByTestId('btn-add-store').click()
    // Leave input empty
    const saveBtn = page.getByTestId('btn-save-store')
    await expect(saveBtn).toBeDisabled()
  })
})
