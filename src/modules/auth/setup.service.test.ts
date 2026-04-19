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
  monthlySheetKey,
  runFirstTimeSetup,
  MAIN_TABS,
  MAIN_TAB_HEADERS,
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
  it('creates main spreadsheet then master spreadsheet with correct names', async () => {
    vi.spyOn(adapters.dataAdapter, 'ensureFolder' as keyof typeof adapters.dataAdapter)
      .mockResolvedValue('folder-id-abc')
    const createSpy = vi
      .spyOn(adapters.dataAdapter, 'createSpreadsheet')
      .mockResolvedValueOnce('main-id-000')   // first call: main
      .mockResolvedValueOnce('sheet-id-123')  // second call: master
    vi.spyOn(adapters.dataAdapter, 'writeHeaders').mockResolvedValue()
    vi.spyOn(adapters.dataAdapter, 'appendRow').mockResolvedValue()

    const id = await createMasterSpreadsheet('Toko Santoso')

    // Main spreadsheet must be named 'main' (TRD §4.1)
    expect(createSpy).toHaveBeenNthCalledWith(1, 'main', 'folder-id-abc', ['Stores'])
    // Master spreadsheet must be named 'master' (TRD §4.1) with all required tabs
    expect(createSpy).toHaveBeenNthCalledWith(2, 'master', 'folder-id-abc', expect.arrayContaining([...MASTER_TABS]))
    // Returns the master spreadsheetId
    expect(id).toBe('sheet-id-123')
  })

  it('writes Stores headers and registers store in main.Stores', async () => {
    vi.spyOn(adapters.dataAdapter, 'ensureFolder' as keyof typeof adapters.dataAdapter)
      .mockResolvedValue('folder-id-abc')
    vi.spyOn(adapters.dataAdapter, 'createSpreadsheet')
      .mockResolvedValueOnce('main-id-000')
      .mockResolvedValueOnce('master-id-001')
    const headersSpy = vi.spyOn(adapters.dataAdapter, 'writeHeaders').mockResolvedValue()
    const appendSpy = vi.spyOn(adapters.dataAdapter, 'appendRow').mockResolvedValue()

    await createMasterSpreadsheet('Warung Ibu', 'owner@example.com')

    // Headers written to main.Stores
    expect(headersSpy).toHaveBeenCalledWith('Stores', expect.arrayContaining(['store_id', 'store_name', 'master_spreadsheet_id']))
    // Store row registered in main.Stores
    expect(appendSpy).toHaveBeenCalledWith('Stores', expect.objectContaining({
      store_name: 'Warung Ibu',
      master_spreadsheet_id: 'master-id-001',
      owner_email: 'owner@example.com',
      my_role: 'owner',
    }))
  })

  it('saves activeStoreId to localStorage', async () => {
    vi.spyOn(adapters.dataAdapter, 'ensureFolder' as keyof typeof adapters.dataAdapter)
      .mockResolvedValue('folder-id-abc')
    vi.spyOn(adapters.dataAdapter, 'createSpreadsheet')
      .mockResolvedValueOnce('main-id-000')
      .mockResolvedValueOnce('master-id-999')
    vi.spyOn(adapters.dataAdapter, 'writeHeaders').mockResolvedValue()
    vi.spyOn(adapters.dataAdapter, 'appendRow').mockResolvedValue()

    await createMasterSpreadsheet('Toko X')

    expect(localStorage.getItem('activeStoreId')).toBeTruthy()
  })

  it('throws SetupError on Drive API failure', async () => {
    vi.spyOn(adapters.dataAdapter, 'ensureFolder' as keyof typeof adapters.dataAdapter).mockResolvedValue('folder-id-xyz')
    vi.spyOn(adapters.dataAdapter, 'createSpreadsheet').mockRejectedValue(new Error('Drive down'))
    await expect(createMasterSpreadsheet('Toko X')).rejects.toThrow('createMasterSpreadsheet failed')
  })
})

describe('initializeMasterSheets', () => {
  it('writes header row to all 11 required tabs', async () => {
    const spy = vi.spyOn(adapters.dataAdapter, 'writeHeaders').mockResolvedValue()

    await initializeMasterSheets('sid-001')

    const calledTabs = spy.mock.calls.map((c) => c[0])
    expect(calledTabs.sort()).toEqual([...MASTER_TABS].sort())
  })

  it('writes correct headers for each tab', async () => {
    const spy = vi.spyOn(adapters.dataAdapter, 'writeHeaders').mockResolvedValue()

    await initializeMasterSheets('sid-001')

    // One writeHeaders call per tab — 11 tabs
    expect(spy).toHaveBeenCalledTimes(MASTER_TABS.length)
    // Spot-check: Settings tab should have key-value headers
    const settingsCall = spy.mock.calls.find((c) => c[0] === 'Settings')
    expect(settingsCall?.[1]).toEqual(['id', 'key', 'value', 'updated_at'])
    // Monthly_Sheets tab should have year_month + spreadsheetId
    const monthlyCall = spy.mock.calls.find((c) => c[0] === 'Monthly_Sheets')
    expect(monthlyCall?.[1]).toEqual(['id', 'year_month', 'spreadsheetId', 'created_at'])
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
  it('returns null when Monthly_Sheets tab is empty', async () => {
    vi.spyOn(adapters.dataAdapter, 'getSheet').mockResolvedValue([])
    expect(await getCurrentMonthSheetId()).toBeNull()
  })

  it('returns stored id for current month key', async () => {
    const now = new Date()
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const yearMonth = `${now.getFullYear()}-${mm}`
    vi.spyOn(adapters.dataAdapter, 'getSheet').mockResolvedValue([
      { id: 'row-1', year_month: yearMonth, spreadsheetId: 'monthly-id-789', created_at: '2026-04-01T00:00:00Z' },
    ])
    expect(await getCurrentMonthSheetId()).toBe('monthly-id-789')
  })

  it('returns null when Monthly_Sheets tab throws (pre-setup)', async () => {
    vi.spyOn(adapters.dataAdapter, 'getSheet').mockRejectedValue(new Error('tab not found'))
    expect(await getCurrentMonthSheetId()).toBeNull()
  })
})

describe('createMonthlySheet', () => {
  it('names spreadsheet "transaction_<year>-<month>" inside the year folder', async () => {
    const createSpy = vi
      .spyOn(adapters.dataAdapter, 'createSpreadsheet')
      .mockResolvedValue('monthly-id-001')
    const appendSpy = vi.spyOn(adapters.dataAdapter, 'appendRow').mockResolvedValue()

    await createMonthlySheet(2026, 4)

    // parentFolderId is undefined when ensureFolder is not available (MockDataAdapter)
    expect(createSpy).toHaveBeenCalledWith('transaction_2026-04', undefined, expect.arrayContaining([...MONTHLY_TABS]))
    // Must register the new ID in the Monthly_Sheets registry tab
    expect(appendSpy).toHaveBeenCalledWith('Monthly_Sheets', expect.objectContaining({
      year_month: '2026-04',
      spreadsheetId: 'monthly-id-001',
    }))
  })

  it('uses activeStoreId from localStorage to build the year folder path', async () => {
    localStorage.setItem('activeStoreId', 'store-uuid-999')
    const ensureSpy = vi
      .spyOn(adapters.dataAdapter, 'ensureFolder' as keyof typeof adapters.dataAdapter)
      .mockResolvedValue('txn-folder-id')
    vi.spyOn(adapters.dataAdapter, 'createSpreadsheet').mockResolvedValue('monthly-id-002')
    vi.spyOn(adapters.dataAdapter, 'appendRow').mockResolvedValue()

    await createMonthlySheet(2026, 4)

    expect(ensureSpy).toHaveBeenCalledWith(['apps', 'pos_umkm', 'stores', 'store-uuid-999', 'transactions', '2026'])
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
  it('reads Members tab and calls Drive API share for each active member', async () => {
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

// ─── monthlySheetKey ─────────────────────────────────────────────────────────

describe('monthlySheetKey', () => {
  it('returns zero-padded key for single-digit months', () => {
    expect(monthlySheetKey(2026, 4)).toBe('txSheet_2026-04')
  })

  it('returns key for double-digit months', () => {
    expect(monthlySheetKey(2026, 11)).toBe('txSheet_2026-11')
  })
})

// ─── runFirstTimeSetup ───────────────────────────────────────────────────────

describe('runFirstTimeSetup', () => {
  function mockAllAdapterCalls() {
    vi.spyOn(adapters.dataAdapter, 'ensureFolder' as keyof typeof adapters.dataAdapter)
      .mockResolvedValue('folder-id')
    vi.spyOn(adapters.dataAdapter, 'createSpreadsheet')
      .mockResolvedValueOnce('main-id')
      .mockResolvedValueOnce('master-id')
      .mockResolvedValueOnce('monthly-id')
    vi.spyOn(adapters.dataAdapter, 'writeHeaders').mockResolvedValue()
    vi.spyOn(adapters.dataAdapter, 'appendRow').mockResolvedValue()
    vi.spyOn(adapters.dataAdapter, 'setMonthlySpreadsheetId').mockImplementation(() => {})
  }

  it('returns masterSpreadsheetId and monthlySpreadsheetId', async () => {
    mockAllAdapterCalls()
    const result = await runFirstTimeSetup('Toko Santoso', 'owner@example.com')
    expect(result.masterSpreadsheetId).toBe('master-id')
    expect(result.monthlySpreadsheetId).toBe('monthly-id')
  })

  it('saves masterSpreadsheetId to localStorage', async () => {
    mockAllAdapterCalls()
    await runFirstTimeSetup('Toko Santoso')
    expect(localStorage.getItem('masterSpreadsheetId')).toBe('master-id')
  })

  it('saves monthly sheet ID under txSheet_<year>-<month> key', async () => {
    mockAllAdapterCalls()
    const now = new Date()
    const expectedKey = `txSheet_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    await runFirstTimeSetup('Toko Santoso')
    expect(localStorage.getItem(expectedKey)).toBe('monthly-id')
  })

  it('calls setMonthlySpreadsheetId so the adapter routes tx writes correctly', async () => {
    mockAllAdapterCalls()
    const monthlySpy = vi.spyOn(adapters.dataAdapter, 'setMonthlySpreadsheetId')
    await runFirstTimeSetup('Toko Santoso')
    expect(monthlySpy).toHaveBeenCalledWith('monthly-id')
  })

  it('creates main, master, and monthly spreadsheets in that order', async () => {
    const createSpy = vi.spyOn(adapters.dataAdapter, 'createSpreadsheet')
      .mockResolvedValueOnce('main-id')
      .mockResolvedValueOnce('master-id')
      .mockResolvedValueOnce('monthly-id')
    vi.spyOn(adapters.dataAdapter, 'ensureFolder' as keyof typeof adapters.dataAdapter)
      .mockResolvedValue('folder-id')
    vi.spyOn(adapters.dataAdapter, 'writeHeaders').mockResolvedValue()
    vi.spyOn(adapters.dataAdapter, 'appendRow').mockResolvedValue()
    vi.spyOn(adapters.dataAdapter, 'setMonthlySpreadsheetId').mockImplementation(() => {})

    await runFirstTimeSetup('Toko Santoso')

    expect(createSpy).toHaveBeenNthCalledWith(1, 'main', expect.anything(), expect.anything())
    expect(createSpy).toHaveBeenNthCalledWith(2, 'master', expect.anything(), expect.anything())
    expect(createSpy).toHaveBeenNthCalledWith(3, expect.stringMatching(/^transaction_/), expect.anything(), expect.anything())
  })
})
