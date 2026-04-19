/**
 * refund.service tests — covers T037 (Refund / Return Flow).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as adapters from '../../lib/adapters'
import { createRefund, fetchTransaction, RefundError } from './refund.service'

beforeEach(() => {
  vi.restoreAllMocks()
})

const TRANSACTION_ROW = {
  id: 'tx-001',
  created_at: '2026-01-01T10:00:00.000Z',
  cashier_id: 'user-1',
  customer_id: null,
  subtotal: 30000,
  discount_type: null,
  discount_value: 0,
  discount_amount: 0,
  tax: 0,
  total: 30000,
  payment_method: 'CASH',
  cash_received: 50000,
  change: 20000,
  receipt_number: 'INV/2026/001',
  notes: null,
}

const PRODUCT_ROW = {
  id: 'prod-1',
  name: 'Nasi Goreng',
  stock: 18,
  price: 15000,
  category_id: 'cat-1',
  sku: 'NASGOR',
  has_variants: false,
  created_at: '2026-01-01T00:00:00.000Z',
  deleted_at: null,
}

const REFUND_ITEM = {
  product_id: 'prod-1',
  product_name: 'Nasi Goreng',
  qty: 2,
  unit_price: 15000,
}

// ─── fetchTransaction ─────────────────────────────────────────────────────────

describe('fetchTransaction', () => {
  it('returns the transaction when found', async () => {
    vi.spyOn(adapters.dataAdapter, 'getSheet').mockResolvedValue([TRANSACTION_ROW])

    const tx = await fetchTransaction('tx-001')

    expect(tx.id).toBe('tx-001')
    expect(tx.total).toBe(30000)
  })

  it('throws RefundError when transaction not found', async () => {
    vi.spyOn(adapters.dataAdapter, 'getSheet').mockResolvedValue([])

    await expect(fetchTransaction('tx-999')).rejects.toThrow(RefundError)
  })
})

// ─── createRefund ─────────────────────────────────────────────────────────────

describe('createRefund', () => {
  it('appends row to Refunds tab', async () => {
    vi.spyOn(adapters.dataAdapter, 'getSheet').mockImplementation((sheet) => {
      if (sheet === 'Transactions') return Promise.resolve([TRANSACTION_ROW])
      if (sheet === 'Products') return Promise.resolve([PRODUCT_ROW])
      return Promise.resolve([])
    })
    const appendSpy = vi.spyOn(adapters.dataAdapter, 'appendRow').mockResolvedValue()
    vi.spyOn(adapters.dataAdapter, 'batchUpdateCells').mockResolvedValue()

    await createRefund('tx-001', [REFUND_ITEM], 'Produk rusak')

    // Should have appended to Refunds once and Audit_Log once
    const refundCall = appendSpy.mock.calls.find((c) => c[0] === 'Refunds')
    expect(refundCall).toBeTruthy()
    expect(refundCall![1]).toMatchObject({
      transaction_id: 'tx-001',
      product_id: 'prod-1',
      product_name: 'Nasi Goreng',
      qty: 2,
      unit_price: 15000,
      reason: 'Produk rusak',
    })
  })

  it('re-increments stock for each returned product', async () => {
    vi.spyOn(adapters.dataAdapter, 'getSheet').mockImplementation((sheet) => {
      if (sheet === 'Transactions') return Promise.resolve([TRANSACTION_ROW])
      if (sheet === 'Products') return Promise.resolve([PRODUCT_ROW])
      return Promise.resolve([])
    })
    vi.spyOn(adapters.dataAdapter, 'appendRow').mockResolvedValue()
    const batchSpy = vi.spyOn(adapters.dataAdapter, 'batchUpdateCells').mockResolvedValue()

    await createRefund('tx-001', [REFUND_ITEM], 'Produk rusak')

    // Stock was 18, returning 2 → should be updated to 20
    const batchCalls = batchSpy.mock.calls.find(([sheet]) => sheet === 'Products')
    expect(batchCalls).toBeTruthy()
    expect(batchCalls![1]).toContainEqual({ rowId: 'prod-1', column: 'stock', value: 20 })
  })

  it('appends Audit_Log entry with event=REFUND', async () => {
    vi.spyOn(adapters.dataAdapter, 'getSheet').mockImplementation((sheet) => {
      if (sheet === 'Transactions') return Promise.resolve([TRANSACTION_ROW])
      if (sheet === 'Products') return Promise.resolve([PRODUCT_ROW])
      return Promise.resolve([])
    })
    const appendSpy = vi.spyOn(adapters.dataAdapter, 'appendRow').mockResolvedValue()
    vi.spyOn(adapters.dataAdapter, 'batchUpdateCells').mockResolvedValue()

    await createRefund('tx-001', [REFUND_ITEM], 'Produk rusak')

    const auditCall = appendSpy.mock.calls.find((c) => c[0] === 'Audit_Log')
    expect(auditCall).toBeTruthy()
    expect(auditCall![1]).toMatchObject({ event: 'REFUND' })
    const data = JSON.parse(auditCall![1]['data'] as string)
    expect(data.transactionId).toBe('tx-001')
    expect(data.reason).toBe('Produk rusak')
  })

  it('throws RefundError if transaction not found', async () => {
    vi.spyOn(adapters.dataAdapter, 'getSheet').mockResolvedValue([])

    await expect(createRefund('tx-999', [REFUND_ITEM], 'test')).rejects.toThrow(RefundError)
  })

  it('throws RefundError if refund amount exceeds original transaction total', async () => {
    vi.spyOn(adapters.dataAdapter, 'getSheet').mockImplementation((sheet) => {
      if (sheet === 'Transactions') return Promise.resolve([TRANSACTION_ROW])
      if (sheet === 'Products') return Promise.resolve([PRODUCT_ROW])
      return Promise.resolve([])
    })

    // 3 items × 15000 = 45000 > 30000 (original total)
    const bigRefund = [{ ...REFUND_ITEM, qty: 3 }]
    await expect(createRefund('tx-001', bigRefund, 'test')).rejects.toThrow(RefundError)
  })
})
