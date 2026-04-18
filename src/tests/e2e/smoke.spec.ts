import { test, expect } from '@playwright/test'

test('page loads and title contains POS UMKM', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/POS UMKM/)
})
