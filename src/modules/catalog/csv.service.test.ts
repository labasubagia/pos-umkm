/**
 * csv.service tests — covers T024 (CSV Bulk Product Import).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as adapters from '../../lib/adapters'
import {
  parseProductCSV,
  validateImportRows,
  bulkImportProducts,
} from './csv.service'
import type { ParsedProduct } from './csv.service'

beforeEach(() => {
  vi.restoreAllMocks()
})

// Helper: build a fake File from CSV content
function makeCSVFile(content: string): File {
  const blob = new Blob([content], { type: 'text/csv' })
  return new File([blob], 'products.csv', { type: 'text/csv' })
}

// ─── parseProductCSV ─────────────────────────────────────────────────────────

describe('parseProductCSV', () => {
  it('correctly maps CSV columns to Product fields', async () => {
    const csv = `name,category_id,price,stock,sku,has_variants
Nasi Goreng,cat-001,15000,50,NASGOR-01,false`
    const file = makeCSVFile(csv)

    const result = await parseProductCSV(file)

    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Nasi Goreng')
    expect(result[0].category_id).toBe('cat-001')
    expect(result[0].price).toBe(15000)
    expect(result[0].stock).toBe(50)
    expect(result[0].sku).toBe('NASGOR-01')
    expect(result[0].has_variants).toBe(false)
  })

  it('parses has_variants=true correctly', async () => {
    const csv = `name,category_id,price,stock,sku,has_variants
Kaos,cat-001,75000,10,,true`
    const file = makeCSVFile(csv)

    const result = await parseProductCSV(file)

    expect(result[0].has_variants).toBe(true)
  })

  it('handles multiple rows', async () => {
    const csv = `name,category_id,price,stock,sku,has_variants
Produk A,cat-1,10000,5,,false
Produk B,cat-1,20000,10,,false`
    const file = makeCSVFile(csv)

    const result = await parseProductCSV(file)

    expect(result).toHaveLength(2)
  })
})

// ─── validateImportRows ───────────────────────────────────────────────────────

describe('validateImportRows', () => {
  it('returns valid for a well-formed row', () => {
    const rows: ParsedProduct[] = [
      { name: 'Nasi Goreng', category_id: 'cat-1', price: 15000, stock: 50, sku: 'NGS', has_variants: false },
    ]

    const results = validateImportRows(rows)

    expect(results[0].valid).toBe(true)
    expect(results[0].error).toBeUndefined()
  })

  it('returns error for row with empty name', () => {
    const rows: ParsedProduct[] = [
      { name: '', category_id: 'cat-1', price: 15000, stock: 0, sku: '', has_variants: false },
    ]

    const results = validateImportRows(rows)

    expect(results[0].valid).toBe(false)
    expect(results[0].error).toBeTruthy()
  })

  it('returns error for row with non-numeric price (NaN after parseInt)', () => {
    // parseProductCSV would produce NaN for a non-numeric string
    const rows: ParsedProduct[] = [
      { name: 'X', category_id: 'cat-1', price: NaN, stock: 0, sku: '', has_variants: false },
    ]

    const results = validateImportRows(rows)

    expect(results[0].valid).toBe(false)
  })

  it('returns error for row with zero price', () => {
    const rows: ParsedProduct[] = [
      { name: 'X', category_id: 'cat-1', price: 0, stock: 0, sku: '', has_variants: false },
    ]

    const results = validateImportRows(rows)

    expect(results[0].valid).toBe(false)
  })

  it('returns error for row with negative price', () => {
    const rows: ParsedProduct[] = [
      { name: 'X', category_id: 'cat-1', price: -500, stock: 0, sku: '', has_variants: false },
    ]

    const results = validateImportRows(rows)

    expect(results[0].valid).toBe(false)
  })
})

// ─── bulkImportProducts ───────────────────────────────────────────────────────

describe('bulkImportProducts', () => {
  it('appends all rows in a single API call (one appendRow per product)', async () => {
    const appendSpy = vi.spyOn(adapters.dataAdapter, 'appendRow').mockResolvedValue()
    const rows: ParsedProduct[] = [
      { name: 'A', category_id: 'cat-1', price: 1000, stock: 5, sku: '', has_variants: false },
      { name: 'B', category_id: 'cat-1', price: 2000, stock: 10, sku: '', has_variants: false },
    ]

    await bulkImportProducts(rows)

    expect(appendSpy).toHaveBeenCalledTimes(2)
    expect(appendSpy.mock.calls[0][0]).toBe('Products')
    expect(appendSpy.mock.calls[1][0]).toBe('Products')
  })

  it('throws and does not write if any row is invalid', async () => {
    const appendSpy = vi.spyOn(adapters.dataAdapter, 'appendRow').mockResolvedValue()
    const rows: ParsedProduct[] = [
      { name: 'Valid', category_id: 'cat-1', price: 1000, stock: 5, sku: '', has_variants: false },
      { name: '', category_id: 'cat-1', price: 0, stock: 0, sku: '', has_variants: false }, // invalid
    ]

    await expect(bulkImportProducts(rows)).rejects.toThrow()

    expect(appendSpy).not.toHaveBeenCalled()
  })
})
