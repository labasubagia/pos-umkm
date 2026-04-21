import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as adapters from '../../lib/adapters'
import {
  aggregateTransactions,
  fetchDailySummary,
  fetchTransactionsForRange,
  filterTransactions,
  calculateGrossProfit,
  calculateExpectedCash,
  saveReconciliation,
  ReportError,
  TransactionRow,
  TransactionItemRow,
} from './reports.service'

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

// ─── T038 — aggregateTransactions ────────────────────────────────────────────

const tx1: TransactionRow = {
  id: 'tx-1',
  created_at: '2026-06-01T08:00:00.000Z',
  cashier_id: 'owner@test.com',
  payment_method: 'CASH',
  total: 30000,
  cash_received: 30000,
}
const tx2: TransactionRow = {
  id: 'tx-2',
  created_at: '2026-06-01T10:00:00.000Z',
  cashier_id: 'owner@test.com',
  payment_method: 'QRIS',
  total: 20000,
  cash_received: 0,
}
const txOtherDay: TransactionRow = {
  id: 'tx-3',
  created_at: '2026-06-02T08:00:00.000Z',
  cashier_id: 'owner@test.com',
  payment_method: 'CASH',
  total: 15000,
  cash_received: 15000,
}

const items: TransactionItemRow[] = [
  { id: 'i-1', transaction_id: 'tx-1', product_id: 'p-1', name: 'Nasi Goreng', price: 15000, quantity: 2, subtotal: 30000 },
  { id: 'i-2', transaction_id: 'tx-2', product_id: 'p-2', name: 'Es Teh', price: 5000, quantity: 4, subtotal: 20000 },
  { id: 'i-3', transaction_id: 'tx-3', product_id: 'p-1', name: 'Nasi Goreng', price: 15000, quantity: 1, subtotal: 15000 },
]

describe('aggregateTransactions', () => {
  it('returns correct total revenue', () => {
    const result = aggregateTransactions([tx1, tx2, txOtherDay], items, '2026-06-01')
    expect(result.total_revenue).toBe(50000)
  })

  it('returns correct transaction count', () => {
    const result = aggregateTransactions([tx1, tx2, txOtherDay], items, '2026-06-01')
    expect(result.transaction_count).toBe(2)
  })

  it('returns correct top 5 products by quantity', () => {
    const manyItems: TransactionItemRow[] = [
      { id: 'i-a', transaction_id: 'tx-1', product_id: 'p-a', name: 'Prod A', price: 1000, quantity: 10, subtotal: 10000 },
      { id: 'i-b', transaction_id: 'tx-1', product_id: 'p-b', name: 'Prod B', price: 1000, quantity: 9, subtotal: 9000 },
      { id: 'i-c', transaction_id: 'tx-1', product_id: 'p-c', name: 'Prod C', price: 1000, quantity: 8, subtotal: 8000 },
      { id: 'i-d', transaction_id: 'tx-1', product_id: 'p-d', name: 'Prod D', price: 1000, quantity: 7, subtotal: 7000 },
      { id: 'i-e', transaction_id: 'tx-1', product_id: 'p-e', name: 'Prod E', price: 1000, quantity: 6, subtotal: 6000 },
      { id: 'i-f', transaction_id: 'tx-1', product_id: 'p-f', name: 'Prod F', price: 1000, quantity: 5, subtotal: 5000 },
    ]
    const result = aggregateTransactions([tx1], manyItems, '2026-06-01')
    expect(result.top_products).toHaveLength(5)
    expect(result.top_products[0].product_id).toBe('p-a')
    expect(result.top_products[4].product_id).toBe('p-e')
  })

  it('returns correct average basket size', () => {
    const result = aggregateTransactions([tx1, tx2], items, '2026-06-01')
    expect(result.average_basket).toBe(25000)
  })

  it('returns 0 values for a day with no transactions', () => {
    const result = aggregateTransactions([tx1, tx2], items, '2026-07-01')
    expect(result.total_revenue).toBe(0)
    expect(result.transaction_count).toBe(0)
    expect(result.average_basket).toBe(0)
    expect(result.top_products).toHaveLength(0)
  })
})

describe('fetchDailySummary', () => {
  it('throws ReportError if monthly sheet does not exist yet', async () => {
    mockRepos.transactions.getAll.mockResolvedValue([])
    mockRepos.transactionItems.getAll.mockResolvedValue([])
    await expect(fetchDailySummary('2026-06-01')).rejects.toBeInstanceOf(ReportError)
  })
})

// ─── T039 — fetchTransactionsForRange / filterTransactions ───────────────────

describe('fetchTransactionsForRange', () => {
  it('fetches single monthly sheet for same-month range', async () => {
    mockRepos.transactions.getAll.mockResolvedValue([
      { id: 'tx-1', created_at: '2026-06-15T10:00:00.000Z', cashier_id: 'a@b.com', payment_method: 'CASH', total: 10000, cash_received: 10000 },
    ])
    const result = await fetchTransactionsForRange('2026-06-01', '2026-06-30')
    expect(mockRepos.transactions.getAll).toHaveBeenCalledTimes(1)
    expect(result).toHaveLength(1)
  })

  it('fetches and merges two monthly sheets for cross-month range', async () => {
    mockRepos.transactions.getAll
      .mockResolvedValueOnce([
        { id: 'tx-1', created_at: '2026-06-20T10:00:00.000Z', cashier_id: 'a@b.com', payment_method: 'CASH', total: 10000, cash_received: 10000 },
      ])
      .mockResolvedValueOnce([
        { id: 'tx-2', created_at: '2026-07-05T10:00:00.000Z', cashier_id: 'a@b.com', payment_method: 'QRIS', total: 20000, cash_received: 0 },
      ])
    const result = await fetchTransactionsForRange('2026-06-15', '2026-07-10')
    expect(mockRepos.transactions.getAll).toHaveBeenCalledTimes(2)
    expect(result).toHaveLength(2)
  })

  it('throws if startDate is after endDate', async () => {
    await expect(fetchTransactionsForRange('2026-07-01', '2026-06-01')).rejects.toBeInstanceOf(ReportError)
  })
})

describe('filterTransactions', () => {
  const txList: TransactionRow[] = [
    { id: 'tx-1', created_at: '2026-06-01T08:00:00.000Z', cashier_id: 'alice@test.com', payment_method: 'CASH', total: 10000, cash_received: 10000 },
    { id: 'tx-2', created_at: '2026-06-01T09:00:00.000Z', cashier_id: 'bob@test.com', payment_method: 'QRIS', total: 20000, cash_received: 0 },
    { id: 'tx-3', created_at: '2026-06-01T10:00:00.000Z', cashier_id: 'alice@test.com', payment_method: 'CASH', total: 15000, cash_received: 15000 },
  ]

  it('filters by cashier email correctly', () => {
    const result = filterTransactions(txList, { cashier_email: 'alice@test.com' })
    expect(result).toHaveLength(2)
    expect(result.every((t) => t.cashier_id === 'alice@test.com')).toBe(true)
  })

  it('filters by payment method correctly', () => {
    const result = filterTransactions(txList, { payment_method: 'QRIS' })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('tx-2')
  })
})

// ─── T040 — calculateGrossProfit ─────────────────────────────────────────────

describe('calculateGrossProfit', () => {
  const txs: TransactionRow[] = [
    { id: 'tx-1', created_at: '2026-06-01T08:00:00.000Z', cashier_id: 'a@b.com', payment_method: 'CASH', total: 30000, cash_received: 30000 },
  ]

  it('returns correct margin for a single item', () => {
    const items: TransactionItemRow[] = [
      { id: 'i-1', transaction_id: 'tx-1', product_id: 'p-1', name: 'Nasi Goreng', price: 15000, quantity: 2, subtotal: 30000 },
    ]
    const products = [{ id: 'p-1', cost_price: 8000 }]
    const result = calculateGrossProfit(txs, items, products)
    expect(result.total_revenue).toBe(30000)
    expect(result.total_cost).toBe(16000)
    expect(result.gross_profit).toBe(14000)
    expect(result.margin_percent).toBeCloseTo(46.7, 0)
  })

  it('returns correct total across multiple items', () => {
    const items: TransactionItemRow[] = [
      { id: 'i-1', transaction_id: 'tx-1', product_id: 'p-1', name: 'Prod A', price: 10000, quantity: 1, subtotal: 10000 },
      { id: 'i-2', transaction_id: 'tx-1', product_id: 'p-2', name: 'Prod B', price: 5000, quantity: 2, subtotal: 10000 },
    ]
    const products = [{ id: 'p-1', cost_price: 6000 }, { id: 'p-2', cost_price: 3000 }]
    const result = calculateGrossProfit(txs, items, products)
    expect(result.total_revenue).toBe(20000)
    expect(result.total_cost).toBe(12000)
    expect(result.gross_profit).toBe(8000)
  })

  it('returns 0 profit for items with no cost price set', () => {
    const items: TransactionItemRow[] = [
      { id: 'i-1', transaction_id: 'tx-1', product_id: 'p-1', name: 'Prod A', price: 10000, quantity: 1, subtotal: 10000 },
    ]
    const products = [{ id: 'p-1', cost_price: 0 }]
    const result = calculateGrossProfit(txs, items, products)
    expect(result.gross_profit).toBe(10000)
    expect(result.total_cost).toBe(0)
  })

  it('handles product that was deleted (cost_price unknown) gracefully', () => {
    const items: TransactionItemRow[] = [
      { id: 'i-1', transaction_id: 'tx-1', product_id: 'p-deleted', name: 'Old Prod', price: 10000, quantity: 1, subtotal: 10000 },
    ]
    const products: Array<{ id: string; cost_price: number }> = []
    const result = calculateGrossProfit(txs, items, products)
    expect(result.total_cost).toBe(0)
    expect(result.gross_profit).toBe(10000)
  })
})

// ─── T041 — calculateExpectedCash / saveReconciliation ───────────────────────

describe('calculateExpectedCash', () => {
  it('calculates opening + cash sales - cash refunds', () => {
    const txs: TransactionRow[] = [
      { id: 'tx-1', created_at: '2026-06-01T08:00:00.000Z', cashier_id: 'a@b.com', payment_method: 'CASH', total: 30000, cash_received: 30000 },
      { id: 'tx-2', created_at: '2026-06-01T09:00:00.000Z', cashier_id: 'a@b.com', payment_method: 'SPLIT', total: 20000, cash_received: 10000 },
    ]
    const refunds = [{ amount: 5000, payment_method: 'CASH' }]
    const result = calculateExpectedCash(100000, txs, refunds)
    expect(result).toBe(135000) // 100000 + 30000 + 10000 - 5000
  })

  it('excludes QRIS and transfer transactions', () => {
    const txs: TransactionRow[] = [
      { id: 'tx-1', created_at: '2026-06-01T08:00:00.000Z', cashier_id: 'a@b.com', payment_method: 'QRIS', total: 50000, cash_received: 0 },
    ]
    const result = calculateExpectedCash(100000, txs, [])
    expect(result).toBe(100000)
  })
})

describe('saveReconciliation', () => {
  it('appends Audit_Log entry with surplus/deficit', async () => {
    await saveReconciliation(100000, 105000, '2026-06-01')
    expect(mockRepos.auditLog.batchInsert).toHaveBeenCalledOnce()
    const row = mockRepos.auditLog.batchInsert.mock.calls[0][0][0]
    expect(row['event']).toBe('CASH_RECONCILIATION')
    const data = JSON.parse(row['data'] as string)
    expect(data.expected).toBe(100000)
    expect(data.actual).toBe(105000)
    expect(data.surplus_deficit).toBe(5000)
  })

  it('throws if actual closing balance is negative', async () => {
    await expect(saveReconciliation(100000, -1, '2026-06-01')).rejects.toBeInstanceOf(ReportError)
  })
})
