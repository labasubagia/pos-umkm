/**
 * refund.service.ts — Refund / Return Flow business logic.
 *
 * Covers T037 — Refund / Return Flow.
 *
 * Steps for createRefund:
 *   1. Validate refund amount <= original transaction total.
 *   2. Append one row per item to 'Refunds' tab (Monthly Sheet).
 *   3. Re-increment stock for each returned product via read-then-write.
 *   4. Append Audit_Log entry with event='REFUND'.
 *
 * All reads/writes go through the active DataAdapter — never directly to
 * lib/sheets/.
 *
 * Data models:
 *   Refunds (Monthly Sheet): id, transaction_id, product_id, product_name, qty, unit_price, reason, created_at
 *   Audit_Log (Master Sheet): id, event, data, created_at
 */

import { dataAdapter } from '../../lib/adapters'
import { nowUTC } from '../../lib/formatters'
import { generateId } from '../../lib/uuid'
import type { Transaction } from '../cashier/cashier.service'

// ─── Domain types ─────────────────────────────────────────────────────────────

export interface RefundItem {
  product_id: string
  product_name: string
  qty: number
  unit_price: number
}

export interface Refund {
  id: string
  transaction_id: string
  items: RefundItem[]
  total_amount: number
  reason: string
  created_at: string
}

// ─── Custom errors ─────────────────────────────────────────────────────────────

export class RefundError extends Error {
  readonly cause?: unknown
  constructor(message: string, cause?: unknown) {
    super(message)
    this.name = 'RefundError'
    this.cause = cause
  }
}

// ─── T037 — Refund operations ────────────────────────────────────────────────

/**
 * Fetches a transaction by ID from the 'Transactions' sheet.
 * Throws RefundError if not found (transaction may be in a different monthly sheet).
 */
export async function fetchTransaction(transactionId: string): Promise<Transaction> {
  const rows = await dataAdapter.getSheet('Transactions')
  const row = rows.find((r) => r['id'] === transactionId)
  if (!row) {
    throw new RefundError(`Transaksi dengan id "${transactionId}" tidak ditemukan`)
  }
  return {
    id: row['id'] as string,
    created_at: row['created_at'] as string,
    cashier_id: row['cashier_id'] as string,
    customer_id: (row['customer_id'] as string | null) ?? null,
    subtotal: Number(row['subtotal']),
    discount_type: (row['discount_type'] as 'flat' | 'percent' | null) ?? null,
    discount_value: Number(row['discount_value']),
    discount_amount: Number(row['discount_amount']),
    tax: Number(row['tax']),
    total: Number(row['total']),
    payment_method: row['payment_method'] as 'CASH' | 'QRIS' | 'SPLIT',
    cash_received: Number(row['cash_received']),
    change: Number(row['change']),
    receipt_number: row['receipt_number'] as string,
    notes: (row['notes'] as string | null) ?? null,
  }
}

/**
 * Creates a refund by:
 *   1. Validating refund total <= original transaction total.
 *   2. Appending one row per item to 'Refunds' tab.
 *   3. Re-incrementing stock for each returned product (read current stock + add qty back).
 *   4. Appending an Audit_Log entry with event='REFUND'.
 *
 * The read-then-write stock increment is not atomic, but acceptable for the
 * single-cashier MVP. Documented as a known trade-off.
 */
export async function createRefund(
  transactionId: string,
  items: RefundItem[],
  reason: string,
): Promise<Refund> {
  // Step 1: Load transaction and validate refund amount
  const transaction = await fetchTransaction(transactionId)
  const refundTotal = items.reduce((sum, item) => sum + item.qty * item.unit_price, 0)
  if (refundTotal > transaction.total) {
    throw new RefundError(
      `Jumlah refund (${refundTotal}) melebihi total transaksi asal (${transaction.total})`,
    )
  }

  const created_at = nowUTC()
  const refundId = generateId()

  // Step 2: Append one row per item to Refunds tab
  await Promise.all(
    items.map((item) =>
      dataAdapter.appendRow('Refunds', {
        id: generateId(),
        transaction_id: transactionId,
        product_id: item.product_id,
        product_name: item.product_name,
        qty: item.qty,
        unit_price: item.unit_price,
        reason,
        created_at,
      }),
    ),
  )

  // Step 3: Re-increment stock for each returned product
  const products = await dataAdapter.getSheet('Products')
  await Promise.all(
    items.map(async (item) => {
      const product = products.find((p) => p['id'] === item.product_id)
      if (product) {
        const newStock = Number(product['stock']) + item.qty
        await dataAdapter.updateCell('Products', item.product_id, 'stock', newStock)
      }
    }),
  )

  // Step 4: Append Audit_Log entry
  await dataAdapter.appendRow('Audit_Log', {
    id: generateId(),
    event: 'REFUND',
    data: JSON.stringify({ transactionId, items, reason }),
    created_at,
  })

  return {
    id: refundId,
    transaction_id: transactionId,
    items,
    total_amount: refundTotal,
    reason,
    created_at,
  }
}
