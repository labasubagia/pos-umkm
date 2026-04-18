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

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('inviteMember', () => {
  it('appends correct row to Users tab with role and invited_at', async () => {
    vi.spyOn(adapters.dataAdapter, 'shareSpreadsheet').mockResolvedValue()
    const appendSpy = vi.spyOn(adapters.dataAdapter, 'appendRow').mockResolvedValue()

    await inviteMember('alice@test.com', 'cashier', 'sid-001')

    expect(appendSpy).toHaveBeenCalledWith(
      'Users',
      expect.objectContaining({
        email: 'alice@test.com',
        role: 'cashier',
        invited_at: expect.any(String),
      }),
    )
  })

  it('calls Drive API share with editor permission', async () => {
    const shareSpy = vi
      .spyOn(adapters.dataAdapter, 'shareSpreadsheet')
      .mockResolvedValue()
    vi.spyOn(adapters.dataAdapter, 'appendRow').mockResolvedValue()

    await inviteMember('bob@test.com', 'manager', 'sid-001')

    expect(shareSpy).toHaveBeenCalledWith('sid-001', 'bob@test.com', 'editor')
  })

  it('throws if email is invalid', async () => {
    await expect(inviteMember('not-an-email', 'cashier', 'sid-001')).rejects.toThrow(MemberError)
  })

  it('throws if role is not owner/manager/cashier', async () => {
    // @ts-expect-error — testing invalid role
    await expect(inviteMember('alice@test.com', 'superadmin', 'sid-001')).rejects.toThrow(MemberError)
  })

  it('throws on Drive API error', async () => {
    vi.spyOn(adapters.dataAdapter, 'shareSpreadsheet').mockRejectedValue(new Error('quota'))
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
  it('sets deleted_at on correct Users row', async () => {
    const deleteSpy = vi.spyOn(adapters.dataAdapter, 'softDelete').mockResolvedValue()

    await revokeMember('user-123')

    expect(deleteSpy).toHaveBeenCalledWith('Users', 'user-123')
  })
})

describe('listMembers', () => {
  it('filters out rows where deleted_at is non-empty', async () => {
    vi.spyOn(adapters.dataAdapter, 'getSheet').mockResolvedValue([
      { id: 'u1', email: 'a@test.com', name: 'A', role: 'cashier', invited_at: '2026-01-01', deleted_at: null },
      { id: 'u2', email: 'b@test.com', name: 'B', role: 'manager', invited_at: '2026-01-02', deleted_at: '2026-02-01' },
    ])

    const members = await listMembers()

    expect(members).toHaveLength(1)
    expect(members[0].email).toBe('a@test.com')
  })
})
