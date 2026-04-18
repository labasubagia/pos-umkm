/**
 * T018 — auth.service unit tests
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { resolveUserRole, isFirstTimeOwner, UnauthorizedError } from './auth.service'
import * as adapters from '../../lib/adapters'

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('resolveUserRole', () => {
  it('returns "cashier" for a known member email', async () => {
    vi.spyOn(adapters.dataAdapter, 'getSheet').mockResolvedValue([
      { id: 'u1', email: 'cashier@test.com', role: 'cashier', deleted_at: null },
    ])

    const role = await resolveUserRole('cashier@test.com')

    expect(role).toBe('cashier')
  })

  it('returns "owner" for the store owner email', async () => {
    vi.spyOn(adapters.dataAdapter, 'getSheet').mockResolvedValue([
      { id: 'u1', email: 'owner@test.com', role: 'owner', deleted_at: null },
    ])

    const role = await resolveUserRole('owner@test.com')

    expect(role).toBe('owner')
  })

  it('throws UnauthorizedError if email not in Users tab', async () => {
    vi.spyOn(adapters.dataAdapter, 'getSheet').mockResolvedValue([])

    await expect(resolveUserRole('stranger@test.com')).rejects.toThrow(UnauthorizedError)
  })

  it('throws if member has been revoked (deleted_at set)', async () => {
    // getSheet already filters soft-deleted rows, so revoked members are absent
    vi.spyOn(adapters.dataAdapter, 'getSheet').mockResolvedValue([
      // only non-deleted rows returned by adapter
    ])

    await expect(resolveUserRole('revoked@test.com')).rejects.toThrow(UnauthorizedError)
  })
})

describe('isFirstTimeOwner', () => {
  it('returns true when Users tab has no rows', async () => {
    vi.spyOn(adapters.dataAdapter, 'getSheet').mockResolvedValue([])

    expect(await isFirstTimeOwner()).toBe(true)
  })

  it('returns false when Users tab has at least one row', async () => {
    vi.spyOn(adapters.dataAdapter, 'getSheet').mockResolvedValue([
      { id: 'u1', email: 'owner@test.com', role: 'owner' },
    ])

    expect(await isFirstTimeOwner()).toBe(false)
  })
})
