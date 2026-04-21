/**
 * inventory.service.test.ts — Unit tests for Phase 5 (T034 Stock Opname, T035 Purchase Orders).
 *
 * TDD: tests written first. All use vi.spyOn on getRepos() so no localStorage
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

function mockRepo(overrides = {}) {
  return {
    spreadsheetId: 'test-id',
    sheetName: 'mock',
    getAll: vi.fn().mockResolvedValue([]),
    batchInsert: vi.fn().mockResolvedValue(undefined),
    batchUpdate: vi.fn().mockResolvedValue(undefined),
    batchUpsert: vi.fn().mockResolvedValue(undefined),
    softDelete: vi.fn().mockResolvedValue(undefined),
    writeHeaders: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

let mockRepos: Record<string, ReturnType<typeof mockRepo>>

beforeEach(() => {
  vi.restoreAllMocks()
  mockRepos = {
    categories: mockRepo(),
    products: mockRepo(),
    variants: mockRepo(),
    members: mockRepo(),
    customers: mockRepo(),
    settings: mockRepo(),
    stockLog: mockRepo(),
    purchaseOrders: mockRepo(),
    purchaseOrderItems: mockRepo(),
    transactions: mockRepo(),
    transactionItems: mockRepo(),
    refunds: mockRepo(),
    stores: mockRepo(),
    monthlySheets: mockRepo(),
    auditLog: mockRepo(),
  }
  vi.spyOn(adapters, 'getRepos').mockReturnValue(mockRepos as ReturnType<typeof adapters.getRepos>)
})

// ─── T034 — Stock Opname ──────────────────────────────────────────────────────

describe('fetchStockOpnameData', () => {
  it('returns non-deleted products mapped to OpnameRow with system_stock = physical_count', async () => {
    mockRepos.products.getAll.mockResolvedValue([
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
    await saveOpnameResults([
      { product_id: 'p1', product_name: 'Nasi Goreng', sku: 'NASGOR', system_stock: 30, physical_count: 28 },
      { product_id: 'p2', product_name: 'Es Teh', sku: 'ESTEH', system_stock: 10, physical_count: 10 },
    ])

    // Only p1 changed (30 → 28); p2 is unchanged
    expect(mockRepos.products.batchUpdate).toHaveBeenCalledWith([
      { id: 'p1', stock: 28 },
    ])
  })

  it('appends Stock_Log entry with reason "opname" and correct before/after values', async () => {
    await saveOpnameResults([
      { product_id: 'p1', product_name: 'Nasi Goreng', sku: 'NASGOR', system_stock: 30, physical_count: 28 },
    ])

    expect(mockRepos.stockLog.batchInsert).toHaveBeenCalledTimes(1)
    const logRow = mockRepos.stockLog.batchInsert.mock.calls[0][0][0]
    expect(logRow['product_id']).toBe('p1')
    expect(logRow['reason']).toBe('opname')
    expect(logRow['qty_before']).toBe(30)
    expect(logRow['qty_after']).toBe(28)
  })

  it('skips products where physical count matches system count', async () => {
    await saveOpnameResults([
      { product_id: 'p1', product_name: 'Nasi Goreng', sku: 'NASGOR', system_stock: 10, physical_count: 10 },
      { product_id: 'p2', product_name: 'Es Teh', sku: 'ESTEH', system_stock: 5, physical_count: 5 },
    ])

    expect(mockRepos.products.batchUpdate).not.toHaveBeenCalled()
    expect(mockRepos.stockLog.batchInsert).not.toHaveBeenCalled()
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
    await createPurchaseOrder('Supplier ABC', [
      { product_id: 'p1', product_name: 'Nasi Goreng', qty: 50, cost_price: 8000 },
      { product_id: 'p2', product_name: 'Es Teh', qty: 100, cost_price: 3000 },
    ])

    expect(mockRepos.purchaseOrders.batchInsert).toHaveBeenCalledTimes(1)
    const orderRow = mockRepos.purchaseOrders.batchInsert.mock.calls[0][0][0]
    expect(orderRow['supplier']).toBe('Supplier ABC')
    expect(orderRow['status']).toBe('pending')

    expect(mockRepos.purchaseOrderItems.batchInsert).toHaveBeenCalledTimes(1)
    const poItems = mockRepos.purchaseOrderItems.batchInsert.mock.calls[0][0]
    expect(poItems).toHaveLength(2)
    expect(poItems[0]['product_id']).toBe('p1')
    expect(poItems[0]['qty']).toBe(50)
    expect(poItems[1]['product_id']).toBe('p2')
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
    mockRepos.purchaseOrders.getAll.mockResolvedValue([mockOrder])
    mockRepos.purchaseOrderItems.getAll.mockResolvedValue(mockItems)
    mockRepos.products.getAll.mockResolvedValue(mockProducts)

    await receivePurchaseOrder(orderId)

    const updates = mockRepos.products.batchUpdate.mock.calls[0][0]
    expect(updates).toHaveLength(2)
    // prod-1: 20 + 50 = 70
    expect(updates.find((u: { id: string }) => u.id === 'prod-1')?.['stock']).toBe(70)
    // prod-2: 10 + 100 = 110
    expect(updates.find((u: { id: string }) => u.id === 'prod-2')?.['stock']).toBe(110)
  })

  it('appends Stock_Log entry with reason "purchase_order" for each item', async () => {
    mockRepos.purchaseOrders.getAll.mockResolvedValue([mockOrder])
    mockRepos.purchaseOrderItems.getAll.mockResolvedValue(mockItems)
    mockRepos.products.getAll.mockResolvedValue(mockProducts)

    await receivePurchaseOrder(orderId)

    expect(mockRepos.stockLog.batchInsert).toHaveBeenCalledTimes(1)
    const logEntries = mockRepos.stockLog.batchInsert.mock.calls[0][0]
    expect(logEntries).toHaveLength(2)
    expect(logEntries[0]['reason']).toBe('purchase_order')
    expect(logEntries[0]['qty_before']).toBe(20)
    expect(logEntries[0]['qty_after']).toBe(70)
  })

  it('throws InventoryError if order status is already "received"', async () => {
    mockRepos.purchaseOrders.getAll.mockResolvedValue([{ ...mockOrder, status: 'received' }])

    await expect(receivePurchaseOrder(orderId)).rejects.toThrow(InventoryError)
  })
})
