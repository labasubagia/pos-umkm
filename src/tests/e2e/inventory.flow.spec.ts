/**
 * E2E specs for Phase 3 — Product Catalog: categories, products, variants, CSV import.
 *
 * All tests run with VITE_ADAPTER=mock (default in dev). MockAuthAdapter returns
 * the preset owner user (role: owner) so /catalog is accessible without a real
 * Google account.
 */
import { test, expect } from '@playwright/test'
import { signInAsOwner, navigateTo } from './helpers/auth'

const BASE = '/pos-umkm'

/** Sign in as owner and navigate to /catalog, waiting for the page to load. */
async function signInToCatalog(page: Parameters<typeof signInAsOwner>[0]) {
  await signInAsOwner(page)

  // Complete setup wizard if redirected there on first visit
  if (page.url().includes('/setup')) {
    // SetupPage inputs — testids will be added when SetupPage is fully implemented
    await page.getByTestId('input-business-name').fill('Toko Katalog Test')
    await page.getByTestId('btn-setup-submit').click()
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
    await page.getByTestId('btn-tab-categories').click()
    await page.getByRole('heading', { name: /kategori produk/i }).waitFor()

    // ── Create ─────────────────────────────────────────────────────────────
    await page.getByTestId('btn-add-category').click()
    await page.getByTestId('input-category-name').fill('Minuman Segar')
    await page.getByTestId('btn-category-submit').click()

    // Category name should appear in the list
    await expect(page.locator('[data-testid^="category-name-"]').filter({ hasText: 'Minuman Segar' })).toBeVisible()

    // ── Rename ─────────────────────────────────────────────────────────────
    // Click Edit on the category row (the only edit button since just one category exists)
    await page.locator('[data-testid^="btn-edit-category-"]').click()
    await page.getByTestId('input-category-name').fill('Minuman Dingin')
    await page.getByTestId('btn-category-submit').click()

    await expect(page.locator('[data-testid^="category-name-"]').filter({ hasText: 'Minuman Dingin' })).toBeVisible()
    await expect(page.locator('[data-testid^="category-name-"]').filter({ hasText: 'Minuman Segar' })).toHaveCount(0)

    // ── Delete ─────────────────────────────────────────────────────────────
    await page.locator('[data-testid^="btn-delete-category-"]').click()
    await expect(page.locator('[data-testid^="category-name-"]').filter({ hasText: 'Minuman Dingin' })).toHaveCount(0)
  })
})

// ─── T022 — Products CRUD ─────────────────────────────────────────────────────

test.describe('Products CRUD (T022)', () => {
  test('owner can add a product and it appears in the catalog product list', async ({ page }) => {
    await signInToCatalog(page)

    // Ensure we are on the Products tab (default) — page-load wait
    await page.getByRole('heading', { name: 'Produk', exact: true }).waitFor()

    // First, create a category so the product form has something to pick from
    await page.getByTestId('btn-tab-categories').click()
    await page.getByRole('heading', { name: /kategori produk/i }).waitFor()
    await page.getByTestId('btn-add-category').click()
    await page.getByTestId('input-category-name').fill('Makanan')
    await page.getByTestId('btn-category-submit').click()
    await expect(page.locator('[data-testid^="category-name-"]').filter({ hasText: 'Makanan' })).toBeVisible()

    // Switch back to Products tab
    await page.getByTestId('btn-tab-products').click()
    await page.getByRole('heading', { name: 'Produk', exact: true }).waitFor()

    // Add a product
    await page.getByTestId('btn-add-product').click()
    await page.getByTestId('input-product-name').fill('Nasi Goreng Spesial')
    await page.getByTestId('select-product-category').selectOption({ label: 'Makanan' })
    await page.getByTestId('input-product-price').fill('15000')
    await page.getByTestId('input-product-stock').fill('50')
    await page.getByTestId('btn-product-submit').click()

    // Product name and price should appear in the product list
    await expect(page.locator('[data-testid^="product-name-"]').filter({ hasText: 'Nasi Goreng Spesial' })).toBeVisible()
    await expect(page.locator('[data-testid^="product-price-"]').filter({ hasText: 'Rp 15.000' })).toBeVisible()
  })

  test('owner can add a product and it appears in cashier product search', async ({ page }) => {
    // Seed a category so the product form has something to pick from
    await page.goto(`${BASE}/`)
    await page.evaluate(() => {
      window.localStorage.setItem(
        'mock_Categories',
        JSON.stringify([{ id: 'cat-search', name: 'Makanan', created_at: new Date().toISOString(), deleted_at: null }]),
      )
    })

    await signInToCatalog(page)

    // Add product via catalog form
    await page.getByTestId('btn-add-product').click()
    await page.getByTestId('input-product-name').fill('Mie Goreng')
    await page.getByTestId('select-product-category').selectOption({ label: 'Makanan' })
    await page.getByTestId('input-product-price').fill('12000')
    await page.getByTestId('input-product-stock').fill('20')
    await page.getByTestId('btn-product-submit').click()
    await expect(page.locator('[data-testid^="product-name-"]').filter({ hasText: 'Mie Goreng' })).toBeVisible()

    // Navigate to cashier and search for the product
    await navigateTo(page, `${BASE}/cashier`)
    await page.getByRole('heading', { name: /kasir/i }).waitFor()
    await page.getByTestId('product-search-input').fill('Mie Goreng')
    // Product ID is a generated UUID — use CSS prefix selector scoped to the product grid
    await expect(page.locator('[data-testid^="product-card-"]').filter({ hasText: 'Mie Goreng' })).toBeVisible()
  })

  test('completing a sale decrements product stock by correct quantity', async ({ page }) => {
    // Seed a product with known stock and known ID in localStorage
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
    await page.getByRole('heading', { name: /kasir/i }).waitFor()

    // Add product to cart using known testid
    await page.getByTestId('product-search-input').fill('Produk Stok Test')
    await page.getByTestId('product-card-prod-stock-test').click()

    // Complete QRIS payment
    await page.getByTestId('btn-pay').click()
    await page.getByTestId('btn-method-qris').click()
    await page.getByTestId('btn-qris-confirm').click()
    await expect(page.getByTestId('receipt-success')).toBeVisible()
    await page.getByTestId('btn-receipt-close').click()

    // Navigate to catalog and verify stock decremented from 20 to 19
    await navigateTo(page, `${BASE}/catalog`)
    await page.getByTestId('btn-tab-products').click()
    await expect(page.getByTestId('product-stock-prod-stock-test')).toHaveText('Stok: 19')
  })
})
