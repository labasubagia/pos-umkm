/**
 * T017 — members.service unit tests
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  inviteMember,
  generateStoreLink,
  revokeMember,
  listMembers,
  MemberError,
} from './members.service'
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
  vi.spyOn(adapters.driveClient, 'shareSpreadsheet').mockResolvedValue(undefined)
})

describe('inviteMember', () => {
  it('appends correct row to Members tab with role and invited_at', async () => {
    await inviteMember('alice@test.com', 'cashier', 'sid-001')

    expect(mockRepos.members.batchInsert).toHaveBeenCalledWith(
      [expect.objectContaining({
        email: 'alice@test.com',
        role: 'cashier',
        invited_at: expect.any(String),
      })],
    )
  })

  it('calls Drive API share with editor permission', async () => {
    await inviteMember('bob@test.com', 'manager', 'sid-001')

    expect(adapters.driveClient.shareSpreadsheet).toHaveBeenCalledWith('sid-001', 'bob@test.com', 'editor')
  })

  it('throws if email is invalid', async () => {
    await expect(inviteMember('not-an-email', 'cashier', 'sid-001')).rejects.toThrow(MemberError)
  })

  it('throws if role is not owner/manager/cashier', async () => {
    // @ts-expect-error — testing invalid role
    await expect(inviteMember('alice@test.com', 'superadmin', 'sid-001')).rejects.toThrow(MemberError)
  })

  it('throws on Drive API error', async () => {
    vi.spyOn(adapters.driveClient, 'shareSpreadsheet').mockRejectedValue(new Error('quota'))
    await expect(inviteMember('alice@test.com', 'cashier', 'sid-001')).rejects.toThrow(MemberError)
  })
})

describe('generateStoreLink', () => {
  it('includes spreadsheetId as ?sid= query param', () => {
    const link = generateStoreLink('my-sheet-id')
    expect(link).toContain('sid=my-sheet-id')
  })
})

describe('revokeMember', () => {
  it('sets deleted_at on correct Members row', async () => {
    await revokeMember('user-123')

    expect(mockRepos.members.softDelete).toHaveBeenCalledWith('user-123')
  })
})

describe('listMembers', () => {
  it('filters out rows where deleted_at is non-empty', async () => {
    mockRepos.members.getAll.mockResolvedValue([
      { id: 'u1', email: 'a@test.com', name: 'A', role: 'cashier', invited_at: '2026-01-01', deleted_at: null },
      { id: 'u2', email: 'b@test.com', name: 'B', role: 'manager', invited_at: '2026-01-02', deleted_at: '2026-02-01' },
    ])

    const members = await listMembers()

    expect(members).toHaveLength(1)
    expect(members[0].email).toBe('a@test.com')
  })
})
