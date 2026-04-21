/**
 * customers.service tests — covers T036 (Customer Management).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as adapters from '../../lib/adapters'
import {
  fetchCustomers,
  addCustomer,
  updateCustomer,
  CustomerError,
} from './customers.service'

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

// ─── fetchCustomers ───────────────────────────────────────────────────────────

describe('fetchCustomers', () => {
  it('returns non-deleted customers', async () => {
    mockRepos.customers.getAll.mockResolvedValue([
      { id: 'cus-1', name: 'Budi Santoso', phone: '08111234567', email: 'budi@mail.com', created_at: '2026-01-01T00:00:00.000Z', deleted_at: null },
      { id: 'cus-2', name: 'Ani Rahayu', phone: '0822222222', email: null, created_at: '2026-01-02T00:00:00.000Z', deleted_at: null },
    ])

    const result = await fetchCustomers()

    expect(result).toHaveLength(2)
    expect(result[0].name).toBe('Budi Santoso')
    expect(result[1].phone).toBe('0822222222')
  })

  it('excludes rows without a name (sentinel rows)', async () => {
    mockRepos.customers.getAll.mockResolvedValue([
      { id: 'init', _initialized: true, created_at: '2026-01-01T00:00:00.000Z' },
      { id: 'cus-1', name: 'Budi', phone: '08111234567', created_at: '2026-01-01T00:00:00.000Z', deleted_at: null },
    ])

    const result = await fetchCustomers()

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('cus-1')
  })
})

// ─── addCustomer ──────────────────────────────────────────────────────────────

describe('addCustomer', () => {
  it('validates phone format before appending', async () => {
    mockRepos.customers.getAll.mockResolvedValue([])

    const result = await addCustomer('Budi Santoso', '08111234567')

    expect(mockRepos.customers.batchInsert).toHaveBeenCalledOnce()
    expect(mockRepos.customers.batchInsert).toHaveBeenCalledWith([expect.objectContaining({
      name: 'Budi Santoso',
      phone: '08111234567',
    })])
    expect(result.name).toBe('Budi Santoso')
    expect(result.phone).toBe('08111234567')
    expect(result.id).toBeTruthy()
    expect(result.created_at).toBeTruthy()
  })

  it('includes optional email when provided', async () => {
    mockRepos.customers.getAll.mockResolvedValue([])

    const result = await addCustomer('Budi Santoso', '08111234567', 'budi@mail.com')

    expect(mockRepos.customers.batchInsert).toHaveBeenCalledWith([expect.objectContaining({
      email: 'budi@mail.com',
    })])
    expect(result.email).toBe('budi@mail.com')
  })

  it('throws CustomerError if phone is invalid Indonesian format', async () => {
    mockRepos.customers.getAll.mockResolvedValue([])

    await expect(addCustomer('Budi Santoso', '12345')).rejects.toThrow(CustomerError)
    await expect(addCustomer('Budi Santoso', 'abc')).rejects.toThrow(CustomerError)
  })

  it('throws CustomerError if duplicate phone already exists', async () => {
    mockRepos.customers.getAll.mockResolvedValue([
      { id: 'cus-1', name: 'Existing', phone: '08111234567', created_at: '2026-01-01T00:00:00.000Z', deleted_at: null },
    ])

    await expect(addCustomer('Budi Santoso', '08111234567')).rejects.toThrow(CustomerError)
  })
})

// ─── updateCustomer ───────────────────────────────────────────────────────────

describe('updateCustomer', () => {
  it('calls batchUpdateCells for each changed field', async () => {
    await updateCustomer('cus-1', { name: 'Budi Baru', email: 'baru@mail.com' })

    expect(mockRepos.customers.batchUpdate).toHaveBeenCalledWith([
      { id: 'cus-1', name: 'Budi Baru', email: 'baru@mail.com' },
    ])
  })
})
