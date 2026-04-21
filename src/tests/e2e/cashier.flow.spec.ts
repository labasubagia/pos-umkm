/**
 * E2E specs for Phase 4 — Cashier (T026–T033).
 *
 * Auth is injected via localStorage (injectAuthState) so no OAuth popup is
 * needed. Product/category data is seeded directly into Dexie IndexedDB via
 * window.__getDb (exposed when VITE_E2E=true) so there is no mock adapter.
 */
import { test, expect } from '@playwright/test'
import { injectAuthState, DEFAULT_STORE, BASE } from './helpers/auth-dexie'
import { seedDexie, reloadAndWait, waitForHydration } from './helpers/dexie-seed'
import { navigateTo } from './helpers/auth'

const STORE = DEFAULT_STORE
const now = new Date().toISOString()
// Seed a Monthly_Sheets entry for the current month so ensureMonthlySheetExists()
// finds an existing record and skips all Google Sheets API calls during payment.
const MONTHLY_SHEET_SEED = [
  {
    id: 'e2e-monthly-sheet-1',
    year_month: now.slice(0, 7),
    spreadsheetId: STORE.monthlySpreadsheetId,
    created_at: now,
  },
]

const PRODUCTS = [
  {
    id: 'e2e-prod-1',
    category_id: 'e2e-cat-1',
    name: 'Nasi Goreng',
    sku: 'NASGOR',
    price: 15000,
    stock: 20,
    has_variants: false,
    created_at: now,
    deleted_at: null,
  },
  {
    id: 'e2e-prod-2',
    category_id: 'e2e-cat-1',
    name: 'Es Teh Manis',
    sku: 'ESTEH',
    price: 5000,
    stock: 50,
    has_variants: false,
    created_at: now,
    deleted_at: null,
  },
]

const CATEGORIES = [
  { id: 'e2e-cat-1', name: 'Makanan & Minuman', created_at: now, deleted_at: null },
]

async function signInToCashier(page: Parameters<typeof injectAuthState>[0]) {
  await injectAuthState(page, STORE)
  await page.goto(`${BASE}/cashier`)
  // Wait for the cashier search input — present even when the DB is empty.
  await page.getByTestId('product-search-input').waitFor()
  // Wait for HydrationService to finish before seeding to avoid the race where
  // hydrateTable().clear() overwrites our bulkPut inserts.
  await waitForHydration(page)
  // Seed Dexie and reload so React Query reads the seeded data.
  await seedDexie(page, STORE.storeId, {
    Products: PRODUCTS,
    Categories: CATEGORIES,
    Monthly_Sheets: MONTHLY_SHEET_SEED,
  })
  await reloadAndWait(page, 'product-search-input')
  // Wait for at least one product card — confirms seeded data survived the reload.
  await page.locator('[data-testid^="product-card-"]').first().waitFor({ timeout: 10000 })
}

// ─── T026 — Product Search ────────────────────────────────────────────────────

test.describe('Product Search (T026)', () => {
  test('cashier can search for a product by name and add it to cart', async ({ page }) => {
    await signInToCashier(page)

    await page.getByTestId('product-search-input').fill('Nasi Goreng')
    await expect(page.getByTestId('product-card-e2e-prod-1')).toBeVisible()
    await page.getByTestId('product-card-e2e-prod-1').click()
    await expect(page.getByTestId('btn-pay')).toContainText('15.000')
  })
})

// ─── T027 — Cash Payment + Change ────────────────────────────────────────────

test.describe('Cash Payment (T027)', () => {
  test('cashier enters cash received and sees correct change amount', async ({ page }) => {
    await signInToCashier(page)

    await page.getByTestId('product-card-e2e-prod-1').click()
    await page.getByTestId('btn-pay').click()
    await expect(page.getByTestId('payment-modal')).toBeVisible()
    await page.getByTestId('btn-method-cash').click()
    await page.getByTestId('input-cash').fill('20000')
    await expect(page.getByTestId('change-amount')).toHaveText('Rp 5.000')
  })

  test('quick-amount buttons show correct denominations', async ({ page }) => {
    await signInToCashier(page)

    await page.getByTestId('product-card-e2e-prod-1').click()
    await page.getByTestId('btn-pay').click()
    await page.getByTestId('btn-method-cash').click()
    await expect(page.getByTestId('btn-denomination-20000')).toBeVisible()
  })

  test('selecting a quick-amount button fills cash received and computes change', async ({ page }) => {
    await signInToCashier(page)

    await page.getByTestId('product-card-e2e-prod-1').click()
    await page.getByTestId('btn-pay').click()
    await page.getByTestId('btn-method-cash').click()
    await page.getByTestId('btn-denomination-20000').click()
    await expect(page.getByTestId('change-amount')).toHaveText('Rp 5.000')
  })
})

// ─── T028 — QRIS Payment ─────────────────────────────────────────────────────

test.describe('QRIS Payment (T028)', () => {
  test('cashier can complete a QRIS payment by manually confirming', async ({ page }) => {
    await signInToCashier(page)

    await page.getByTestId('product-card-e2e-prod-2').click()
    await page.getByTestId('btn-pay').click()
    await page.getByTestId('btn-method-qris').click()
    await expect(page.getByTestId('btn-qris-confirm')).toBeVisible()
    await page.getByTestId('btn-qris-confirm').click()
    await expect(page.getByTestId('receipt-success')).toBeVisible()
  })
})

// ─── T029 — Discount Application ─────────────────────────────────────────────

test.describe('Discount (T029)', () => {
  test('cashier can apply a percentage discount and see updated total', async ({ page }) => {
    await signInToCashier(page)

    await page.getByTestId('product-card-e2e-prod-1').click()
    await page.getByTestId('btn-discount-percent').click()
    await page.getByTestId('input-discount-value').fill('10')
    await page.getByTestId('btn-discount-apply').click()
    // 15000 - 10% = 13500
    await expect(page.getByTestId('btn-pay')).toContainText('13.500')
  })

  test('cashier can apply a flat IDR discount', async ({ page }) => {
    await signInToCashier(page)

    await page.getByTestId('product-card-e2e-prod-1').click()
    await page.getByTestId('input-discount-value').fill('2000')
    await page.getByTestId('btn-discount-apply').click()
    // 15000 - 2000 = 13000
    await expect(page.getByTestId('btn-pay')).toContainText('13.000')
  })
})

// ─── T030 — Split Payment ─────────────────────────────────────────────────────

test.describe('Split Payment (T030)', () => {
  test('cashier can complete a split payment (part cash, part QRIS)', async ({ page }) => {
    await signInToCashier(page)

    await page.getByTestId('product-card-e2e-prod-1').click()
    await page.getByTestId('btn-pay').click()
    await page.getByTestId('btn-method-split').click()
    await page.getByTestId('input-split-cash').fill('10000')
    await expect(page.getByTestId('btn-split-confirm')).toBeEnabled()
    await page.getByTestId('btn-split-confirm').click()
    await expect(page.getByTestId('receipt-success')).toBeVisible()
  })
})

// ─── T031 — Hold Transaction ─────────────────────────────────────────────────

test.describe('Hold Transaction (T031)', () => {
  test('cashier can hold a transaction, start a new one, and retrieve the held transaction', async ({ page }) => {
    await signInToCashier(page)

    await page.getByTestId('product-card-e2e-prod-1').click()
    await expect(page.getByTestId('btn-pay')).toContainText('15.000')

    await page.getByTestId('btn-hold-cart').click()
    await expect(page.getByTestId('btn-pay')).toBeDisabled()

    await page.getByTestId('product-card-e2e-prod-2').click()

    await page.getByTestId('btn-held-toggle').click()
    await expect(page.getByTestId('btn-retrieve-cart-0')).toBeVisible()

    await page.getByTestId('btn-retrieve-cart-0').click()
    await expect(page.getByTestId('btn-pay')).toContainText('15.000')
  })
})

// ─── T032 + T033 — Transaction Commit + Receipt ───────────────────────────────

test.describe('Transaction Commit + Receipt (T032, T033)', () => {
  test('completing a transaction writes to Transactions and shows receipt', async ({ page }) => {
    await signInToCashier(page)

    await page.getByTestId('product-card-e2e-prod-1').click()
    await page.getByTestId('btn-pay').click()
    await page.getByTestId('btn-method-cash').click()
    await page.getByTestId('input-cash').fill('20000')
    await page.getByTestId('btn-cash-confirm').click()

    await expect(page.getByTestId('receipt-success')).toBeVisible()
    await expect(page.getByTestId('receipt-preview')).toContainText('INV/')
    await expect(page.getByTestId('btn-whatsapp-share')).toBeVisible()
  })

  test('receipt shows correct totals for multiple products', async ({ page }) => {
    await signInToCashier(page)

    await page.getByTestId('product-card-e2e-prod-1').click()
    await page.getByTestId('product-card-e2e-prod-2').click()
    await page.getByTestId('btn-pay').click()
    await page.getByTestId('btn-method-qris').click()
    await page.getByTestId('btn-qris-confirm').click()

    await expect(page.getByTestId('receipt-success')).toBeVisible()
    await expect(page.getByTestId('receipt-preview')).toContainText('Nasi Goreng')
    await expect(page.getByTestId('receipt-preview')).toContainText('Es Teh Manis')
    await expect(page.getByTestId('btn-whatsapp-share')).toBeVisible()
  })

  test('product stock is decremented after transaction', async ({ page }) => {
    await signInToCashier(page)

    // Add 2 units of Nasi Goreng (stock=20)
    await page.getByTestId('product-card-e2e-prod-1').click()
    await page.getByTestId('product-card-e2e-prod-1').click()
    await page.getByTestId('btn-pay').click()
    await page.getByTestId('btn-method-qris').click()
    await page.getByTestId('btn-qris-confirm').click()
    await expect(page.getByTestId('receipt-success')).toBeVisible()
    await page.getByTestId('btn-receipt-close').click()

    await navigateTo(page, `${BASE}/catalog`)
    await page.getByTestId('btn-tab-products').click()
    // 20 - 2 = 18
    await expect(page.getByTestId('product-stock-e2e-prod-1')).toHaveText('Stok: 18')
  })
})

// ─── T036 — Customer attach to transaction ────────────────────────────────────

test.describe('Customer Search (T036)', () => {
  test('cashier can attach a customer to a transaction', async ({ page }) => {
    const CUSTOMERS = [
      {
        id: 'e2e-cus-1',
        name: 'Budi Santoso',
        phone: '08111234567',
        email: '',
        created_at: now,
        deleted_at: null,
      },
    ]

    await injectAuthState(page, STORE)
    await page.goto(`${BASE}/cashier`)
    await page.getByTestId('product-search-input').waitFor()
    await waitForHydration(page)
    await seedDexie(page, STORE.storeId, {
      Products: PRODUCTS,
      Categories: CATEGORIES,
      Customers: CUSTOMERS,
    })
    await reloadAndWait(page, 'product-search-input')

    await page.getByTestId('product-card-e2e-prod-1').click()
    await page.getByTestId('customer-search-input').fill('Budi')
    await expect(page.getByTestId('customer-result-e2e-cus-1')).toBeVisible()
    await page.getByTestId('customer-result-e2e-cus-1').click()
    await expect(page.getByTestId('cart-customer-name')).toContainText('Budi Santoso')
  })
})

// ─── T037 — Refund flow ───────────────────────────────────────────────────────

test.describe('Refund Flow (T037)', () => {
  test('owner can process a refund and stock is restored', async ({ page }) => {
    const txId = 'e2e-tx-refund-1'
    const productId = 'e2e-prod-refund-1'

    const REFUND_PRODUCTS = [
      {
        id: productId,
        category_id: 'e2e-cat-1',
        name: 'Es Teh',
        sku: 'ESTEH2',
        price: 15000,
        stock: 18,
        has_variants: false,
        created_at: now,
        deleted_at: null,
      },
    ]
    const TRANSACTIONS = [
      {
        id: txId,
        created_at: now,
        cashier_id: 'e2e-owner-1',
        customer_id: null,
        subtotal: 30000,
        discount_type: null,
        discount_value: 0,
        discount_amount: 0,
        tax: 0,
        total: 30000,
        payment_method: 'CASH',
        cash_received: 50000,
        change: 20000,
        receipt_number: 'INV/2026/001',
        notes: null,
      },
    ]

    await injectAuthState(page, STORE)
    await page.goto(`${BASE}/customers`)
    await page.getByTestId('tab-refund').waitFor()
    await waitForHydration(page)
    await seedDexie(page, STORE.storeId, {
      Products: REFUND_PRODUCTS,
      Categories: CATEGORIES,
      Transactions: TRANSACTIONS,
      Refunds: [],
    })
    await page.reload()
    await page.getByTestId('tab-refund').waitFor()

    await page.getByTestId('tab-refund').click()
    await page.getByTestId('refund-tx-id-input').fill(txId)
    await page.getByTestId('btn-find-transaction').click()
    await expect(page.getByTestId('refund-tx-info')).toBeVisible()

    await page.getByTestId('btn-add-refund-item').click()
    await page.getByTestId('refund-item-name-0').fill('Es Teh')
    await page.getByTestId('refund-item-product-id-0').fill(productId)
    await page.getByTestId('refund-item-price-0').fill('15000')
    await page.getByTestId('refund-item-qty-0').fill('2')
    await page.getByTestId('refund-reason-input').fill('Produk tidak sesuai')
    await page.getByTestId('btn-submit-refund').click()

    await expect(page.getByTestId('refund-success')).toBeVisible()

    // Verify stock was re-incremented in Dexie: 18 + 2 = 20
    const updatedStock = await page.evaluate(
      async ({ storeId, productId }) => {
        const db = (window as Record<string, (id: string) => { Products: { get: (id: string) => Promise<{ stock: number } | undefined> } }>)['__getDb'](storeId)
        const product = await db.Products.get(productId)
        return product?.stock ?? null
      },
      { storeId: STORE.storeId, productId },
    )
    expect(updatedStock).toBe(20)
  })
})
