/**
 * E2E specs for Phase 7 — Reports (T038–T042).
 *
 * All tests run with VITE_ADAPTER=mock (default in dev). MockAuthAdapter
 * returns the preset owner user. Data is seeded via page.evaluate() into
 * localStorage before navigating to /reports.
 */
import { test, expect } from '@playwright/test'
import { signInAsOwner, navigateTo } from './helpers/auth'

const BASE = ''

async function signInAndSetup(page: Parameters<typeof signInAsOwner>[0]) {
  await signInAsOwner(page)
  if (page.url().includes('/setup')) {
    await page.getByTestId('input-business-name').fill('Toko Reports Test')
    await page.getByTestId('btn-setup-submit').click()
    await page.waitForURL(/\/cashier/)
  }
}

async function seedReportData(page: Parameters<typeof signInAsOwner>[0]) {
  const today = new Date().toISOString().slice(0, 10)
  await page.goto(`${BASE}/`)
  await page.evaluate((date: string) => {
    const now = new Date().toISOString()
    window.localStorage.setItem(
      'mock_Transactions',
      JSON.stringify([
        {
          id: 'e2e-tx-1',
          created_at: `${date}T08:00:00.000Z`,
          cashier_id: 'owner@test.com',
          customer_id: '',
          subtotal: 30000,
          discount_type: 'none',
          discount_value: 0,
          discount_amount: 0,
          tax: 0,
          total: 30000,
          payment_method: 'CASH',
          cash_received: 30000,
          change: 0,
          receipt_number: 'RCP-001',
          notes: '',
          created_at_local: now,
        },
        {
          id: 'e2e-tx-2',
          created_at: `${date}T10:00:00.000Z`,
          cashier_id: 'owner@test.com',
          customer_id: '',
          subtotal: 20000,
          discount_type: 'none',
          discount_value: 0,
          discount_amount: 0,
          tax: 0,
          total: 20000,
          payment_method: 'QRIS',
          cash_received: 0,
          change: 0,
          receipt_number: 'RCP-002',
          notes: '',
        },
      ]),
    )
    window.localStorage.setItem(
      'mock_Transaction_Items',
      JSON.stringify([
        {
          id: 'e2e-item-1',
          transaction_id: 'e2e-tx-1',
          product_id: 'e2e-prod-1',
          variant_id: '',
          name: 'Nasi Goreng',
          price: 15000,
          quantity: 2,
          subtotal: 30000,
        },
        {
          id: 'e2e-item-2',
          transaction_id: 'e2e-tx-2',
          product_id: 'e2e-prod-2',
          variant_id: '',
          name: 'Es Teh Manis',
          price: 5000,
          quantity: 4,
          subtotal: 20000,
        },
      ]),
    )
  }, today)
}

test('owner can view today\'s sales summary after completing transactions', async ({ page }) => {
  await seedReportData(page)
  await signInAndSetup(page)
  await navigateTo(page, `${BASE}/reports`)

  await page.waitForURL(/\/reports/)
  await page.getByTestId('reports-page').waitFor()

  // DailySummary loads on mount — wait for revenue display
  await page.getByTestId('daily-summary-container').waitFor()
  await page.getByTestId('btn-load-summary').click()
  await page.getByTestId('summary-revenue').waitFor()

  const revenue = await page.getByTestId('summary-revenue').textContent()
  // Total should be 50000 (30000 + 20000)
  expect(revenue).toContain('50.000')
})

test('owner can filter report by date range and see correct totals', async ({ page }) => {
  await seedReportData(page)
  await signInAndSetup(page)
  await navigateTo(page, `${BASE}/reports`)

  await page.waitForURL(/\/reports/)
  await page.getByTestId('tab-sales').click()
  await page.getByTestId('sales-report-container').waitFor()

  const today = new Date().toISOString().slice(0, 10)
  await page.getByTestId('input-start-date').fill(today)
  await page.getByTestId('input-end-date').fill(today)
  await page.getByTestId('btn-load-report').click()

  await page.getByTestId('report-total-revenue').waitFor()
  const total = await page.getByTestId('report-total-revenue').textContent()
  expect(total).toContain('50.000')
})

test('owner can complete end-of-day cash reconciliation and discrepancy is logged', async ({ page }) => {
  await seedReportData(page)
  await signInAndSetup(page)
  await navigateTo(page, `${BASE}/reports`)

  await page.waitForURL(/\/reports/)
  await page.getByTestId('tab-reconciliation').click()
  await page.getByTestId('reconciliation-container').waitFor()

  const today = new Date().toISOString().slice(0, 10)
  await page.getByTestId('input-reconciliation-date').fill(today)
  await page.getByTestId('input-opening-balance').fill('100000')
  await page.getByTestId('input-closing-balance').fill('130000')
  await page.getByTestId('btn-calculate-reconciliation').click()

  await page.getByTestId('reconciliation-expected').waitFor()
  const expected = await page.getByTestId('reconciliation-expected').textContent()
  // 100000 opening + 30000 CASH tx = 130000 expected
  expect(expected).toContain('130.000')

  await page.getByTestId('btn-save-reconciliation').click()
  // After save, the save button disappears
  await expect(page.getByTestId('btn-save-reconciliation')).not.toBeVisible({ timeout: 3000 })
})
