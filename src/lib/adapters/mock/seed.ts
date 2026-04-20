/**
 * Optional seed data for the mock adapter.
 * Call seedLocalStorage() in main.tsx when VITE_ADAPTER=mock to populate
 * localStorage with realistic data for development and manual testing.
 */
import { createMockRepos } from '../repos'
import { generateId } from '../../uuid'

export async function seedLocalStorage(): Promise<void> {
  const repos = createMockRepos()

  // Only seed if there's no data yet
  const existing = await repos.products.getAll()
  if (existing.length > 0) return

  const now = new Date().toISOString()

  await repos.categories.batchAppend([
    { id: generateId(), name: 'Makanan', created_at: now, deleted_at: null },
    { id: generateId(), name: 'Minuman', created_at: now, deleted_at: null },
  ])

  await repos.products.batchAppend([
    {
      id: generateId(),
      category_id: 'cat-001',
      name: 'Nasi Goreng',
      price: 15000,
      sku: 'NASGOR-01',
      stock: 50,
      created_at: now,
      deleted_at: null,
    },
    {
      id: generateId(),
      category_id: 'cat-002',
      name: 'Es Teh Manis',
      price: 5000,
      sku: 'ESTEH-01',
      stock: 100,
      created_at: now,
      deleted_at: null,
    },
  ])

  console.info('[seed] Seeded 2 categories and 2 products')
}
