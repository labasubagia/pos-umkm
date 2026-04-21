/**
 * T018 — auth.service unit tests
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { resolveUserRole, isFirstTimeOwner, UnauthorizedError } from './auth.service'
import * as adapters from '../../lib/adapters'

function mockRepo(overrides = {}) {
  return {
    spreadsheetId: 'test-id',
    sheetName: 'mock',
    getAll: vi.fn().mockResolvedValue([]),
    batchInsert: vi.fn().mockResolvedValue(undefined),
    batchUpdate: vi.fn().mockResolvedValue(undefined),
    batchUpsertBy: vi.fn().mockResolvedValue(undefined),
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

describe('resolveUserRole', () => {
  it('returns "cashier" for a known member email', async () => {
    mockRepos.members.getAll.mockResolvedValue([
      { id: 'u1', email: 'cashier@test.com', role: 'cashier', deleted_at: null },
    ])

    const role = await resolveUserRole('cashier@test.com')

    expect(role).toBe('cashier')
  })

  it('returns "owner" for the store owner email', async () => {
    mockRepos.members.getAll.mockResolvedValue([
      { id: 'u1', email: 'owner@test.com', role: 'owner', deleted_at: null },
    ])

    const role = await resolveUserRole('owner@test.com')

    expect(role).toBe('owner')
  })

  it('throws UnauthorizedError if email not in Members tab', async () => {
    mockRepos.members.getAll.mockResolvedValue([])

    await expect(resolveUserRole('stranger@test.com')).rejects.toThrow(UnauthorizedError)
  })

  it('throws if member has been revoked (deleted_at set)', async () => {
    // getAll already filters soft-deleted rows, so revoked members are absent
    mockRepos.members.getAll.mockResolvedValue([
      // only non-deleted rows returned by adapter
    ])

    await expect(resolveUserRole('revoked@test.com')).rejects.toThrow(UnauthorizedError)
  })
})

describe('isFirstTimeOwner', () => {
  it('returns true when Members tab has no rows', async () => {
    mockRepos.members.getAll.mockResolvedValue([])

    expect(await isFirstTimeOwner()).toBe(true)
  })

  it('returns false when Members tab has at least one row', async () => {
    mockRepos.members.getAll.mockResolvedValue([
      { id: 'u1', email: 'owner@test.com', role: 'owner' },
    ])

    expect(await isFirstTimeOwner()).toBe(false)
  })
})
