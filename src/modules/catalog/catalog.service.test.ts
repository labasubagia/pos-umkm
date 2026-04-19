/**
 * catalog.service tests — covers T021 (Categories), T022 (Products), T023 (Variants).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as adapters from '../../lib/adapters'
import {
  fetchCategories,
  addCategory,
  updateCategory,
  deleteCategory,
  fetchProducts,
  addProduct,
  updateProduct,
  deleteProduct,
  decrementStock,
  fetchVariants,
  addVariant,
  deleteVariant,
  decrementVariantStock,
  CatalogError,
} from './catalog.service'

beforeEach(() => {
  vi.restoreAllMocks()
})

// ─── T021 — Categories ───────────────────────────────────────────────────────

describe('fetchCategories', () => {
  it('returns parsed list excluding soft-deleted rows', async () => {
    // getSheet already filters deleted rows; only non-deleted rows are returned
    vi.spyOn(adapters.dataAdapter, 'getSheet').mockResolvedValue([
      { id: 'cat-1', name: 'Makanan', created_at: '2026-01-01T00:00:00.000Z', deleted_at: null },
      { id: 'cat-2', name: 'Minuman', created_at: '2026-01-01T00:00:00.000Z', deleted_at: null },
    ])

    const result = await fetchCategories()

    expect(result).toHaveLength(2)
    expect(result[0].name).toBe('Makanan')
    expect(result[1].name).toBe('Minuman')
  })

  it('excludes sentinel rows without a name', async () => {
    vi.spyOn(adapters.dataAdapter, 'getSheet').mockResolvedValue([
      { id: 'init', _initialized: true, created_at: '2026-01-01T00:00:00.000Z' },
      { id: 'cat-1', name: 'Makanan', created_at: '2026-01-01T00:00:00.000Z' },
    ])

    const result = await fetchCategories()

    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Makanan')
  })
})

describe('addCategory', () => {
  it('appends correct row with generated UUID', async () => {
    const appendSpy = vi.spyOn(adapters.dataAdapter, 'appendRow').mockResolvedValue()

    const result = await addCategory('Snack')

    expect(appendSpy).toHaveBeenCalledOnce()
    const [sheetName, row] = appendSpy.mock.calls[0]
    expect(sheetName).toBe('Categories')
    expect(row['name']).toBe('Snack')
    expect(typeof row['id']).toBe('string')
    expect(row['id']).toBeTruthy()
    expect(result.name).toBe('Snack')
  })

  it('throws if name is empty', async () => {
    await expect(addCategory('')).rejects.toThrow(CatalogError)
    await expect(addCategory('  ')).rejects.toThrow(CatalogError)
  })

  it('throws if name exceeds 100 characters', async () => {
    const longName = 'a'.repeat(101)
    await expect(addCategory(longName)).rejects.toThrow(CatalogError)
  })
})

describe('updateCategory', () => {
  it('updates name cell of correct row', async () => {
    const updateSpy = vi.spyOn(adapters.dataAdapter, 'updateCell').mockResolvedValue()

    await updateCategory('cat-1', 'Makanan Berat')

    expect(updateSpy).toHaveBeenCalledWith('Categories', 'cat-1', 'name', 'Makanan Berat')
  })
})

describe('deleteCategory', () => {
  it('sets deleted_at on correct row when no products reference it', async () => {
    vi.spyOn(adapters.dataAdapter, 'getSheet').mockResolvedValue([])
    const softDeleteSpy = vi.spyOn(adapters.dataAdapter, 'softDelete').mockResolvedValue()

    await deleteCategory('cat-1')

    expect(softDeleteSpy).toHaveBeenCalledWith('Categories', 'cat-1')
  })

  it('throws if category has associated products', async () => {
    vi.spyOn(adapters.dataAdapter, 'getSheet').mockResolvedValue([
      { id: 'prod-1', category_id: 'cat-1', name: 'Nasi Goreng' },
    ])

    await expect(deleteCategory('cat-1')).rejects.toThrow(CatalogError)
  })
})

// ─── T022 — Products ─────────────────────────────────────────────────────────

describe('fetchProducts', () => {
  it('returns all non-deleted products', async () => {
    vi.spyOn(adapters.dataAdapter, 'getSheet').mockResolvedValue([
      {
        id: 'p-1',
        category_id: 'cat-1',
        name: 'Nasi Goreng',
        sku: 'NASGOR',
        price: '15000',
        stock: '50',
        has_variants: false,
        created_at: '2026-01-01T00:00:00.000Z',
      },
    ])

    const result = await fetchProducts()

    expect(result).toHaveLength(1)
    expect(result[0].price).toBe(15000)
    expect(result[0].stock).toBe(50)
    expect(result[0].has_variants).toBe(false)
  })
})

describe('addProduct', () => {
  it('appends row with all required fields', async () => {
    const appendSpy = vi.spyOn(adapters.dataAdapter, 'appendRow').mockResolvedValue()

    const result = await addProduct({
      category_id: 'cat-1',
      name: 'Nasi Goreng',
      price: 15000,
      stock: 50,
      sku: 'NASGOR',
    })

    expect(appendSpy).toHaveBeenCalledOnce()
    const [sheetName, row] = appendSpy.mock.calls[0]
    expect(sheetName).toBe('Products')
    expect(row['name']).toBe('Nasi Goreng')
    expect(row['price']).toBe(15000)
    expect(result.id).toBeTruthy()
  })

  it('throws if price is not a positive integer', async () => {
    await expect(addProduct({ category_id: 'cat-1', name: 'X', price: 0 })).rejects.toThrow(CatalogError)
    await expect(addProduct({ category_id: 'cat-1', name: 'X', price: -100 })).rejects.toThrow(CatalogError)
    await expect(addProduct({ category_id: 'cat-1', name: 'X', price: 1.5 })).rejects.toThrow(CatalogError)
  })

  it('throws if name is empty', async () => {
    await expect(addProduct({ category_id: 'cat-1', name: '', price: 1000 })).rejects.toThrow(CatalogError)
  })
})

describe('updateProduct', () => {
  it('updates only changed fields', async () => {
    const batchSpy = vi.spyOn(adapters.dataAdapter, 'batchUpdateCells').mockResolvedValue()

    await updateProduct('prod-1', { name: 'Nasi Goreng Spesial', price: 18000 })

    expect(batchSpy).toHaveBeenCalledWith('Products', [
      { rowId: 'prod-1', column: 'name', value: 'Nasi Goreng Spesial' },
      { rowId: 'prod-1', column: 'price', value: 18000 },
    ])
  })
})

describe('deleteProduct', () => {
  it('sets deleted_at', async () => {
    const softDeleteSpy = vi.spyOn(adapters.dataAdapter, 'softDelete').mockResolvedValue()

    await deleteProduct('prod-1')

    expect(softDeleteSpy).toHaveBeenCalledWith('Products', 'prod-1')
  })
})

describe('decrementStock', () => {
  it('reads current stock, computes new value, writes updated cell', async () => {
    vi.spyOn(adapters.dataAdapter, 'getSheet').mockResolvedValue([
      { id: 'prod-1', name: 'Nasi Goreng', stock: '10' },
    ])
    const updateSpy = vi.spyOn(adapters.dataAdapter, 'updateCell').mockResolvedValue()

    await decrementStock('prod-1', 3)

    expect(updateSpy).toHaveBeenCalledWith('Products', 'prod-1', 'stock', 7)
  })

  it('throws if resulting stock would go below 0', async () => {
    vi.spyOn(adapters.dataAdapter, 'getSheet').mockResolvedValue([
      { id: 'prod-1', name: 'Nasi Goreng', stock: '2' },
    ])

    await expect(decrementStock('prod-1', 5)).rejects.toThrow(CatalogError)
  })
})

// ─── T023 — Variants ─────────────────────────────────────────────────────────

describe('fetchVariants', () => {
  it('returns all variants for a given product_id', async () => {
    vi.spyOn(adapters.dataAdapter, 'getSheet').mockResolvedValue([
      {
        id: 'v-1',
        product_id: 'prod-1',
        option_name: 'Ukuran',
        option_value: 'M',
        price: '25000',
        stock: '10',
        created_at: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'v-2',
        product_id: 'prod-2',
        option_name: 'Ukuran',
        option_value: 'L',
        price: '30000',
        stock: '5',
        created_at: '2026-01-01T00:00:00.000Z',
      },
    ])

    const all = await fetchVariants()
    const forProd1 = all.filter((v) => v.product_id === 'prod-1')

    expect(forProd1).toHaveLength(1)
    expect(forProd1[0].option_value).toBe('M')
    expect(forProd1[0].price).toBe(25000)
  })
})

describe('addVariant', () => {
  it('appends row linked to correct product_id', async () => {
    const appendSpy = vi.spyOn(adapters.dataAdapter, 'appendRow').mockResolvedValue()

    const result = await addVariant('prod-1', 'Ukuran', 'L', 30000, 10)

    expect(appendSpy).toHaveBeenCalledOnce()
    const [sheetName, row] = appendSpy.mock.calls[0]
    expect(sheetName).toBe('Variants')
    expect(row['product_id']).toBe('prod-1')
    expect(row['option_value']).toBe('L')
    expect(result.price).toBe(30000)
  })

  it('throws if price is non-positive', async () => {
    await expect(addVariant('prod-1', 'Ukuran', 'L', 0, 5)).rejects.toThrow(CatalogError)
    await expect(addVariant('prod-1', 'Ukuran', 'L', -100, 5)).rejects.toThrow(CatalogError)
  })

  it('throws if optionValue is empty', async () => {
    await expect(addVariant('prod-1', 'Ukuran', '', 5000, 5)).rejects.toThrow(CatalogError)
    await expect(addVariant('prod-1', 'Ukuran', '  ', 5000, 5)).rejects.toThrow(CatalogError)
  })
})

describe('deleteVariant', () => {
  it('soft-deletes the variant', async () => {
    const softDeleteSpy = vi.spyOn(adapters.dataAdapter, 'softDelete').mockResolvedValue()

    await deleteVariant('v-1')

    expect(softDeleteSpy).toHaveBeenCalledWith('Variants', 'v-1')
  })
})

describe('decrementVariantStock', () => {
  it('updates stock on correct variant row', async () => {
    vi.spyOn(adapters.dataAdapter, 'getSheet').mockResolvedValue([
      { id: 'v-1', product_id: 'prod-1', option_value: 'M', stock: '8' },
    ])
    const updateSpy = vi.spyOn(adapters.dataAdapter, 'updateCell').mockResolvedValue()

    await decrementVariantStock('v-1', 3)

    expect(updateSpy).toHaveBeenCalledWith('Variants', 'v-1', 'stock', 5)
  })

  it('throws if resulting stock would go below 0', async () => {
    vi.spyOn(adapters.dataAdapter, 'getSheet').mockResolvedValue([
      { id: 'v-1', product_id: 'prod-1', option_value: 'M', stock: '2' },
    ])

    await expect(decrementVariantStock('v-1', 5)).rejects.toThrow(CatalogError)
  })
})
