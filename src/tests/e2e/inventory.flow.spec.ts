/**
 * E2E specs for Phase 3 — Product Catalog: categories, products, variants, CSV import.
 *
 * All tests run with VITE_ADAPTER=mock (default in dev). MockAuthAdapter returns
 * the preset owner user (role: owner) so /catalog is accessible without a real
 * Google account.
 *
 * Phase 4 dependency note: tests marked test.fixme() require the cashier product
 * search UI (T026) which is not yet implemented. They will be un-fixed in Phase 4.
 */
import { test, expect } from '@playwright/test'
import { signInAsOwner, navigateTo } from './helpers/auth'

const BASE = '/pos-umkm'

/** Sign in as owner and navigate to /catalog, waiting for the page to load. */
async function signInToCatalog(page: Parameters<typeof signInAsOwner>[0]) {
  await signInAsOwner(page)

  // Complete setup wizard if redirected there on first visit
  if (page.url().includes('/setup')) {
    await page.getByPlaceholder(/nama usaha/i).fill('Toko Katalog Test')
    await page.getByRole('button', { name: /mulai sekarang/i }).click()
    await page.waitForURL(/\/cashier/)
  }

  // Use navigateTo (SPA push) instead of page.goto() to preserve in-memory auth state
  await navigateTo(page, `${BASE}/catalog`)
  // Wait for the catalog page heading to confirm the component mounted
  await page.getByRole('heading', { name: /katalog produk/i }).waitFor()
}

// ─── T021 — Categories CRUD ───────────────────────────────────────────────────

test.describe('Categories CRUD (T021)', () => {
  test('owner can create, rename, and delete a category', async ({ page }) => {
    await signInToCatalog(page)

    // Switch to the Categories tab
    await page.getByRole('button', { name: /kategori/i }).click()
    await page.getByRole('heading', { name: /kategori produk/i }).waitFor()

    // ── Create ─────────────────────────────────────────────────────────────
    await page.getByRole('button', { name: /tambah kategori/i }).click()

    const nameInput = page.getByLabel(/nama kategori/i)
    await nameInput.fill('Minuman Segar')
    await page.getByRole('button', { name: 'Tambah', exact: true }).click()

    // Category should now appear in the list
    await expect(page.getByText('Minuman Segar')).toBeVisible()

    // ── Rename ─────────────────────────────────────────────────────────────
    // Click Edit on the new category's row
    const categoryRow = page.locator('li').filter({ hasText: 'Minuman Segar' })
    await categoryRow.getByRole('button', { name: /edit/i }).click()

    const editInput = page.getByLabel(/nama kategori/i)
    await editInput.fill('Minuman Dingin')
    await page.getByRole('button', { name: /perbarui/i }).click()

    await expect(page.getByText('Minuman Dingin')).toBeVisible()
    await expect(page.getByText('Minuman Segar')).not.toBeVisible()

    // ── Delete ─────────────────────────────────────────────────────────────
    const updatedRow = page.locator('li').filter({ hasText: 'Minuman Dingin' })
    await updatedRow.getByRole('button', { name: /hapus/i }).click()

    await expect(page.getByText('Minuman Dingin')).not.toBeVisible()
  })
})

// ─── T022 — Products CRUD ─────────────────────────────────────────────────────

test.describe('Products CRUD (T022)', () => {
  test('owner can add a product and it appears in the catalog product list', async ({ page }) => {
    await signInToCatalog(page)

    // Ensure we are on the Products tab (default)
    await page.getByRole('heading', { name: 'Produk', exact: true }).waitFor()

    // First, seed a category so the product form has something to pick from
    await page.getByRole('button', { name: /kategori/i }).click()
    await page.getByRole('heading', { name: /kategori produk/i }).waitFor()
    await page.getByRole('button', { name: /tambah kategori/i }).click()
    await page.getByLabel(/nama kategori/i).fill('Makanan')
    await page.getByRole('button', { name: 'Tambah', exact: true }).click()
    await expect(page.getByText('Makanan')).toBeVisible()

    // Switch back to Products tab
    await page.getByRole('button', { name: 'Produk', exact: true }).click()
    await page.getByRole('heading', { name: 'Produk', exact: true }).waitFor()

    // Add a product
    await page.getByRole('button', { name: /tambah produk/i }).click()

    await page.getByLabel(/nama produk/i).fill('Nasi Goreng Spesial')
    await page.getByLabel(/kategori/i).selectOption({ label: 'Makanan' })
    await page.getByLabel(/harga/i).fill('15000')
    await page.getByLabel(/stok/i).fill('50')
    await page.getByRole('button', { name: 'Tambah', exact: true }).click()

    // Product should appear in the product list
    await expect(page.getByText('Nasi Goreng Spesial')).toBeVisible()
    await expect(page.getByText(/Rp 15\.000/)).toBeVisible()
  })

  /**
   * Requires cashier product search UI (T026 — Phase 4).
   * This test will be activated when the cashier screen is implemented.
   */
  test.fixme(
    'owner can add a product and it appears in cashier product search',
    async ({ page }) => {
      await signInToCatalog(page)

      // Add product via catalog
      await page.getByRole('button', { name: /tambah produk/i }).click()
      await page.getByLabel(/nama produk/i).fill('Mie Goreng')
      await page.getByLabel(/harga/i).fill('12000')
      await page.getByLabel(/stok/i).fill('20')
      await page.getByRole('button', { name: /tambah/i }).click()
      await expect(page.getByText('Mie Goreng')).toBeVisible()

      // Navigate to cashier and search for the product
      await navigateTo(page, `${BASE}/cashier`)
      const searchInput = page.getByPlaceholder(/cari produk/i)
      await searchInput.fill('Mie Goreng')
      await expect(page.getByText('Mie Goreng')).toBeVisible()
    },
  )

  /**
   * Requires cashier cart + transaction commit UI (T031 — Phase 4).
   * Verifies that completing a sale decrements product stock by the correct quantity.
   */
  test.fixme(
    'completing a sale decrements product stock by correct quantity',
    async ({ page }) => {
      // Seed a product with known stock in localStorage
      await page.goto(`${BASE}/`)
      await page.evaluate(() => {
        window.localStorage.setItem(
          'mock_Products',
          JSON.stringify([
            {
              id: 'prod-stock-test',
              category_id: 'cat-1',
              name: 'Produk Stok Test',
              sku: 'STOK-01',
              price: 10000,
              stock: 20,
              has_variants: false,
              created_at: new Date().toISOString(),
              deleted_at: null,
            },
          ]),
        )
      })

      await signInToCatalog(page)
      await navigateTo(page, `${BASE}/cashier`)

      // Search for the product and add to cart
      await page.getByPlaceholder(/cari produk/i).fill('Produk Stok Test')
      await page.getByText('Produk Stok Test').click()

      // Confirm payment and complete the transaction
      await page.getByRole('button', { name: /bayar/i }).click()
      await page.getByRole('button', { name: /tunai/i }).click()
      await page.getByLabel(/jumlah diterima/i).fill('10000')
      await page.getByRole('button', { name: /selesaikan/i }).click()

      // Navigate to catalog and verify stock decremented from 20 to 19
      await navigateTo(page, `${BASE}/catalog`)
      await expect(page.getByText(/Stok: 19/)).toBeVisible()
    },
  )
})
