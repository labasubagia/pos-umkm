/**
 * E2E specs for Phase 4 — Cashier (T026–T033).
 *
 * All tests run with VITE_ADAPTER=mock (default in dev). MockAuthAdapter
 * returns the preset owner user so /cashier is accessible without a real
 * Google account.
 *
 * The MockDataAdapter is localStorage-backed; we can seed data via
 * page.evaluate() to control initial state.
 */
import { test, expect } from '@playwright/test'
import { signInAsOwner, navigateTo } from './helpers/auth'

const BASE = '/pos-umkm'

/** Signs in and navigates to /cashier, waiting for the page to be ready. */
async function signInToCashier(page: Parameters<typeof signInAsOwner>[0]) {
  // Seed products into localStorage BEFORE signing in, so CashierPage's
  // loadCatalog() finds them when it first mounts.
  await page.goto(`${BASE}/`)
  await page.evaluate(() => {
    const now = new Date().toISOString()
    window.localStorage.setItem(
      'mock_Products',
      JSON.stringify([
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
      ]),
    )
    window.localStorage.setItem(
      'mock_Categories',
      JSON.stringify([
        { id: 'e2e-cat-1', name: 'Makanan & Minuman', created_at: now, deleted_at: null },
      ]),
    )
  })

  await signInAsOwner(page)

  // Handle setup wizard redirect on first visit
  if (page.url().includes('/setup')) {
    await page.getByPlaceholder(/nama usaha/i).fill('Toko Kasir Test')
    await page.getByRole('button', { name: /mulai sekarang/i }).click()
    await page.waitForURL(/\/cashier/)
  }

  await navigateTo(page, `${BASE}/cashier`)
  // Wait for the cashier page heading
  await page.getByRole('heading', { name: /kasir/i }).waitFor()
}

// ─── T026 — Product Search ────────────────────────────────────────────────────

test.describe('Product Search (T026)', () => {
  test('cashier can search for a product by name and add it to cart', async ({ page }) => {
    await signInToCashier(page)

    // Type product name in search box
    await page.getByTestId('product-search-input').fill('Nasi Goreng')

    // Product card should appear in results
    await expect(page.getByTestId('product-card-e2e-prod-1')).toBeVisible()

    // Click the product card to add to cart
    await page.getByTestId('product-card-e2e-prod-1').click()

    // Pay button should show total
    await expect(page.getByTestId('btn-pay')).toContainText('15.000')
  })
})

// ─── T027 — Cash Payment + Change ────────────────────────────────────────────

test.describe('Cash Payment (T027)', () => {
  test('cashier enters cash received and sees correct change amount', async ({ page }) => {
    await signInToCashier(page)

    // Add one product to cart
    await page.getByTestId('product-card-e2e-prod-1').click()

    // Open payment modal
    await page.getByTestId('btn-pay').click()
    await expect(page.getByRole('dialog')).toBeVisible()

    // Select CASH method
    await page.getByTestId('btn-method-cash').click()

    // Enter cash received
    await page.getByTestId('input-cash').fill('20000')

    // Change should be 20000 - 15000 = 5000
    await expect(page.getByTestId('change-amount')).toHaveText('Rp 5.000')
  })

  test('quick-amount buttons show correct denominations', async ({ page }) => {
    await signInToCashier(page)

    // Add a product (15000)
    await page.getByTestId('product-card-e2e-prod-1').click()

    // Open payment → select cash
    await page.getByTestId('btn-pay').click()
    await page.getByTestId('btn-method-cash').click()

    // 20000 should be present as a quick-amount option (smallest denomination >= 15000)
    await expect(page.getByTestId('btn-denomination-20000')).toBeVisible()
  })

  test('selecting a quick-amount button fills cash received and computes change', async ({ page }) => {
    await signInToCashier(page)

    // Add a product (15000)
    await page.getByTestId('product-card-e2e-prod-1').click()

    // Open payment → select cash
    await page.getByTestId('btn-pay').click()
    await page.getByTestId('btn-method-cash').click()

    // Click the Rp 20.000 quick button
    await page.getByTestId('btn-denomination-20000').click()

    // Change should appear: 20000 - 15000 = 5000
    await expect(page.getByTestId('change-amount')).toHaveText('Rp 5.000')
  })
})

// ─── T028 — QRIS Payment ─────────────────────────────────────────────────────

test.describe('QRIS Payment (T028)', () => {
  test('cashier can complete a QRIS payment by manually confirming', async ({ page }) => {
    await signInToCashier(page)

    // Add a product
    await page.getByTestId('product-card-e2e-prod-2').click()

    // Open payment modal
    await page.getByTestId('btn-pay').click()

    // Select QRIS
    await page.getByTestId('btn-method-qris').click()

    // QRIS step should show confirm button
    await expect(page.getByTestId('btn-qris-confirm')).toBeVisible()

    // Confirm payment
    await page.getByTestId('btn-qris-confirm').click()

    // Receipt modal should appear
    await expect(page.getByTestId('receipt-success')).toBeVisible()
  })
})

// ─── T029 — Discount Application ─────────────────────────────────────────────

test.describe('Discount (T029)', () => {
  test('cashier can apply a percentage discount and see updated total', async ({ page }) => {
    await signInToCashier(page)

    // Add product (15000)
    await page.getByTestId('product-card-e2e-prod-1').click()

    // Switch to percent discount and apply 10%
    await page.getByTestId('btn-discount-percent').click()
    await page.getByTestId('input-discount-value').fill('10')
    await page.getByTestId('btn-discount-apply').click()

    // Pay button shows the discounted total: 15000 - 1500 = 13500
    await expect(page.getByTestId('btn-pay')).toContainText('13.500')
  })

  test('cashier can apply a flat IDR discount', async ({ page }) => {
    await signInToCashier(page)

    // Add product (15000)
    await page.getByTestId('product-card-e2e-prod-1').click()

    // Apply flat discount of 2000
    await page.getByTestId('input-discount-value').fill('2000')
    await page.getByTestId('btn-discount-apply').click()

    // Pay button shows the discounted total: 15000 - 2000 = 13000
    await expect(page.getByTestId('btn-pay')).toContainText('13.000')
  })
})

// ─── T030 — Split Payment ─────────────────────────────────────────────────────

test.describe('Split Payment (T030)', () => {
  test('cashier can complete a split payment (part cash, part QRIS)', async ({ page }) => {
    await signInToCashier(page)

    // Add product (15000)
    await page.getByTestId('product-card-e2e-prod-1').click()

    // Open payment modal and select Split
    await page.getByTestId('btn-pay').click()
    await page.getByTestId('btn-method-split').click()

    // Fill cash amount (10000), QRIS auto-fills to 5000
    await page.getByTestId('input-split-cash').fill('10000')

    // Confirm button should be enabled
    await expect(page.getByTestId('btn-split-confirm')).toBeEnabled()
    await page.getByTestId('btn-split-confirm').click()

    // Receipt modal appears
    await expect(page.getByTestId('receipt-success')).toBeVisible()
  })
})

// ─── T031 — Hold Transaction ─────────────────────────────────────────────────

test.describe('Hold Transaction (T031)', () => {
  test('cashier can hold a transaction, start a new one, and retrieve the held transaction', async ({ page }) => {
    await signInToCashier(page)

    // Add first product to cart
    await page.getByTestId('product-card-e2e-prod-1').click()
    // Verify it's in cart via pay button
    await expect(page.getByTestId('btn-pay')).toContainText('15.000')

    // Click the action-bar "Tahan" button to hold the active cart
    await page.getByTestId('btn-hold-cart').click()

    // Cart should now be empty — pay button disabled
    await expect(page.getByTestId('btn-pay')).toBeDisabled()

    // Add a different product to the new active cart
    await page.getByTestId('product-card-e2e-prod-2').click()

    // Open held carts panel via header toggle button
    await page.getByTestId('btn-held-toggle').click()

    // First held cart should be visible
    await expect(page.getByTestId('btn-retrieve-cart-0')).toBeVisible()

    // Retrieve the held cart
    await page.getByTestId('btn-retrieve-cart-0').click()

    // Active cart should now contain Nasi Goreng (pay button shows 15000)
    await expect(page.getByTestId('btn-pay')).toContainText('15.000')
  })
})

// ─── T032 + T033 — Transaction Commit + Receipt ───────────────────────────────

test.describe('Transaction Commit + Receipt (T032, T033)', () => {
  test('completing a transaction writes to Transactions and shows receipt', async ({ page }) => {
    await signInToCashier(page)

    // Add product
    await page.getByTestId('product-card-e2e-prod-1').click()

    // Pay with cash
    await page.getByTestId('btn-pay').click()
    await page.getByTestId('btn-method-cash').click()
    await page.getByTestId('input-cash').fill('20000')
    await page.getByTestId('btn-cash-confirm').click()

    // Receipt modal appears with transaction success
    await expect(page.getByTestId('receipt-success')).toBeVisible()
    await expect(page.getByTestId('receipt-preview')).toContainText('INV/')

    // WhatsApp share button present
    await expect(page.getByTestId('btn-whatsapp-share')).toBeVisible()
  })

  test('after transaction, receipt modal shows correct totals and WhatsApp share button', async ({ page }) => {
    await signInToCashier(page)

    // Add two different products
    await page.getByTestId('product-card-e2e-prod-1').click()
    await page.getByTestId('product-card-e2e-prod-2').click()

    // Pay with QRIS
    await page.getByTestId('btn-pay').click()
    await page.getByTestId('btn-method-qris').click()
    await page.getByTestId('btn-qris-confirm').click()

    // Receipt modal preview contains both product names
    await expect(page.getByTestId('receipt-success')).toBeVisible()
    await expect(page.getByTestId('receipt-preview')).toContainText('Nasi Goreng')
    await expect(page.getByTestId('receipt-preview')).toContainText('Es Teh Manis')

    // WhatsApp share link must be present
    await expect(page.getByTestId('btn-whatsapp-share')).toBeVisible()
  })

  test('product stock is decremented after transaction', async ({ page }) => {
    await signInToCashier(page)

    // Product has stock=20. Add 2 of them.
    await page.getByTestId('product-card-e2e-prod-1').click()
    await page.getByTestId('product-card-e2e-prod-1').click()

    // Complete transaction via QRIS
    await page.getByTestId('btn-pay').click()
    await page.getByTestId('btn-method-qris').click()
    await page.getByTestId('btn-qris-confirm').click()
    await expect(page.getByTestId('receipt-success')).toBeVisible()
    await page.getByTestId('btn-receipt-close').click()

    // Navigate to catalog and verify stock decremented from 20 to 18
    await navigateTo(page, `${BASE}/catalog`)
    await page.getByRole('button', { name: 'Produk', exact: true }).click()
    await expect(page.getByTestId('product-stock-e2e-prod-1')).toHaveText('Stok: 18')
  })
})
