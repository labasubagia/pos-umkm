/**
 * inventory.service.ts — Inventory management business logic.
 *
 * Covers:
 *   T034 — Stock Opname (physical stock count vs system stock)
 *   T035 — Purchase Orders (incoming stock from suppliers)
 *
 * All reads/writes go through the active DataAdapter — never directly to
 * lib/sheets/. Data model (Master Sheet tabs):
 *   Products:             id, name, sku, stock, … (shared with catalog)
 *   Stock_Log:            id, product_id, reason, qty_before, qty_after, created_at
 *   Purchase_Orders:      id, supplier, status, created_at
 *   Purchase_Order_Items: id, order_id, product_id, product_name, qty, cost_price, created_at
 */

import { getRepos } from '../../lib/adapters'
import { generateId } from '../../lib/uuid'
import { nowUTC } from '../../lib/formatters'

// ─── Custom errors ─────────────────────────────────────────────────────────────

export class InventoryError extends Error {
  readonly cause?: unknown
  constructor(message: string, cause?: unknown) {
    super(message)
    this.name = 'InventoryError'
    this.cause = cause
  }
}

// ─── Domain types ─────────────────────────────────────────────────────────────

/**
 * One row in the stock opname table.
 * system_stock is what the sheet currently holds;
 * physical_count is what the owner actually counted in the warehouse.
 */
export interface OpnameRow {
  product_id: string
  product_name: string
  sku: string
  system_stock: number
  physical_count: number
}

/** A supplier purchase order header. */
export interface PurchaseOrder {
  id: string
  supplier: string
  status: 'pending' | 'received'
  created_at: string
}

/** One line item within a purchase order. */
export interface PurchaseOrderItem {
  product_id: string
  product_name: string
  qty: number
  cost_price: number
}

/** Stored purchase order item row (includes IDs and timestamps). */
export interface PurchaseOrderItemRow extends PurchaseOrderItem {
  id: string
  order_id: string
  created_at: string
}

// ─── T034 — Stock Opname ──────────────────────────────────────────────────────

/**
 * Fetches all non-deleted products from the Products tab and maps them to
 * OpnameRow objects. physical_count is pre-filled with system_stock so the
 * owner only needs to edit the rows that differ.
 */
export async function fetchStockOpnameData(): Promise<OpnameRow[]> {
  const rows = await getRepos().products.getAll()
  return rows
    .filter((r) => r['name']) // skip sentinel rows
    .map((r) => ({
      product_id: r['id'] as string,
      product_name: r['name'] as string,
      sku: (r['sku'] as string) ?? '',
      system_stock: Number(r['stock']),
      physical_count: Number(r['stock']),
    }))
}

/**
 * Saves stock opname results.
 *
 * For each row where physical_count differs from system_stock:
 *   1. Updates the stock cell on the Products tab.
 *   2. Appends a Stock_Log entry with reason "opname".
 *
 * Rows where the counts are equal are skipped to avoid unnecessary API calls.
 * All updates are run with Promise.all per changed row — this is acceptable
 * because opname is a deliberate, low-frequency operation (not cashier hot path).
 *
 * Throws InventoryError if any physical count is negative.
 */
export async function saveOpnameResults(results: OpnameRow[]): Promise<void> {
  // Validate before any writes — fail fast on bad input
  for (const row of results) {
    if (row.physical_count < 0) {
      throw new InventoryError(
        `Jumlah fisik tidak boleh negatif untuk produk "${row.product_name}"`,
      )
    }
  }

  const changed = results.filter((r) => r.physical_count !== r.system_stock)
  if (changed.length === 0) return

  // Batch all stock writes in one round-trip, then append log entries in parallel.
  const created_at = nowUTC()
  await Promise.all([
    getRepos().products.batchUpdateCells(
      changed.map((row) => ({ rowId: row.product_id, column: 'stock', value: row.physical_count })),
    ),
    ...changed.map((row) =>
      getRepos().stockLog.append( {
        id: generateId(),
        product_id: row.product_id,
        reason: 'opname',
        qty_before: row.system_stock,
        qty_after: row.physical_count,
        created_at,
      }),
    ),
  ])
}

// ─── T035 — Purchase Orders ───────────────────────────────────────────────────

/**
 * Creates a new purchase order in the pending state.
 *
 * Appends one row to Purchase_Orders and one row per item to
 * Purchase_Order_Items. All items share the same order_id so they can be
 * fetched together when the order is received.
 */
export async function createPurchaseOrder(
  supplier: string,
  items: PurchaseOrderItem[],
): Promise<PurchaseOrder> {
  if (!supplier || supplier.trim().length === 0) {
    throw new InventoryError('Nama supplier tidak boleh kosong')
  }
  if (items.length === 0) {
    throw new InventoryError('Purchase order harus memiliki minimal 1 item')
  }

  const orderId = generateId()
  const created_at = nowUTC()

  await getRepos().purchaseOrders.append( {
    id: orderId,
    supplier: supplier.trim(),
    status: 'pending',
    created_at,
  })

  await Promise.all(
    items.map((item) =>
      getRepos().purchaseOrderItems.append( {
        id: generateId(),
        order_id: orderId,
        product_id: item.product_id,
        product_name: item.product_name,
        qty: item.qty,
        cost_price: item.cost_price,
        created_at,
      }),
    ),
  )

  return { id: orderId, supplier: supplier.trim(), status: 'pending', created_at }
}

/**
 * Marks a purchase order as received and increases stock for each ordered product.
 *
 * Steps:
 *   1. Validate order exists and is not already received.
 *   2. For each item, read current stock and compute new value.
 *   3. Write updated stock to Products tab.
 *   4. Append Stock_Log entry with reason "purchase_order".
 *   5. Update order status to "received".
 *
 * This is a multi-step write sequence. If a stock update fails mid-way,
 * the order status is not yet updated — the cashier can safely retry.
 * This is the same fault-tolerance pattern as T032 (commitTransaction).
 */
export async function receivePurchaseOrder(orderId: string): Promise<void> {
  // Step 1: Load order and validate state
  const orders = await getRepos().purchaseOrders.getAll()
  const order = orders.find((o) => o['id'] === orderId)
  if (!order) {
    throw new InventoryError(`Purchase order "${orderId}" tidak ditemukan`)
  }
  if (order['status'] === 'received') {
    throw new InventoryError(
      `Purchase order "${orderId}" sudah berstatus "received" dan tidak dapat diproses ulang`,
    )
  }

  // Step 2: Load order items and current product stocks
  const [allItems, products] = await Promise.all([
    getRepos().purchaseOrderItems.getAll(),
    getRepos().products.getAll(),
  ])

  const orderItems = (allItems.filter(
    (i) => i['order_id'] === orderId,
  ) as unknown) as PurchaseOrderItemRow[]

  // Compute all new stock values and validate products exist
  const created_at = nowUTC()
  const stockData = orderItems.map((item) => {
    const product = products.find((p) => p['id'] === item['product_id'])
    if (!product) {
      throw new InventoryError(
        `Produk dengan id "${item['product_id']}" tidak ditemukan saat menerima purchase order`,
      )
    }
    const qtyBefore = Number(product['stock'])
    const qtyAfter = qtyBefore + Number(item['qty'])
    return { item, qtyBefore, qtyAfter }
  })

  // Steps 3 & 4: Batch all stock updates in one round-trip + append logs in parallel
  await Promise.all([
    getRepos().products.batchUpdateCells(
      stockData.map(({ item, qtyAfter }) => ({
        rowId: item['product_id'] as string,
        column: 'stock',
        value: qtyAfter,
      })),
    ),
    ...stockData.map(({ item, qtyBefore, qtyAfter }) =>
      getRepos().stockLog.append( {
        id: generateId(),
        product_id: item['product_id'],
        reason: 'purchase_order',
        qty_before: qtyBefore,
        qty_after: qtyAfter,
        created_at,
      }),
    ),
  ])

  // Step 5: Mark order as received only after all stock updates succeed
  await getRepos().purchaseOrders.updateCell(orderId, 'status', 'received')
}

/**
 * Fetches all purchase orders (including received), sorted newest first.
 * Used to display the purchase order list in PurchaseOrders.tsx.
 */
export async function fetchPurchaseOrders(): Promise<PurchaseOrder[]> {
  const rows = await getRepos().purchaseOrders.getAll()
  return rows
    .filter((r) => r['supplier'])
    .map((r) => ({
      id: r['id'] as string,
      supplier: r['supplier'] as string,
      status: r['status'] as 'pending' | 'received',
      created_at: r['created_at'] as string,
    }))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
}

/**
 * Fetches all items for a given purchase order.
 */
export async function fetchPurchaseOrderItems(orderId: string): Promise<PurchaseOrderItemRow[]> {
  const rows = await getRepos().purchaseOrderItems.getAll()
  return rows
    .filter((r) => r['order_id'] === orderId)
    .map((r) => ({
      id: r['id'] as string,
      order_id: r['order_id'] as string,
      product_id: r['product_id'] as string,
      product_name: r['product_name'] as string,
      qty: Number(r['qty']),
      cost_price: Number(r['cost_price']),
      created_at: r['created_at'] as string,
    }))
}
