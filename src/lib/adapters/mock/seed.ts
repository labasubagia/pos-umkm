/**
 * Optional seed data for MockDataAdapter.
 * Call seedLocalStorage() in main.tsx when VITE_ADAPTER=mock to populate
 * localStorage with realistic data for development and manual testing.
 */
import { MockDataAdapter } from './MockDataAdapter'

export async function seedLocalStorage(): Promise<void> {
  const adapter = new MockDataAdapter()

  // Only seed if there's no data yet
  const existing = await adapter.getSheet('Products')
  if (existing.length > 0) return

  const spreadsheetId = await adapter.createSpreadsheet('POS UMKM Test Store')
  console.info('[seed] Created mock spreadsheet:', spreadsheetId)

  // Seed categories
  await adapter.appendRow('Categories', {
    id: 'cat-001',
    name: 'Makanan',
    created_at: new Date().toISOString(),
    deleted_at: null,
  })
  await adapter.appendRow('Categories', {
    id: 'cat-002',
    name: 'Minuman',
    created_at: new Date().toISOString(),
    deleted_at: null,
  })

  // Seed products
  await adapter.appendRow('Products', {
    id: 'prod-001',
    category_id: 'cat-001',
    name: 'Nasi Goreng',
    price: 15000,
    sku: 'NASGOR-01',
    stock: 50,
    created_at: new Date().toISOString(),
    deleted_at: null,
  })
  await adapter.appendRow('Products', {
    id: 'prod-002',
    category_id: 'cat-002',
    name: 'Es Teh Manis',
    price: 5000,
    sku: 'ESTEH-01',
    stock: 100,
    created_at: new Date().toISOString(),
    deleted_at: null,
  })

  console.info('[seed] Seeded 2 categories and 2 products')
}
