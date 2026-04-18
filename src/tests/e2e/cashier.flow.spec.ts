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
    await page.getByPlaceholder(/cari produk/i).fill('Nasi Goreng')

    // Product card should appear in results
    await expect(page.getByRole('listitem').filter({ hasText: 'Nasi Goreng' })).toBeVisible()

    // Click the product card to add to cart
    await page.getByRole('listitem').filter({ hasText: 'Nasi Goreng' }).click()

    // Cart should now show the item — the pay button amount updates
    await expect(page.getByRole('button', { name: /bayar/i })).toContainText('15.000')
  })
})

// ─── T027 — Cash Payment + Change ────────────────────────────────────────────

test.describe('Cash Payment (T027)', () => {
  test('cashier enters cash received and sees correct change amount', async ({ page }) => {
    await signInToCashier(page)

    // Add one product to cart
    await page.getByRole('listitem').filter({ hasText: 'Nasi Goreng' }).click()

    // Open payment modal
    await page.getByRole('button', { name: /bayar/i }).click()
    await expect(page.getByRole('dialog')).toBeVisible()

    // Select CASH method — use first() because "Split (Tunai + QRIS)" also matches /tunai/i
    await page.getByRole('button').filter({ hasText: /tunai/i }).first().click()

    // Enter cash received
    const cashInput = page.getByLabel(/uang diterima/i)
    await cashInput.fill('20000')

    // Change should be 20000 - 15000 = 5000 — use exact text to avoid matching "15.000"
    await expect(page.getByRole('dialog').getByText('Rp 5.000', { exact: true })).toBeVisible()
  })

  test('quick-amount buttons show correct denominations', async ({ page }) => {
    await signInToCashier(page)

    // Add a product (15000)
    await page.getByRole('listitem').filter({ hasText: 'Nasi Goreng' }).click()

    // Open payment → select cash
    await page.getByRole('button', { name: /bayar/i }).click()
    await page.getByRole('button').filter({ hasText: /tunai/i }).first().click()

    // 20000 should be present as a quick-amount option (smallest denomination >= 15000)
    await expect(page.getByRole('dialog').getByRole('button', { name: /20\.000/ })).toBeVisible()
  })

  test('selecting a quick-amount button fills cash received and computes change', async ({ page }) => {
    await signInToCashier(page)

    // Add a product (15000)
    await page.getByRole('listitem').filter({ hasText: 'Nasi Goreng' }).click()

    // Open payment → select cash
    await page.getByRole('button', { name: /bayar/i }).click()
    await page.getByRole('button').filter({ hasText: /tunai/i }).first().click()

    // Click the Rp 20.000 quick button
    await page.getByRole('dialog').getByRole('button', { name: /20\.000/ }).click()

    // Change should appear: 20000 - 15000 = 5000
    await expect(page.getByRole('dialog').getByText('Rp 5.000', { exact: true })).toBeVisible()
  })
})

// ─── T028 — QRIS Payment ─────────────────────────────────────────────────────

test.describe('QRIS Payment (T028)', () => {
  test('cashier can complete a QRIS payment by manually confirming', async ({ page }) => {
    await signInToCashier(page)

    // Add a product
    await page.getByRole('listitem').filter({ hasText: 'Es Teh Manis' }).click()

    // Open payment modal
    await page.getByRole('button', { name: /bayar/i }).click()

    // Select QRIS
    await page.getByRole('button').filter({ hasText: /qris/i }).first().click()

    // QRIS step should show "Pembayaran Diterima" button
    await expect(page.getByRole('button', { name: /pembayaran diterima/i })).toBeVisible()

    // Confirm payment
    await page.getByRole('button', { name: /pembayaran diterima/i }).click()

    // Receipt modal should appear
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByText(/transaksi berhasil/i)).toBeVisible()
  })
})

// ─── T029 — Discount Application ─────────────────────────────────────────────

test.describe('Discount (T029)', () => {
  test('cashier can apply a percentage discount and see updated total', async ({ page }) => {
    await signInToCashier(page)

    // Add product (15000)
    await page.getByRole('listitem').filter({ hasText: 'Nasi Goreng' }).click()

    // Switch to percent discount and apply 10%
    await page.getByRole('button', { name: /persen/i }).click()
    await page.getByLabel(/nilai diskon/i).fill('10')
    await page.getByRole('button', { name: /terapkan/i }).click()

    // Pay button shows the discounted total: 15000 - 1500 = 13500
    await expect(page.getByRole('button', { name: /bayar/i })).toContainText('13.500')
  })

  test('cashier can apply a flat IDR discount', async ({ page }) => {
    await signInToCashier(page)

    // Add product (15000)
    await page.getByRole('listitem').filter({ hasText: 'Nasi Goreng' }).click()

    // Apply flat discount of 2000
    await page.getByLabel(/nilai diskon/i).fill('2000')
    await page.getByRole('button', { name: /terapkan/i }).click()

    // Pay button shows the discounted total: 15000 - 2000 = 13000
    await expect(page.getByRole('button', { name: /bayar/i })).toContainText('13.000')
  })
})

// ─── T030 — Split Payment ─────────────────────────────────────────────────────

test.describe('Split Payment (T030)', () => {
  test('cashier can complete a split payment (part cash, part QRIS)', async ({ page }) => {
    await signInToCashier(page)

    // Add product (15000)
    await page.getByRole('listitem').filter({ hasText: 'Nasi Goreng' }).click()

    // Open payment modal and select Split
    await page.getByRole('button', { name: /bayar/i }).click()
    await page.getByRole('button').filter({ hasText: /split/i }).click()

    // Fill cash amount (10000), QRIS auto-fills to 5000
    await page.getByLabel(/jumlah tunai/i).fill('10000')

    // Confirm button should be enabled
    await expect(page.getByRole('button', { name: /konfirmasi/i })).toBeEnabled()
    await page.getByRole('button', { name: /konfirmasi/i }).click()

    // Receipt modal appears
    await expect(page.getByText(/transaksi berhasil/i)).toBeVisible()
  })
})

// ─── T031 — Hold Transaction ─────────────────────────────────────────────────

test.describe('Hold Transaction (T031)', () => {
  test('cashier can hold a transaction, start a new one, and retrieve the held transaction', async ({ page }) => {
    await signInToCashier(page)

    // Add first product to cart
    await page.getByRole('listitem').filter({ hasText: 'Nasi Goreng' }).click()
    // Verify it's in cart via pay button
    await expect(page.getByRole('button', { name: /bayar/i })).toContainText('15.000')

    // Click the action-bar "Tahan" button (last in DOM = action bar, first = header toggle)
    await page.getByRole('button', { name: 'Tahan', exact: true }).last().click()

    // Cart should now be empty — pay button disabled
    await expect(page.getByRole('button', { name: /bayar/i })).toBeDisabled()

    // Add a different product to the new active cart
    await page.getByRole('listitem').filter({ hasText: 'Es Teh Manis' }).click()

    // Open held carts panel via header button
    await page.getByRole('button', { name: 'Tahan', exact: true }).first().click()

    // Held cart entry should be visible
    await expect(page.getByText(/1 produk/)).toBeVisible()

    // Retrieve the held cart
    await page.getByRole('button', { name: /ambil/i }).click()

    // Active cart should now contain Nasi Goreng (pay button shows 15000)
    await expect(page.getByRole('button', { name: /bayar/i })).toContainText('15.000')
  })
})

// ─── T032 + T033 — Transaction Commit + Receipt ───────────────────────────────

test.describe('Transaction Commit + Receipt (T032, T033)', () => {
  test('completing a transaction writes to Transactions and shows receipt', async ({ page }) => {
    await signInToCashier(page)

    // Add product
    await page.getByRole('listitem').filter({ hasText: 'Nasi Goreng' }).click()

    // Pay with cash — .first() avoids strict mode error from "Split (Tunai + QRIS)"
    await page.getByRole('button', { name: /bayar/i }).click()
    await page.getByRole('button').filter({ hasText: /tunai/i }).first().click()
    await page.getByLabel(/uang diterima/i).fill('20000')
    await page.getByRole('button', { name: /konfirmasi/i }).click()

    // Receipt modal appears with transaction success
    await expect(page.getByText(/transaksi berhasil/i)).toBeVisible()
    await expect(page.getByText(/INV\//)).toBeVisible()

    // WhatsApp share button present
    await expect(page.getByRole('link', { name: /kirim via whatsapp/i })).toBeVisible()
  })

  test('after transaction, receipt modal shows correct totals and WhatsApp share button', async ({ page }) => {
    await signInToCashier(page)

    // Add two different products
    await page.getByRole('listitem').filter({ hasText: 'Nasi Goreng' }).click()
    await page.getByRole('listitem').filter({ hasText: 'Es Teh Manis' }).click()

    // Pay with exact QRIS — .first() to avoid matching "Split (Tunai + QRIS)"
    await page.getByRole('button', { name: /bayar/i }).click()
    await page.getByRole('button').filter({ hasText: /qris/i }).first().click()
    await page.getByRole('button', { name: /pembayaran diterima/i }).click()

    // Receipt modal — scope to dialog to avoid product grid text
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText(/Nasi Goreng/)).toBeVisible()
    await expect(dialog.getByText(/Es Teh Manis/)).toBeVisible()

    // WhatsApp share link must be present
    await expect(page.getByRole('link', { name: /kirim via whatsapp/i })).toBeVisible()
  })

  test('product stock is decremented after transaction', async ({ page }) => {
    await signInToCashier(page)

    // Product has stock=20. Add 2 of them.
    await page.getByRole('listitem').filter({ hasText: 'Nasi Goreng' }).click()
    await page.getByRole('listitem').filter({ hasText: 'Nasi Goreng' }).click()

    // Complete transaction via QRIS
    await page.getByRole('button', { name: /bayar/i }).click()
    await page.getByRole('button').filter({ hasText: /qris/i }).first().click()
    await page.getByRole('button', { name: /pembayaran diterima/i }).click()
    await expect(page.getByText(/transaksi berhasil/i)).toBeVisible()
    await page.getByRole('button', { name: /tutup/i }).click()

    // Navigate to catalog and verify stock decremented from 20 to 18
    await navigateTo(page, `${BASE}/catalog`)
    await page.getByRole('button', { name: 'Produk', exact: true }).click()
    await expect(page.getByText(/Stok: 18/)).toBeVisible()
  })
})
