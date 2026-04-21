/**
 * catalog.service.ts — Product Catalog business logic.
 *
 * Covers:
 *   T021 — Categories CRUD
 *   T022 — Products CRUD
 *   T023 — Product Variants
 *
 * All reads/writes go through the active DataAdapter — never directly to
 * lib/sheets/. This file contains pure-ish service functions (side effects
 * only via adapter) so they are independently testable.
 *
 * Data model (Master Sheet tabs):
 *   Categories: id, name, created_at, deleted_at
 *   Products:   id, category_id, name, sku, price, stock, has_variants, created_at, deleted_at
 *   Variants:   id, product_id, option_name, option_value, price, stock, created_at, deleted_at
 */

import { getRepos } from '../../lib/adapters'
import { nowUTC } from '../../lib/formatters'
import { generateId } from '../../lib/uuid'

// ─── Domain types ─────────────────────────────────────────────────────────────

export interface Category {
  id: string
  name: string
  created_at: string
  deleted_at?: string | null
}

export interface Product {
  id: string
  category_id: string
  name: string
  sku: string
  price: number
  stock: number
  /** When true, the cashier screen shows a variant selector, not a direct add. */
  has_variants: boolean
  created_at: string
  deleted_at?: string | null
}

export interface Variant {
  id: string
  product_id: string
  option_name: string
  option_value: string
  price: number
  stock: number
  created_at: string
  deleted_at?: string | null
}

// ─── Custom errors ─────────────────────────────────────────────────────────────

export class CatalogError extends Error {
  readonly cause?: unknown
  constructor(message: string, cause?: unknown) {
    super(message)
    this.name = 'CatalogError'
    this.cause = cause
  }
}

// ─── T021 — Categories CRUD ──────────────────────────────────────────────────

/**
 * Fetches all non-soft-deleted categories from the Categories sheet tab.
 * The adapter's getSheet already filters rows where deleted_at is set.
 */
export async function fetchCategories(): Promise<Category[]> {
  const rows = await getRepos().categories.getAll()
  return rows
    .filter((r) => r['name']) // skip sentinel/header rows without a name
    .map((r) => ({
      id: r['id'] as string,
      name: r['name'] as string,
      created_at: r['created_at'] as string,
      deleted_at: (r['deleted_at'] as string | null) ?? null,
    }))
}

/**
 * Appends a new category row with a generated UUID.
 * Throws CatalogError if the name is empty or exceeds 100 characters.
 */
export async function addCategory(name: string): Promise<Category> {
  if (!name || name.trim().length === 0) {
    throw new CatalogError('Nama kategori tidak boleh kosong')
  }
  if (name.trim().length > 100) {
    throw new CatalogError('Nama kategori maksimal 100 karakter')
  }

  const id = generateId()
  const created_at = nowUTC()
  await getRepos().categories.batchInsert([{
    id,
    name: name.trim(),
    created_at,
    deleted_at: null,
  }])
  return { id, name: name.trim(), created_at, deleted_at: null }
}

/**
 * Updates the name of an existing category.
 * Throws CatalogError if name is empty or exceeds 100 characters.
 */
export async function updateCategory(id: string, name: string): Promise<void> {
  if (!name || name.trim().length === 0) {
    throw new CatalogError('Nama kategori tidak boleh kosong')
  }
  if (name.trim().length > 100) {
    throw new CatalogError('Nama kategori maksimal 100 karakter')
  }
  await getRepos().categories.batchUpdate([{ id: id, field: 'name', value: name.trim() }])
}

/**
 * Soft-deletes a category. Blocks deletion if any active product references it,
 * to preserve referential integrity.
 * Throws CatalogError if associated products exist.
 */
export async function deleteCategory(id: string): Promise<void> {
  const products = await getRepos().products.getAll()
  const hasProducts = products.some((p) => p['category_id'] === id)
  if (hasProducts) {
    throw new CatalogError(
      'Kategori tidak dapat dihapus karena masih ada produk yang menggunakan kategori ini',
    )
  }
  await getRepos().categories.softDelete(id)
}

// ─── T022 — Products CRUD ────────────────────────────────────────────────────

/**
 * Fetches all non-soft-deleted products.
 * Adapter's getSheet already filters deleted rows.
 */
export async function fetchProducts(): Promise<Product[]> {
  const rows = await getRepos().products.getAll()
  return rows
    .filter((r) => r['name'])
    .map((r) => ({
      id: r['id'] as string,
      category_id: r['category_id'] as string,
      name: r['name'] as string,
      sku: (r['sku'] as string) ?? '',
      price: Number(r['price']),
      stock: Number(r['stock']),
      has_variants: r['has_variants'] === true || r['has_variants'] === 'TRUE',
      created_at: r['created_at'] as string,
      deleted_at: (r['deleted_at'] as string | null) ?? null,
    }))
}

export interface NewProduct {
  category_id: string
  name: string
  sku?: string
  price: number
  stock?: number
  has_variants?: boolean
}

/**
 * Appends a new product row.
 * Price must be a positive integer (IDR has no decimals).
 * Name must not be empty.
 */
export async function addProduct(product: NewProduct): Promise<Product> {
  if (!product.name || product.name.trim().length === 0) {
    throw new CatalogError('Nama produk tidak boleh kosong')
  }
  if (!Number.isInteger(product.price) || product.price <= 0) {
    throw new CatalogError('Harga harus bilangan bulat positif')
  }

  const id = generateId()
  const created_at = nowUTC()
  const row: Record<string, unknown> = {
    id,
    category_id: product.category_id,
    name: product.name.trim(),
    sku: product.sku ?? '',
    price: product.price,
    stock: product.stock ?? 0,
    has_variants: product.has_variants ?? false,
    created_at,
    deleted_at: null,
  }
  await getRepos().products.batchInsert([row])
  return {
    id,
    category_id: product.category_id,
    name: product.name.trim(),
    sku: product.sku ?? '',
    price: product.price,
    stock: product.stock ?? 0,
    has_variants: product.has_variants ?? false,
    created_at,
    deleted_at: null,
  }
}

export type ProductChanges = Partial<
  Pick<Product, 'name' | 'sku' | 'price' | 'stock' | 'category_id' | 'has_variants'>
>

/**
 * Updates only the provided fields on a product row.
 * Uses batchUpdateCells so all fields are written in a single API round-trip
 * (1 GET + 1 batchUpdate) instead of N × (GET + PUT).
 */
export async function updateProduct(id: string, changes: ProductChanges): Promise<void> {
  const updates = (Object.entries(changes) as [string, unknown][]).map(([col, val]) => ({
    id,
    field: col,
    value: val,
  }))
  if (updates.length === 0) return
  await getRepos().products.batchUpdate(updates)
}

/** Soft-deletes a product by setting deleted_at. */
export async function deleteProduct(id: string): Promise<void> {
  await getRepos().products.softDelete(id)
}

/**
 * Reads current stock for a product, computes the new value, and writes the
 * updated stock cell. This is a read-then-write operation and not atomic —
 * acceptable for single-cashier MVP but documented as a known trade-off.
 *
 * Warns (throws CatalogError) if the result would go below 0, but the
 * caller may choose to allow negative stock for data correction purposes.
 */
export async function decrementStock(productId: string, qty: number): Promise<void> {
  const rows = await getRepos().products.getAll()
  const product = rows.find((r) => r['id'] === productId)
  if (!product) {
    throw new CatalogError(`Produk dengan id "${productId}" tidak ditemukan`)
  }
  const currentStock = Number(product['stock'])
  const newStock = currentStock - qty
  if (newStock < 0) {
    throw new CatalogError(
      `Stok tidak mencukupi: stok saat ini ${currentStock}, pengurangan ${qty}`,
    )
  }
  await getRepos().products.batchUpdate([{ id: productId, field: 'stock', value: newStock }])
}

// ─── T023 — Product Variants ─────────────────────────────────────────────────

/**
 * Fetches all non-deleted variants.
 * Callers filter by product_id for display; all variants are loaded at once
 * to avoid repeated API calls when the cashier selects different products.
 */
export async function fetchVariants(): Promise<Variant[]> {
  const rows = await getRepos().variants.getAll()
  return rows
    .filter((r) => r['product_id'])
    .map((r) => ({
      id: r['id'] as string,
      product_id: r['product_id'] as string,
      option_name: r['option_name'] as string,
      option_value: r['option_value'] as string,
      price: Number(r['price']),
      stock: Number(r['stock']),
      created_at: r['created_at'] as string,
      deleted_at: (r['deleted_at'] as string | null) ?? null,
    }))
}

/**
 * Appends a variant row linked to a parent product.
 * Price must be a positive integer. optionValue must not be empty.
 */
export async function addVariant(
  productId: string,
  optionName: string,
  optionValue: string,
  price: number,
  stock: number,
): Promise<Variant> {
  if (!optionValue || optionValue.trim().length === 0) {
    throw new CatalogError('Nilai varian tidak boleh kosong')
  }
  if (!Number.isInteger(price) || price <= 0) {
    throw new CatalogError('Harga varian harus bilangan bulat positif')
  }

  const id = generateId()
  const created_at = nowUTC()
  await getRepos().variants.batchInsert([{
    id,
    product_id: productId,
    option_name: optionName,
    option_value: optionValue.trim(),
    price,
    stock,
    created_at,
    deleted_at: null,
  }])
  return { id, product_id: productId, option_name: optionName, option_value: optionValue.trim(), price, stock, created_at, deleted_at: null }
}

/** Soft-deletes a variant. */
export async function deleteVariant(variantId: string): Promise<void> {
  await getRepos().variants.softDelete(variantId)
}

/**
 * Decrements stock on a specific variant row.
 * Same read-then-write pattern as decrementStock; acceptable for single-cashier MVP.
 */
export async function decrementVariantStock(variantId: string, qty: number): Promise<void> {
  const rows = await getRepos().variants.getAll()
  const variant = rows.find((r) => r['id'] === variantId)
  if (!variant) {
    throw new CatalogError(`Varian dengan id "${variantId}" tidak ditemukan`)
  }
  const currentStock = Number(variant['stock'])
  const newStock = currentStock - qty
  if (newStock < 0) {
    throw new CatalogError(
      `Stok varian tidak mencukupi: stok saat ini ${currentStock}, pengurangan ${qty}`,
    )
  }
  await getRepos().variants.batchUpdate([{ id: variantId, field: 'stock', value: newStock }])
}
