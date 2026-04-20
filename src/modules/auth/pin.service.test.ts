/**
 * T020 — pin.service + usePinLock unit tests
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { hashPIN, verifyPIN } from './pin.service'
import { usePinLock } from './usePinLock'
import * as adapters from '../../lib/adapters'

function mockRepo(overrides = {}) {
  return {
    spreadsheetId: 'test-id',
    sheetName: 'mock',
    getAll: vi.fn().mockResolvedValue([]),
    append: vi.fn().mockResolvedValue(undefined),
    updateCell: vi.fn().mockResolvedValue(undefined),
    batchUpdateCells: vi.fn().mockResolvedValue(undefined),
    batchUpsertByKey: vi.fn().mockResolvedValue(undefined),
    softDelete: vi.fn().mockResolvedValue(undefined),
    writeHeaders: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

let mockRepos: Record<string, ReturnType<typeof mockRepo>>

// ─── pin.service ─────────────────────────────────────────────────────────────

describe('hashPIN', () => {
  it('returns a bcrypt hash string', async () => {
    const hash = await hashPIN('1234')
    expect(hash).toMatch(/^\$2[aby]\$/)
  })
})

describe('verifyPIN', () => {
  it('returns true for correct PIN against its hash', async () => {
    const hash = await hashPIN('5678')
    expect(await verifyPIN('5678', hash)).toBe(true)
  })

  it('returns false for wrong PIN', async () => {
    const hash = await hashPIN('5678')
    expect(await verifyPIN('0000', hash)).toBe(false)
  })

  it('returns false for empty PIN', async () => {
    const hash = await hashPIN('5678')
    expect(await verifyPIN('', hash)).toBe(false)
  })
})

// ─── usePinLock ──────────────────────────────────────────────────────────────

describe('usePinLock', () => {
  let pinHash: string

  beforeEach(async () => {
    vi.useFakeTimers()
    pinHash = await hashPIN('1234')
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

  afterEach(() => {
    vi.useRealTimers()
  })

  it('locks after idle period elapses', async () => {
    const { result } = renderHook(() =>
      usePinLock({ pinHash, idleMs: 1000 }),
    )

    expect(result.current.isLocked).toBe(false)

    act(() => {
      vi.advanceTimersByTime(1001)
    })

    expect(result.current.isLocked).toBe(true)
  })

  it('resets timer on user interaction', () => {
    const { result } = renderHook(() =>
      usePinLock({ pinHash, idleMs: 1000 }),
    )

    act(() => {
      vi.advanceTimersByTime(800)
      result.current.resetTimer()
      vi.advanceTimersByTime(800)
    })

    // 800 + 800 = 1600ms total, but timer was reset at 800ms so only 800ms elapsed after reset
    expect(result.current.isLocked).toBe(false)
  })

  it('unlocks on correct PIN', async () => {
    const { result } = renderHook(() =>
      usePinLock({ pinHash, idleMs: 1000 }),
    )

    act(() => { vi.advanceTimersByTime(1001) })
    expect(result.current.isLocked).toBe(true)

    await act(async () => {
      await result.current.unlock('1234')
    })

    expect(result.current.isLocked).toBe(false)
  })

  it('does not unlock on wrong PIN', async () => {
    const { result } = renderHook(() =>
      usePinLock({ pinHash, idleMs: 1000 }),
    )

    act(() => { vi.advanceTimersByTime(1001) })
    expect(result.current.isLocked).toBe(true)

    await act(async () => {
      await result.current.unlock('9999')
    })

    expect(result.current.isLocked).toBe(true)
  })
})
