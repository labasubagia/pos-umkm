/**
 * inventory.service.test.ts — Unit tests for Phase 5 (T034 Stock Opname, T035 Purchase Orders).
 *
 * TDD: tests written first. All use vi.spyOn on dataAdapter so no localStorage
 * or Sheets API is touched. The adapter is stubbed per test case.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as adapters from '../../lib/adapters'
import {
  fetchStockOpnameData,
  saveOpnameResults,
  createPurchaseOrder,
  receivePurchaseOrder,
  InventoryError,
} from './inventory.service'

beforeEach(() => {
  vi.restoreAllMocks()
})

// ─── T034 — Stock Opname ──────────────────────────────────────────────────────

describe('fetchStockOpnameData', () => {
  it('returns non-deleted products mapped to OpnameRow with system_stock = physical_count', async () => {
    vi.spyOn(adapters.dataAdapter, 'getSheet').mockResolvedValue([
      {
        id: 'prod-1',
        name: 'Nasi Goreng',
        sku: 'NASGOR',
        price: 15000,
        stock: 30,
        has_variants: false,
        category_id: 'cat-1',
        created_at: '2026-01-01T00:00:00.000Z',
        deleted_at: null,
      },
      {
        id: 'prod-2',
        name: 'Es Teh',
        sku: 'ESTEH',
        price: 5000,
        stock: 12,
        has_variants: false,
        category_id: 'cat-1',
        created_at: '2026-01-01T00:00:00.000Z',
        deleted_at: null,
      },
    ])

    const result = await fetchStockOpnameData()

    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({
      product_id: 'prod-1',
      product_name: 'Nasi Goreng',
      sku: 'NASGOR',
      system_stock: 30,
      physical_count: 30,
    })
    expect(result[1]).toMatchObject({
      product_id: 'prod-2',
      system_stock: 12,
      physical_count: 12,
    })
  })
})

describe('saveOpnameResults', () => {
  it('updates stock for each product where physical count differs from system stock', async () => {
    const batchUpdateSpy = vi.spyOn(adapters.dataAdapter, 'batchUpdateCells').mockResolvedValue()
    vi.spyOn(adapters.dataAdapter, 'appendRow').mockResolvedValue()

    await saveOpnameResults([
      { product_id: 'p1', product_name: 'Nasi Goreng', sku: 'NASGOR', system_stock: 30, physical_count: 28 },
      { product_id: 'p2', product_name: 'Es Teh', sku: 'ESTEH', system_stock: 10, physical_count: 10 },
    ])

    // Only p1 changed (30 → 28); p2 is unchanged
    expect(batchUpdateSpy).toHaveBeenCalledWith('Products', [
      { rowId: 'p1', column: 'stock', value: 28 },
    ])
  })

  it('appends Stock_Log entry with reason "opname" and correct before/after values', async () => {
    vi.spyOn(adapters.dataAdapter, 'batchUpdateCells').mockResolvedValue()
    const appendRowSpy = vi.spyOn(adapters.dataAdapter, 'appendRow').mockResolvedValue()

    await saveOpnameResults([
      { product_id: 'p1', product_name: 'Nasi Goreng', sku: 'NASGOR', system_stock: 30, physical_count: 28 },
    ])

    const logCalls = appendRowSpy.mock.calls.filter(([sheet]) => sheet === 'Stock_Log')
    expect(logCalls).toHaveLength(1)
    const logRow = logCalls[0][1]
    expect(logRow['product_id']).toBe('p1')
    expect(logRow['reason']).toBe('opname')
    expect(logRow['qty_before']).toBe(30)
    expect(logRow['qty_after']).toBe(28)
  })

  it('skips products where physical count matches system count', async () => {
    const batchUpdateSpy = vi.spyOn(adapters.dataAdapter, 'batchUpdateCells').mockResolvedValue()
    const appendRowSpy = vi.spyOn(adapters.dataAdapter, 'appendRow').mockResolvedValue()

    await saveOpnameResults([
      { product_id: 'p1', product_name: 'Nasi Goreng', sku: 'NASGOR', system_stock: 10, physical_count: 10 },
      { product_id: 'p2', product_name: 'Es Teh', sku: 'ESTEH', system_stock: 5, physical_count: 5 },
    ])

    expect(batchUpdateSpy).not.toHaveBeenCalled()
    expect(appendRowSpy).not.toHaveBeenCalled()
  })

  it('throws InventoryError if physical count is negative', async () => {
    await expect(
      saveOpnameResults([
        { product_id: 'p1', product_name: 'Nasi Goreng', sku: 'NASGOR', system_stock: 10, physical_count: -1 },
      ]),
    ).rejects.toThrow(InventoryError)
  })
})

// ─── T035 — Purchase Orders ───────────────────────────────────────────────────

describe('createPurchaseOrder', () => {
  it('appends to Purchase_Orders and Purchase_Order_Items tabs', async () => {
    const appendRowSpy = vi.spyOn(adapters.dataAdapter, 'appendRow').mockResolvedValue()

    await createPurchaseOrder('Supplier ABC', [
      { product_id: 'p1', product_name: 'Nasi Goreng', qty: 50, cost_price: 8000 },
      { product_id: 'p2', product_name: 'Es Teh', qty: 100, cost_price: 3000 },
    ])

    const orderCalls = appendRowSpy.mock.calls.filter(([sheet]) => sheet === 'Purchase_Orders')
    const itemCalls = appendRowSpy.mock.calls.filter(([sheet]) => sheet === 'Purchase_Order_Items')

    expect(orderCalls).toHaveLength(1)
    expect(orderCalls[0][1]['supplier']).toBe('Supplier ABC')
    expect(orderCalls[0][1]['status']).toBe('pending')

    expect(itemCalls).toHaveLength(2)
    expect(itemCalls[0][1]['product_id']).toBe('p1')
    expect(itemCalls[0][1]['qty']).toBe(50)
    expect(itemCalls[1][1]['product_id']).toBe('p2')
  })
})

describe('receivePurchaseOrder', () => {
  const orderId = 'order-1'

  const mockOrder = {
    id: orderId,
    supplier: 'Supplier ABC',
    status: 'pending',
    created_at: '2026-01-01T00:00:00.000Z',
  }

  const mockItems = [
    { id: 'item-1', order_id: orderId, product_id: 'prod-1', product_name: 'Nasi Goreng', qty: 50, cost_price: 8000, created_at: '2026-01-01T00:00:00.000Z' },
    { id: 'item-2', order_id: orderId, product_id: 'prod-2', product_name: 'Es Teh', qty: 100, cost_price: 3000, created_at: '2026-01-01T00:00:00.000Z' },
  ]

  const mockProducts = [
    { id: 'prod-1', name: 'Nasi Goreng', stock: 20, sku: 'NASGOR', price: 15000, has_variants: false, category_id: 'cat-1', created_at: '2026-01-01T00:00:00.000Z', deleted_at: null },
    { id: 'prod-2', name: 'Es Teh', stock: 10, sku: 'ESTEH', price: 5000, has_variants: false, category_id: 'cat-1', created_at: '2026-01-01T00:00:00.000Z', deleted_at: null },
  ]

  it('increments stock for each item in the purchase order', async () => {
    vi.spyOn(adapters.dataAdapter, 'getSheet').mockImplementation(async (sheet) => {
      if (sheet === 'Purchase_Orders') return [mockOrder]
      if (sheet === 'Purchase_Order_Items') return mockItems
      if (sheet === 'Products') return mockProducts
      return []
    })
    const batchSpy = vi.spyOn(adapters.dataAdapter, 'batchUpdateCells').mockResolvedValue()
    vi.spyOn(adapters.dataAdapter, 'updateCell').mockResolvedValue()
    vi.spyOn(adapters.dataAdapter, 'appendRow').mockResolvedValue()

    await receivePurchaseOrder(orderId)

    const batchCalls = batchSpy.mock.calls.find(([sheet]) => sheet === 'Products')
    expect(batchCalls).toBeTruthy()
    const updates = batchCalls![1]
    expect(updates).toHaveLength(2)
    // prod-1: 20 + 50 = 70
    expect(updates.find((u: { rowId: string }) => u.rowId === 'prod-1')?.value).toBe(70)
    // prod-2: 10 + 100 = 110
    expect(updates.find((u: { rowId: string }) => u.rowId === 'prod-2')?.value).toBe(110)
  })

  it('appends Stock_Log entry with reason "purchase_order" for each item', async () => {
    vi.spyOn(adapters.dataAdapter, 'getSheet').mockImplementation(async (sheet) => {
      if (sheet === 'Purchase_Orders') return [mockOrder]
      if (sheet === 'Purchase_Order_Items') return mockItems
      if (sheet === 'Products') return mockProducts
      return []
    })
    vi.spyOn(adapters.dataAdapter, 'batchUpdateCells').mockResolvedValue()
    vi.spyOn(adapters.dataAdapter, 'updateCell').mockResolvedValue()
    const appendRowSpy = vi.spyOn(adapters.dataAdapter, 'appendRow').mockResolvedValue()

    await receivePurchaseOrder(orderId)

    const logCalls = appendRowSpy.mock.calls.filter(([sheet]) => sheet === 'Stock_Log')
    expect(logCalls).toHaveLength(2)
    expect(logCalls[0][1]['reason']).toBe('purchase_order')
    expect(logCalls[0][1]['qty_before']).toBe(20)
    expect(logCalls[0][1]['qty_after']).toBe(70)
  })

  it('throws InventoryError if order status is already "received"', async () => {
    vi.spyOn(adapters.dataAdapter, 'getSheet').mockImplementation(async (sheet) => {
      if (sheet === 'Purchase_Orders') return [{ ...mockOrder, status: 'received' }]
      if (sheet === 'Purchase_Order_Items') return mockItems
      return []
    })

    await expect(receivePurchaseOrder(orderId)).rejects.toThrow(InventoryError)
  })
})
