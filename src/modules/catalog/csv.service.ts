/**
 * csv.service.ts — CSV bulk product import (T024).
 *
 * Uses papaparse for robust CSV parsing (handles quoted commas, BOM, etc).
 * Import is all-or-nothing: if any row is invalid, nothing is written.
 * All valid rows are written in a single appendRow batch.
 *
 * Expected CSV columns (matching public/templates/products-template.csv):
 *   name, category_id, price, stock, sku, has_variants
 */

import Papa from 'papaparse'
import { getRepos } from '../../lib/adapters'
import { generateId } from '../../lib/uuid'
import { nowUTC } from '../../lib/formatters'

export interface ParsedProduct {
  name: string
  category_id: string
  price: number
  stock: number
  sku: string
  has_variants: boolean
}

export interface RowValidationResult {
  row: number
  valid: boolean
  error?: string
  data?: ParsedProduct
}

/** Parses a CSV File into raw parsed products. Throws on parse failure. */
export function parseProductCSV(file: File): Promise<ParsedProduct[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete(results) {
        const parsed = results.data.map((row) => ({
          name: (row['name'] ?? '').trim(),
          category_id: (row['category_id'] ?? '').trim(),
          price: parseInt(row['price'] ?? '0', 10),
          stock: parseInt(row['stock'] ?? '0', 10),
          sku: (row['sku'] ?? '').trim(),
          has_variants: (row['has_variants'] ?? '').toLowerCase() === 'true',
        }))
        resolve(parsed)
      },
      error(err) {
        reject(new Error(`CSV parse error: ${err.message}`))
      },
    })
  })
}

/**
 * Validates each row and returns per-row results.
 * Does not throw — callers check the results array to detect errors.
 */
export function validateImportRows(rows: ParsedProduct[]): RowValidationResult[] {
  return rows.map((row, index) => {
    const rowNum = index + 1

    if (!row.name) {
      return { row: rowNum, valid: false, error: 'Nama produk tidak boleh kosong' }
    }
    if (!Number.isInteger(row.price) || row.price <= 0) {
      return { row: rowNum, valid: false, error: `Harga tidak valid: "${row.price}"` }
    }
    if (!Number.isInteger(row.stock) || row.stock < 0) {
      return { row: rowNum, valid: false, error: `Stok tidak valid: "${row.stock}"` }
    }

    return { row: rowNum, valid: true, data: row }
  })
}

/**
 * Validates all rows, then writes all valid products in a single API call.
 * Throws if any row is invalid — ensuring all-or-nothing semantics.
 */
export async function bulkImportProducts(
  rows: ParsedProduct[],
): Promise<void> {
  const results = validateImportRows(rows)
  const invalid = results.filter((r) => !r.valid)
  if (invalid.length > 0) {
    const summary = invalid.map((r) => `Baris ${r.row}: ${r.error}`).join('; ')
    throw new Error(`Import gagal — ada ${invalid.length} baris tidak valid: ${summary}`)
  }

  // Write all rows; use sequential appends via Promise.all for single-batch semantics.
  // GoogleDataAdapter's appendRow maps to values.append which is idempotent on retry.
  const now = nowUTC()
  await getRepos().products.batchAppend(
    rows.map((row) => ({
      id: generateId(),
      name: row.name,
      category_id: row.category_id,
      price: row.price,
      stock: row.stock,
      sku: row.sku,
      has_variants: row.has_variants,
      created_at: now,
      deleted_at: null,
    })),
  )
}
