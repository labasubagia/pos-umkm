/**
 * cashier.service.ts — Cashier business logic (pure functions + adapter calls).
 *
 * Covers T025 (calculations), T026 (product search), T027 (cash payment),
 * T030 (split payment), T032 (transaction commit).
 *
 * All price calculations are pure functions so they can be tested without
 * any React component or adapter mock. The adapter is only called for
 * transaction commit (commitTransaction) and the monthly sheet check.
 */

import { getRepos } from '../../lib/adapters'
import { generateId } from '../../lib/uuid'
import { nowUTC } from '../../lib/formatters'
import { createMonthlySheet, initializeMonthlySheets, getCurrentMonthSheetId, shareSheetWithAllMembers } from '../auth/setup.service'
import { useAuthStore } from '../../store/authStore'
import type { Product, Variant } from '../catalog/catalog.service'

// ─── Domain types ─────────────────────────────────────────────────────────────

export interface CartItem {
  productId: string
  variantId?: string
  name: string
  price: number
  quantity: number
}

export type DiscountType = { type: 'flat'; value: number } | { type: 'percent'; value: number }

export interface Transaction {
  id: string
  created_at: string
  cashier_id: string
  customer_id: string | null
  subtotal: number
  discount_type: 'flat' | 'percent' | null
  discount_value: number
  discount_amount: number
  tax: number
  total: number
  payment_method: 'CASH' | 'QRIS' | 'SPLIT'
  cash_received: number
  change: number
  receipt_number: string
  notes: string | null
}

export interface TransactionItem {
  id: string
  transaction_id: string
  product_id: string
  variant_id: string | null
  name: string
  price: number
  quantity: number
  subtotal: number
}

// ─── Custom errors ─────────────────────────────────────────────────────────────

export class CashierError extends Error {
  readonly cause?: unknown
  constructor(message: string, cause?: unknown) {
    super(message)
    this.name = 'CashierError'
    this.cause = cause
  }
}

export class InsufficientCashError extends CashierError {
  constructor(total: number, received: number) {
    super(`Uang diterima (${received}) kurang dari total (${total})`)
    this.name = 'InsufficientCashError'
  }
}

export class SplitPaymentError extends CashierError {
  constructor(message: string) {
    super(message)
    this.name = 'SplitPaymentError'
  }
}

// ─── T025 — Calculation functions ─────────────────────────────────────────────

/**
 * Sums item price × quantity for all items in the cart.
 * Returns 0 for empty cart.
 */
export function calculateSubtotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0)
}

/**
 * Applies a discount to the subtotal.
 * - 'flat': fixed IDR amount deducted.
 * - 'percent': percentage of subtotal deducted (1–100).
 * Throws CashierError if:
 *   - percentage > 100
 *   - flat amount > subtotal
 */
export function applyDiscount(subtotal: number, discount: DiscountType): number {
  if (discount.type === 'percent') {
    if (discount.value > 100) {
      throw new CashierError('Diskon persentase tidak boleh melebihi 100%')
    }
    return Math.round(subtotal * (discount.value / 100))
  }
  // flat
  if (discount.value > subtotal) {
    throw new CashierError('Diskon nominal tidak boleh melebihi subtotal')
  }
  return discount.value
}

/**
 * Calculates PPN tax on (subtotal − discount).
 * Returns 0 if taxRate is 0 (tax disabled by owner).
 * Indonesian standard PPN is 11% (taxRate = 11).
 */
export function calculateTax(subtotalAfterDiscount: number, taxRate: number): number {
  if (taxRate === 0) return 0
  return Math.round(subtotalAfterDiscount * (taxRate / 100))
}

/**
 * Calculates the final transaction total.
 * total = subtotal − discountAmount + tax
 */
export function calculateTotal(subtotal: number, discountAmount: number, tax: number): number {
  return subtotal - discountAmount + tax
}

/**
 * Calculates change to give back to the customer.
 * Throws InsufficientCashError if cashReceived < total.
 */
export function calculateChange(total: number, cashReceived: number): number {
  if (cashReceived < total) {
    throw new InsufficientCashError(total, cashReceived)
  }
  return cashReceived - total
}

// ─── T027 — Quick denomination suggestions ────────────────────────────────────

/** Standard IDR banknote denominations (ascending). */
const DENOMINATIONS = [1000, 2000, 5000, 10000, 20000, 50000, 100000]

/**
 * Returns up to 4 quick-cash denomination buttons for a given total.
 * Selects the smallest denomination >= total, then the next 3 larger ones.
 * This covers the most common "pay with a single banknote" scenario.
 */
export function suggestDenominations(total: number): number[] {
  const suitable = DENOMINATIONS.filter((d) => d >= total)
  return suitable.slice(0, 4)
}

// ─── T026 — Product search ────────────────────────────────────────────────────

/**
 * Searches products by name or SKU, case-insensitively.
 * Returns all products for empty query.
 * Excludes products with has_variants=true from direct add — caller must
 * route those through the variant selector.
 */
export function searchProducts(query: string, products: Product[]): Product[] {
  const q = query.trim().toLowerCase()
  if (!q) return products
  return products.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      (p.sku && p.sku.toLowerCase().includes(q)),
  )
}

// ─── T030 — Split payment validation ─────────────────────────────────────────

/**
 * Validates that a split payment is coherent.
 * Throws SplitPaymentError if amounts do not sum to total or if any is negative.
 */
export function validateSplitPayment(
  cashAmount: number,
  qrisAmount: number,
  total: number,
): boolean {
  if (cashAmount < 0 || qrisAmount < 0) {
    throw new SplitPaymentError('Jumlah pembayaran tidak boleh negatif')
  }
  if (cashAmount + qrisAmount !== total) {
    throw new SplitPaymentError(
      `Total pembayaran split (${cashAmount + qrisAmount}) tidak sama dengan total transaksi (${total})`,
    )
  }
  return true
}

// ─── T032 — Transaction commit ────────────────────────────────────────────────

/**
 * Ensures a monthly transaction spreadsheet exists for today's month.
 * Creates it (and shares with all members) if not yet present.
 * Returns the spreadsheetId.
 */
export async function ensureMonthlySheetExists(_masterSpreadsheetId: string): Promise<string> {
  const existing = await getCurrentMonthSheetId()
  if (existing) {
    // Ensure the adapter routes monthly tab writes to the correct spreadsheet.
    useAuthStore.getState().setMonthlySpreadsheetId(existing)
    return existing
  }

  const now = new Date()
  const id = await createMonthlySheet(now.getFullYear(), now.getMonth() + 1)
  // Set routing BEFORE initializeMonthlySheets so writeHeaders goes to the monthly sheet.
  useAuthStore.getState().setMonthlySpreadsheetId(id)
  await initializeMonthlySheets(id)
  await shareSheetWithAllMembers(id)
  return id
}

export interface PaymentInfo {
  method: 'CASH' | 'QRIS' | 'SPLIT'
  cashReceived: number
  change: number
  splitCash?: number
  splitQris?: number
}

/**
 * Commits a transaction to Google Sheets (via adapter).
 * Steps:
 *   1. Append transaction header to Transactions tab.
 *   2. Append all items in one call to Transaction_Items tab.
 *   3. Decrement stock for each product/variant.
 *
 * If step 3 partially fails, the transaction header is already written —
 * a CashierError is thrown with a flag to show the cashier a stock-warning
 * alert. This is intentionally not rolled back (safer than complex delete logic).
 *
 * `preloadedProducts` and `preloadedVariants` — pass the catalog store's
 * in-memory lists to skip one `getSheet` read in step 3. Stock values may
 * be slightly stale (since catalog was last loaded) which is acceptable for
 * the single-cashier MVP.
 */
export async function commitTransaction(
  items: CartItem[],
  discount: DiscountType | null,
  taxRate: number,
  payment: PaymentInfo,
  cashierId: string,
  customerId: string | null,
  _masterSpreadsheetId: string,
  receiptSequence: number,
  preloadedProducts?: Product[],
  preloadedVariants?: Variant[],
): Promise<Transaction> {
  if (items.length === 0) {
    throw new CashierError('Keranjang kosong — tidak ada transaksi yang dilakukan')
  }

  const subtotal = calculateSubtotal(items)
  const discountAmount = discount ? applyDiscount(subtotal, discount) : 0
  const tax = calculateTax(subtotal - discountAmount, taxRate)
  const total = calculateTotal(subtotal, discountAmount, tax)

  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const rand = Array.from({ length: 5 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('')
  const receiptNumber = `INV/${yyyy}/${mm}/${rand}`

  const transactionId = generateId()
  const created_at = nowUTC()

  const transaction: Transaction = {
    id: transactionId,
    created_at,
    cashier_id: cashierId,
    customer_id: customerId,
    subtotal,
    discount_type: discount?.type ?? null,
    discount_value: discount?.value ?? 0,
    discount_amount: discountAmount,
    tax,
    total,
    payment_method: payment.method,
    cash_received: payment.cashReceived,
    change: payment.change,
    receipt_number: receiptNumber,
    notes: null,
  }

  // Step 1: Append transaction header
  await getRepos().transactions.batchInsert([{
    id: transactionId,
    created_at,
    cashier_id: cashierId,
    customer_id: customerId ?? '',
    subtotal,
    discount_type: discount?.type ?? '',
    discount_value: discount?.value ?? 0,
    discount_amount: discountAmount,
    tax,
    total,
    payment_method: payment.method,
    cash_received: payment.cashReceived,
    change: payment.change,
    receipt_number: receiptNumber,
    notes: '',
  }])

  // Step 2: Append all items in a single API call
  await getRepos().transactionItems.batchInsert(
    items.map((item) => ({
      id: generateId(),
      transaction_id: transactionId,
      product_id: item.productId,
      variant_id: item.variantId ?? '',
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      subtotal: item.price * item.quantity,
    })),
  )

  // Step 3: Decrement stock — best-effort; log failures but don't roll back.
  // Use preloaded catalog data when available to skip one GET per sheet;
  // fall back to reading from the adapter if not provided.
  // batchUpdateCells still does its own GET to resolve row positions — reducing
  // the total from 2 GETs + 1 batchUpdate to 1 GET + 1 batchUpdate.
  const stockErrors: string[] = []
  try {
    const hasVariantItems = items.some((i) => i.variantId)
    const hasProductItems = items.some((i) => !i.variantId)

    const [variantRows, productRows] = await Promise.all([
      hasVariantItems
        ? (preloadedVariants
            ? Promise.resolve(preloadedVariants as unknown as Record<string, unknown>[])
            : getRepos().variants.getAll())
        : Promise.resolve([]),
      hasProductItems
        ? (preloadedProducts
            ? Promise.resolve(preloadedProducts as unknown as Record<string, unknown>[])
            : getRepos().products.getAll())
        : Promise.resolve([]),
    ])

    const variantUpdates = items
      .filter((i) => i.variantId)
      .flatMap((item) => {
        const v = variantRows.find((r) => r['id'] === item.variantId)
        if (!v) return []
        return [{ id: item.variantId!, stock: Math.max(0, Number(v['stock']) - item.quantity) }]
      })

    const productUpdates = items
      .filter((i) => !i.variantId)
      .flatMap((item) => {
        const p = productRows.find((r) => r['id'] === item.productId)
        if (!p) return []
        return [{ id: item.productId, stock: Math.max(0, Number(p['stock']) - item.quantity) }]
      })

    await Promise.all([
      variantUpdates.length > 0 ? getRepos().variants.batchUpdate(variantUpdates) : Promise.resolve(),
      productUpdates.length > 0 ? getRepos().products.batchUpdate(productUpdates) : Promise.resolve(),
    ])
  } catch (err) {
    stockErrors.push(String(err))
  }

  if (stockErrors.length > 0) {
    // Transaction is committed — warn cashier to verify stock manually
    throw new CashierError(
      `Transaksi berhasil, tetapi gagal memperbarui stok: ${stockErrors.join(', ')}. Harap periksa stok secara manual.`,
    )
  }

  return transaction
}
