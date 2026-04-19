/**
 * T015 + T016 — setup.service unit tests
 *
 * Uses MockDataAdapter (via localStorage) so no Drive/Sheets API calls are made.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  createMasterSpreadsheet,
  initializeMasterSheets,
  saveSpreadsheetId,
  MASTER_TABS,
  MONTHLY_TABS,
  getCurrentMonthSheetId,
  createMonthlySheet,
  initializeMonthlySheets,
  shareSheetWithAllMembers,
} from './setup.service'

// The adapter index exports the singleton — spy on it
import * as adapters from '../../lib/adapters'

// jsdom localStorage.clear() may not exist in all vitest environments; use Map-backed mock
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
    get length() { return Object.keys(store).length },
    key: (index: number) => Object.keys(store)[index] ?? null,
  }
})()

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
})

beforeEach(() => {
  localStorageMock.clear()
  vi.restoreAllMocks()
})

// ─── T015 ───────────────────────────────────────────────────────────────────

describe('createMasterSpreadsheet', () => {
  it('calls Drive API with correct body (via dataAdapter.createSpreadsheet)', async () => {
    vi.spyOn(adapters.dataAdapter, 'ensureFolder' as keyof typeof adapters.dataAdapter).mockResolvedValue('folder-id-abc')
    const spy = vi
      .spyOn(adapters.dataAdapter, 'createSpreadsheet')
      .mockResolvedValue('sheet-id-123')

    const id = await createMasterSpreadsheet('Toko Santoso')

    expect(spy).toHaveBeenCalledWith('POS UMKM — Master — Toko Santoso', 'folder-id-abc', expect.arrayContaining([...MASTER_TABS]))
    expect(id).toBe('sheet-id-123')
  })

  it('returns spreadsheetId from response', async () => {
    vi.spyOn(adapters.dataAdapter, 'ensureFolder' as keyof typeof adapters.dataAdapter).mockResolvedValue('folder-id-xyz')
    vi.spyOn(adapters.dataAdapter, 'createSpreadsheet').mockResolvedValue('abc-456')
    const id = await createMasterSpreadsheet('Warung Ibu')
    expect(id).toBe('abc-456')
  })

  it('throws SetupError on Drive API failure', async () => {
    vi.spyOn(adapters.dataAdapter, 'ensureFolder' as keyof typeof adapters.dataAdapter).mockResolvedValue('folder-id-xyz')
    vi.spyOn(adapters.dataAdapter, 'createSpreadsheet').mockRejectedValue(new Error('Drive down'))
    await expect(createMasterSpreadsheet('Toko X')).rejects.toThrow('createMasterSpreadsheet failed')
  })
})

describe('initializeMasterSheets', () => {
  it('writes header row to all 10 required tabs', async () => {
    const spy = vi.spyOn(adapters.dataAdapter, 'writeHeaders').mockResolvedValue()

    await initializeMasterSheets('sid-001')

    const calledTabs = spy.mock.calls.map((c) => c[0])
    expect(calledTabs.sort()).toEqual([...MASTER_TABS].sort())
  })

  it('writes correct headers for each tab', async () => {
    const spy = vi.spyOn(adapters.dataAdapter, 'writeHeaders').mockResolvedValue()

    await initializeMasterSheets('sid-001')

    // One writeHeaders call per tab — 10 tabs
    expect(spy).toHaveBeenCalledTimes(MASTER_TABS.length)
    // Spot-check: Settings tab should have key-value headers
    const settingsCall = spy.mock.calls.find((c) => c[0] === 'Settings')
    expect(settingsCall?.[1]).toEqual(['id', 'key', 'value', 'updated_at'])
  })

  it('throws if spreadsheetId is invalid (empty string)', async () => {
    await expect(initializeMasterSheets('')).rejects.toThrow()
  })
})

describe('saveSpreadsheetId', () => {
  it('writes to localStorage key "masterSpreadsheetId"', () => {
    saveSpreadsheetId('my-sheet-id')
    expect(localStorage.getItem('masterSpreadsheetId')).toBe('my-sheet-id')
  })
})

// ─── T016 ───────────────────────────────────────────────────────────────────

describe('getCurrentMonthSheetId', () => {
  it('returns null when localStorage is empty', () => {
    expect(getCurrentMonthSheetId()).toBeNull()
  })

  it('returns stored id for current month key', () => {
    const now = new Date()
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const key = `txSheet_${now.getFullYear()}-${mm}`
    localStorage.setItem(key, 'monthly-id-789')
    expect(getCurrentMonthSheetId()).toBe('monthly-id-789')
  })
})

describe('createMonthlySheet', () => {
  it('names spreadsheet "POS UMKM — Transactions — YYYY-MM"', async () => {
    const spy = vi
      .spyOn(adapters.dataAdapter, 'createSpreadsheet')
      .mockResolvedValue('monthly-id-001')

    await createMonthlySheet(2026, 4)

    // parentFolderId is undefined when storeFolderId is not in localStorage
    expect(spy).toHaveBeenCalledWith('POS UMKM — Transactions — 2026-04', undefined, expect.arrayContaining([...MONTHLY_TABS]))
  })

  it('throws on Drive API error', async () => {
    vi.spyOn(adapters.dataAdapter, 'createSpreadsheet').mockRejectedValue(new Error('quota'))
    await expect(createMonthlySheet(2026, 4)).rejects.toThrow('createMonthlySheet failed')
  })
})

describe('initializeMonthlySheets', () => {
  it('writes headers to Transactions, Transaction_Items, Refunds tabs', async () => {
    const spy = vi.spyOn(adapters.dataAdapter, 'writeHeaders').mockResolvedValue()

    await initializeMonthlySheets('monthly-sid-001')

    const calledTabs = spy.mock.calls.map((c) => c[0])
    expect(calledTabs.sort()).toEqual([...MONTHLY_TABS].sort())
  })
})

describe('shareSheetWithAllMembers', () => {
  it('reads Users tab and calls Drive API share for each active member', async () => {
    vi.spyOn(adapters.dataAdapter, 'getSheet').mockResolvedValue([
      { id: 'u1', email: 'alice@test.com', deleted_at: null },
      { id: 'u2', email: 'bob@test.com', deleted_at: null },
      // deleted member — should be skipped
      { id: 'u3', email: 'charlie@test.com', deleted_at: '2026-01-01T00:00:00Z' },
    ])
    const shareSpy = vi.spyOn(adapters.dataAdapter, 'shareSpreadsheet').mockResolvedValue()

    await shareSheetWithAllMembers('monthly-sid-002')

    expect(shareSpy).toHaveBeenCalledTimes(2)
    expect(shareSpy).toHaveBeenCalledWith('monthly-sid-002', 'alice@test.com', 'editor')
    expect(shareSpy).toHaveBeenCalledWith('monthly-sid-002', 'bob@test.com', 'editor')
  })
})
