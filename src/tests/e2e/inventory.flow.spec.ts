/**
 * E2E specs for Phase 3 — Product Catalog: categories, products, variants, CSV import.
 *
 * All tests run with VITE_ADAPTER=mock (default in dev). MockAuthAdapter returns
 * the preset owner user (role: owner) so /catalog is accessible without a real
 * Google account.
 */
import { test, expect } from '@playwright/test'
import { signInAsOwner, navigateTo } from './helpers/auth'

const BASE = ''

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
  await page.getByTestId('btn-tab-products').waitFor()
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
    await page.getByTestId('product-search-input').waitFor()
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
    await page.getByTestId('product-search-input').waitFor()

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

// ─── T034 — Stock Opname ──────────────────────────────────────────────────────

test.describe('Stock Opname (T034)', () => {
  test('owner can run stock opname and discrepancies are logged', async ({ page }) => {
    const prodId = 'opname-prod-1'

    // Seed a product with known stock into localStorage
    await page.goto(`${BASE}/`)
    await page.evaluate((id) => {
      const now = new Date().toISOString()
      window.localStorage.setItem(
        'mock_Products',
        JSON.stringify([
          {
            id,
            category_id: 'cat-1',
            name: 'Produk Opname',
            sku: 'OPNAME-01',
            price: 10000,
            stock: 50,
            has_variants: false,
            created_at: now,
            deleted_at: null,
          },
        ]),
      )
    }, prodId)

    await signInAsOwner(page)

    // Handle setup wizard if redirected
    if (page.url().includes('/setup')) {
      await page.getByTestId('input-business-name').fill('Toko Opname Test')
      await page.getByTestId('btn-setup-submit').click()
      await page.waitForURL(/\/cashier/)
    }

    // Navigate to /inventory
    await navigateTo(page, `${BASE}/inventory`)
    await page.getByTestId('btn-tab-opname').waitFor()

    // Stock Opname tab should be active by default
    await expect(page.getByTestId('stock-opname-container')).toBeVisible()

    // Verify system stock is 50
    await expect(page.getByTestId(`opname-system-stock-${prodId}`)).toHaveText('50')

    // Enter physical count of 45 (discrepancy of -5)
    await page.getByTestId(`opname-physical-input-${prodId}`).fill('45')

    // Verify diff shows -5
    await expect(page.getByTestId(`opname-diff-${prodId}`)).toHaveText('-5')

    // Save opname
    await page.getByTestId('btn-save-opname').click()

    // Success message should confirm the update
    await expect(page.getByTestId('opname-success')).toBeVisible()

    // After reload, system stock should now be 45
    await expect(page.getByTestId(`opname-system-stock-${prodId}`)).toHaveText('45')

    // Stock_Log should have the entry (verify via localStorage)
    const stockLog = await page.evaluate(() => {
      const raw = window.localStorage.getItem('mock_Stock_Log')
      return raw ? JSON.parse(raw) : []
    })
    expect(stockLog.length).toBeGreaterThan(0)
    const logEntry = stockLog.find(
      (e: Record<string, unknown>) =>
        e['product_id'] === prodId && e['reason'] === 'opname',
    )
    expect(logEntry).toBeTruthy()
    expect(logEntry['qty_before']).toBe(50)
    expect(logEntry['qty_after']).toBe(45)
  })
})

// ─── T035 — Purchase Orders ───────────────────────────────────────────────────

test.describe('Purchase Orders (T035)', () => {
  test('owner can create a purchase order and mark it as received, increasing stock', async ({ page }) => {
    const prodId = 'po-prod-1'

    // Seed a product with known stock
    await page.goto(`${BASE}/`)
    await page.evaluate((id) => {
      const now = new Date().toISOString()
      window.localStorage.setItem(
        'mock_Products',
        JSON.stringify([
          {
            id,
            category_id: 'cat-1',
            name: 'Produk PO',
            sku: 'PO-01',
            price: 10000,
            stock: 20,
            has_variants: false,
            created_at: now,
            deleted_at: null,
          },
        ]),
      )
    }, prodId)

    await signInAsOwner(page)

    // Handle setup wizard if redirected
    if (page.url().includes('/setup')) {
      await page.getByTestId('input-business-name').fill('Toko PO Test')
      await page.getByTestId('btn-setup-submit').click()
      await page.waitForURL(/\/cashier/)
    }

    // Navigate to /inventory → Purchase Order tab
    await navigateTo(page, `${BASE}/inventory`)
    await page.getByTestId('btn-tab-opname').waitFor()
    await page.getByTestId('btn-tab-purchase-orders').click()
    await expect(page.getByTestId('purchase-orders-container')).toBeVisible()

    // Create a new PO
    await page.getByTestId('btn-create-po').click()
    await expect(page.getByTestId('po-form')).toBeVisible()

    // Fill in supplier name
    await page.getByTestId('input-po-supplier').fill('Supplier Test ABC')

    // Select product in first item row
    await page.getByTestId('select-po-product-0').selectOption({ value: prodId })

    // Set qty = 30
    await page.getByTestId('input-po-qty-0').fill('30')

    // Set cost price
    await page.getByTestId('input-po-cost-0').fill('8000')

    // Submit the PO
    await page.getByTestId('btn-submit-po').click()

    // PO should appear in list with "Pending" status
    await expect(page.getByTestId('po-empty')).not.toBeVisible()

    // Find the created PO row and verify supplier name
    const poRow = page.locator('[data-testid^="po-row-"]')
    await expect(poRow).toBeVisible()

    const poId = await poRow.getAttribute('data-testid').then((id) => id?.replace('po-row-', '') ?? '')
    await expect(page.getByTestId(`po-supplier-${poId}`)).toHaveText('Supplier Test ABC')
    await expect(page.getByTestId(`po-status-${poId}`)).toHaveText('Pending')

    // Receive the PO
    await page.getByTestId(`btn-receive-po-${poId}`).click()

    // Status should now be "Diterima"
    await expect(page.getByTestId(`po-status-${poId}`)).toHaveText('Diterima')

    // Stock for prodId should now be 20 + 30 = 50
    const products = await page.evaluate(() => {
      const raw = window.localStorage.getItem('mock_Products')
      return raw ? JSON.parse(raw) : []
    })
    const updatedProd = products.find((p: Record<string, unknown>) => p['id'] === prodId)
    expect(updatedProd?.['stock']).toBe(50)

    // Stock_Log should have a "purchase_order" entry
    const stockLog = await page.evaluate(() => {
      const raw = window.localStorage.getItem('mock_Stock_Log')
      return raw ? JSON.parse(raw) : []
    })
    const logEntry = stockLog.find(
      (e: Record<string, unknown>) =>
        e['product_id'] === prodId && e['reason'] === 'purchase_order',
    )
    expect(logEntry).toBeTruthy()
    expect(logEntry['qty_before']).toBe(20)
    expect(logEntry['qty_after']).toBe(50)
  })
})

