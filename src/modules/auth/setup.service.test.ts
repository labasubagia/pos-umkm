/**
 * T015 + T016 — setup.service unit tests
 *
 * Uses MockDataAdapter (via localStorage) so no Drive/Sheets API calls are made.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  createMainSpreadsheet,
  createMasterSpreadsheet,
  initializeMasterSheets,
  saveSpreadsheetId,
  saveMainSpreadsheetId,
  getMainSpreadsheetId,
  monthlySheetKey,
  listStores,
  findOrCreateMain,
  activateStore,
  runStoreSetup,
  runFirstTimeSetup,
  MAIN_TABS,
  MAIN_TAB_HEADERS,
  MASTER_TABS,
  MONTHLY_TABS,
  getCurrentMonthSheetId,
  createMonthlySheet,
  initializeMonthlySheets,
  shareSheetWithAllMembers,
  type StoreRecord,
} from './setup.service'

import * as adapters from '../../lib/adapters'
import { useAuthStore } from '../../store/authStore'

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
  // Reset Zustand auth store so mainSpreadsheetId/spreadsheetId don't leak between tests.
  useAuthStore.getState().clearAuth()
  vi.restoreAllMocks()
})

// ─── createMainSpreadsheet ───────────────────────────────────────────────────

describe('createMainSpreadsheet', () => {
  it('creates main spreadsheet at apps/pos_umkm/ with Stores tab', async () => {
    const createSpy = vi.spyOn(adapters.dataAdapter, 'createSpreadsheet')
      .mockResolvedValue('main-id-001')
    vi.spyOn(adapters.dataAdapter, 'writeHeaders').mockResolvedValue()

    const id = await createMainSpreadsheet('owner@example.com')

    expect(createSpy).toHaveBeenCalledWith('main', undefined, ['Stores'])
    expect(id).toBe('main-id-001')
  })

  it('writes Stores tab headers', async () => {
    vi.spyOn(adapters.dataAdapter, 'createSpreadsheet').mockResolvedValue('main-id-002')
    const headersSpy = vi.spyOn(adapters.dataAdapter, 'writeHeaders').mockResolvedValue()

    await createMainSpreadsheet()

    expect(headersSpy).toHaveBeenCalledWith('Stores', MAIN_TAB_HEADERS['Stores'])
  })

  it('throws SetupError on failure', async () => {
    vi.spyOn(adapters.dataAdapter, 'createSpreadsheet').mockRejectedValue(new Error('Drive error'))
    await expect(createMainSpreadsheet()).rejects.toThrow('createMainSpreadsheet failed')
  })
})

// ─── createMasterSpreadsheet ─────────────────────────────────────────────────

describe('createMasterSpreadsheet', () => {
  it('creates only master spreadsheet (not main)', async () => {
    const createSpy = vi.spyOn(adapters.dataAdapter, 'createSpreadsheet')
      .mockResolvedValue('master-id-123')
    vi.spyOn(adapters.dataAdapter, 'appendRow').mockResolvedValue()

    const id = await createMasterSpreadsheet('Toko Santoso', 'owner@example.com', 'main-id-000')

    expect(createSpy).toHaveBeenCalledTimes(1)
    expect(createSpy).toHaveBeenCalledWith('master', undefined, expect.arrayContaining([...MASTER_TABS]))
    expect(id).toBe('master-id-123')
  })

  it('registers store in main.Stores tab', async () => {
    vi.spyOn(adapters.dataAdapter, 'createSpreadsheet').mockResolvedValue('master-id-456')
    const appendSpy = vi.spyOn(adapters.dataAdapter, 'appendRow').mockResolvedValue()

    await createMasterSpreadsheet('Toko X', 'owner@example.com', 'main-id-000')

    expect(appendSpy).toHaveBeenCalledWith('Stores', expect.objectContaining({
      store_name: 'Toko X',
      master_spreadsheet_id: 'master-id-456',
      owner_email: 'owner@example.com',
      my_role: 'owner',
    }))
  })

  it('saves activeStoreId to localStorage', async () => {
    vi.spyOn(adapters.dataAdapter, 'createSpreadsheet').mockResolvedValue('master-id-789')
    vi.spyOn(adapters.dataAdapter, 'appendRow').mockResolvedValue()

    await createMasterSpreadsheet('Toko Y', '', 'main-id-000')

    expect(localStorage.getItem('activeStoreId')).toBeTruthy()
  })

  it('throws SetupError on Drive API failure', async () => {
    vi.spyOn(adapters.dataAdapter, 'createSpreadsheet').mockRejectedValue(new Error('Drive down'))
    await expect(createMasterSpreadsheet('Toko Z', '', 'main-id-000')).rejects.toThrow('createMasterSpreadsheet failed')
  })
})

// ─── initializeMasterSheets ──────────────────────────────────────────────────

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
    expect(spy).toHaveBeenCalledTimes(MASTER_TABS.length)
    const settingsCall = spy.mock.calls.find((c) => c[0] === 'Settings')
    expect(settingsCall?.[1]).toEqual(['id', 'key', 'value', 'updated_at'])
    const monthlyCall = spy.mock.calls.find((c) => c[0] === 'Monthly_Sheets')
    expect(monthlyCall?.[1]).toEqual(['id', 'year_month', 'spreadsheetId', 'created_at'])
  })

  it('throws if spreadsheetId is invalid (empty string)', async () => {
    await expect(initializeMasterSheets('')).rejects.toThrow()
  })
})

// ─── saveSpreadsheetId / saveMainSpreadsheetId / getMainSpreadsheetId ────────

describe('saveSpreadsheetId', () => {
  it('writes to localStorage key "masterSpreadsheetId"', () => {
    saveSpreadsheetId('my-sheet-id')
    expect(localStorage.getItem('masterSpreadsheetId')).toBe('my-sheet-id')
  })
})

describe('saveMainSpreadsheetId / getMainSpreadsheetId', () => {
  it('roundtrips through localStorage', () => {
    saveMainSpreadsheetId('main-abc')
    expect(getMainSpreadsheetId()).toBe('main-abc')
  })

  it('returns null when not set', () => {
    expect(getMainSpreadsheetId()).toBeNull()
  })
})

// ─── listStores ──────────────────────────────────────────────────────────────

describe('listStores', () => {
  it('returns typed StoreRecord array from Stores tab', async () => {
    vi.spyOn(adapters.dataAdapter, 'getSheet').mockResolvedValue([
      {
        store_id: 'sid-1', store_name: 'Toko A',
        master_spreadsheet_id: 'master-1', drive_folder_id: 'folder-1',
        owner_email: 'a@test.com', my_role: 'owner', joined_at: '2026-04-01T00:00:00Z',
      },
      {
        store_id: 'sid-2', store_name: 'Toko B',
        master_spreadsheet_id: 'master-2', drive_folder_id: 'folder-2',
        owner_email: 'b@test.com', my_role: 'owner', joined_at: '2026-04-02T00:00:00Z',
      },
    ])

    const stores = await listStores('main-id-000')

    expect(stores).toHaveLength(2)
    expect(stores[0]).toMatchObject({ store_id: 'sid-1', store_name: 'Toko A', master_spreadsheet_id: 'master-1' })
    expect(stores[1]).toMatchObject({ store_id: 'sid-2', store_name: 'Toko B' })
  })

  it('filters out rows with missing store_id or master_spreadsheet_id', async () => {
    vi.spyOn(adapters.dataAdapter, 'getSheet').mockResolvedValue([
      { store_id: 'sid-1', store_name: 'Toko A', master_spreadsheet_id: 'master-1' },
      { store_id: '', store_name: 'Bad Row', master_spreadsheet_id: '' },
    ])
    const stores = await listStores('main-id-000')
    expect(stores).toHaveLength(1)
  })

  it('returns empty array when Stores tab is empty', async () => {
    vi.spyOn(adapters.dataAdapter, 'getSheet').mockResolvedValue([])
    const stores = await listStores('main-id-000')
    expect(stores).toEqual([])
  })
})

// ─── findOrCreateMain ────────────────────────────────────────────────────────

describe('findOrCreateMain', () => {
  it('creates main and reads stores when mainSpreadsheetId is not in localStorage', async () => {
    vi.spyOn(adapters.dataAdapter, 'createSpreadsheet').mockResolvedValue('new-main-id')
    vi.spyOn(adapters.dataAdapter, 'writeHeaders').mockResolvedValue()
    vi.spyOn(adapters.dataAdapter, 'getSheet').mockResolvedValue([]) // new main → empty stores

    const result = await findOrCreateMain('owner@test.com')

    expect(result.mainSpreadsheetId).toBe('new-main-id')
    expect(result.stores).toEqual([])
    expect(localStorage.getItem('mainSpreadsheetId')).toBe('new-main-id')
  })

  it('finds existing main via Drive (cache miss) and returns existing stores', async () => {
    // localStorage is empty but main spreadsheet already exists in Drive.
    // createSpreadsheet's "find or create" logic returns the existing ID.
    vi.spyOn(adapters.dataAdapter, 'createSpreadsheet').mockResolvedValue('existing-main-id')
    vi.spyOn(adapters.dataAdapter, 'writeHeaders').mockResolvedValue()
    vi.spyOn(adapters.dataAdapter, 'getSheet').mockResolvedValue([
      {
        store_id: 'sid-1', store_name: 'Toko A',
        master_spreadsheet_id: 'master-1', drive_folder_id: '',
        owner_email: '', my_role: 'owner', joined_at: '',
      },
    ])

    const result = await findOrCreateMain('owner@test.com')

    expect(result.mainSpreadsheetId).toBe('existing-main-id')
    expect(result.stores).toHaveLength(1)
    expect(result.stores[0].store_name).toBe('Toko A')
    expect(localStorage.getItem('mainSpreadsheetId')).toBe('existing-main-id')
  })

  it('reads stores from existing main when mainSpreadsheetId is cached', async () => {
    // Seed via Zustand (primary source of truth) rather than direct localStorage key.
    useAuthStore.getState().setMainSpreadsheetId('existing-main-id')
    vi.spyOn(adapters.dataAdapter, 'getSheet').mockResolvedValue([
      {
        store_id: 'sid-1', store_name: 'Toko A',
        master_spreadsheet_id: 'master-1', drive_folder_id: '',
        owner_email: '', my_role: 'owner', joined_at: '',
      },
    ])

    const result = await findOrCreateMain()

    expect(result.mainSpreadsheetId).toBe('existing-main-id')
    expect(result.stores).toHaveLength(1)
    expect(result.stores[0].store_name).toBe('Toko A')
  })

  it('throws SetupError on failure', async () => {
    vi.spyOn(adapters.dataAdapter, 'createSpreadsheet').mockRejectedValue(new Error('quota'))
    await expect(findOrCreateMain()).rejects.toThrow('findOrCreateMain failed')
  })
})

// ─── activateStore ───────────────────────────────────────────────────────────

describe('activateStore', () => {
  const store: StoreRecord = {
    store_id: 'sid-100',
    store_name: 'Toko Santoso',
    master_spreadsheet_id: 'master-100',
    drive_folder_id: 'folder-100',
    owner_email: 'owner@test.com',
    my_role: 'owner',
    joined_at: '2026-04-01T00:00:00Z',
  }

  it('saves activeStoreId to localStorage and routes adapter to master sheet', async () => {
    vi.spyOn(adapters.dataAdapter, 'getSheet').mockResolvedValue([]) // no monthly sheet yet
    vi.spyOn(adapters.dataAdapter, 'createSpreadsheet').mockResolvedValue('monthly-id')
    vi.spyOn(adapters.dataAdapter, 'appendRow').mockResolvedValue()
    vi.spyOn(adapters.dataAdapter, 'writeHeaders').mockResolvedValue()
    vi.spyOn(adapters.dataAdapter, 'setMonthlySpreadsheetId').mockImplementation(() => {})
    const setSpreadsheetIdSpy = vi.spyOn(adapters.dataAdapter, 'setSpreadsheetId').mockImplementation(() => {})

    await activateStore(store)

    // masterSpreadsheetId is now set via the in-memory adapter, not direct localStorage.
    expect(setSpreadsheetIdSpy).toHaveBeenCalledWith('master-100')
    // activeStoreId must still be in localStorage — createMonthlySheet() reads it synchronously.
    expect(localStorage.getItem('activeStoreId')).toBe('sid-100')
  })

  it('sets adapter to monthly sheet when monthly sheet exists', async () => {
    const now = new Date()
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    vi.spyOn(adapters.dataAdapter, 'getSheet').mockResolvedValue([
      { year_month: yearMonth, spreadsheetId: 'existing-monthly-id', id: 'r1', created_at: '' },
    ])
    const monthlySpy = vi.spyOn(adapters.dataAdapter, 'setMonthlySpreadsheetId')
      .mockImplementation(() => {})

    await activateStore(store)

    expect(monthlySpy).toHaveBeenCalledWith('existing-monthly-id')
  })

  it('creates monthly sheet when none exists for current month', async () => {
    vi.spyOn(adapters.dataAdapter, 'getSheet').mockResolvedValue([]) // no monthly entry
    const createSpy = vi.spyOn(adapters.dataAdapter, 'createSpreadsheet').mockResolvedValue('new-monthly-id')
    vi.spyOn(adapters.dataAdapter, 'appendRow').mockResolvedValue()
    vi.spyOn(adapters.dataAdapter, 'writeHeaders').mockResolvedValue()
    vi.spyOn(adapters.dataAdapter, 'setMonthlySpreadsheetId').mockImplementation(() => {})

    await activateStore(store)

    expect(createSpy).toHaveBeenCalledWith(
      expect.stringMatching(/^transaction_/), undefined, expect.anything(),
    )
  })
})

// ─── getCurrentMonthSheetId ──────────────────────────────────────────────────

describe('getCurrentMonthSheetId', () => {
  it('returns null when Monthly_Sheets tab is empty', async () => {
    vi.spyOn(adapters.dataAdapter, 'getSheet').mockResolvedValue([])
    expect(await getCurrentMonthSheetId()).toBeNull()
  })

  it('returns stored id for current month key', async () => {
    const now = new Date()
    const mmStr = String(now.getMonth() + 1).padStart(2, '0')
    const yearMonth = `${now.getFullYear()}-${mmStr}`
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

// ─── createMonthlySheet ──────────────────────────────────────────────────────

describe('createMonthlySheet', () => {
  it('names spreadsheet "transaction_<year>-<month>" inside the year folder', async () => {
    const createSpy = vi
      .spyOn(adapters.dataAdapter, 'createSpreadsheet')
      .mockResolvedValue('monthly-id-001')
    const appendSpy = vi.spyOn(adapters.dataAdapter, 'appendRow').mockResolvedValue()

    await createMonthlySheet(2026, 4)

    expect(createSpy).toHaveBeenCalledWith('transaction_2026-04', undefined, expect.arrayContaining([...MONTHLY_TABS]))
    expect(appendSpy).toHaveBeenCalledWith('Monthly_Sheets', expect.objectContaining({
      year_month: '2026-04',
      spreadsheetId: 'monthly-id-001',
    }))
  })

  it('creates monthly sheet with correct name regardless of activeStoreId', async () => {
    localStorage.setItem('activeStoreId', 'store-uuid-999')
    const createSpy = vi.spyOn(adapters.dataAdapter, 'createSpreadsheet').mockResolvedValue('monthly-id-002')
    vi.spyOn(adapters.dataAdapter, 'appendRow').mockResolvedValue()

    await createMonthlySheet(2026, 4)

    expect(createSpy).toHaveBeenCalledWith('transaction_2026-04', undefined, expect.arrayContaining([...MONTHLY_TABS]))
  })

  it('throws on Drive API error', async () => {
    vi.spyOn(adapters.dataAdapter, 'createSpreadsheet').mockRejectedValue(new Error('quota'))
    await expect(createMonthlySheet(2026, 4)).rejects.toThrow('createMonthlySheet failed')
  })
})

// ─── initializeMonthlySheets ─────────────────────────────────────────────────

describe('initializeMonthlySheets', () => {
  it('writes headers to Transactions, Transaction_Items, Refunds tabs', async () => {
    const spy = vi.spyOn(adapters.dataAdapter, 'writeHeaders').mockResolvedValue()
    await initializeMonthlySheets('monthly-sid-001')
    const calledTabs = spy.mock.calls.map((c) => c[0])
    expect(calledTabs.sort()).toEqual([...MONTHLY_TABS].sort())
  })
})

// ─── shareSheetWithAllMembers ────────────────────────────────────────────────

describe('shareSheetWithAllMembers', () => {
  it('reads Members tab and calls Drive API share for each active member', async () => {
    vi.spyOn(adapters.dataAdapter, 'getSheet').mockResolvedValue([
      { id: 'u1', email: 'alice@test.com', deleted_at: null },
      { id: 'u2', email: 'bob@test.com', deleted_at: null },
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

// ─── runStoreSetup ────────────────────────────────────────────────────────────

describe('runStoreSetup', () => {
  function mockAll() {
    vi.spyOn(adapters.dataAdapter, 'createSpreadsheet')
      .mockResolvedValueOnce('master-id')
      .mockResolvedValueOnce('monthly-id')
    vi.spyOn(adapters.dataAdapter, 'writeHeaders').mockResolvedValue()
    vi.spyOn(adapters.dataAdapter, 'appendRow').mockResolvedValue()
    vi.spyOn(adapters.dataAdapter, 'setMonthlySpreadsheetId').mockImplementation(() => {})
  }

  it('throws SetupError when mainSpreadsheetId is not in localStorage', async () => {
    await expect(runStoreSetup('Toko X')).rejects.toThrow('mainSpreadsheetId not found')
  })

  it('returns masterSpreadsheetId and monthlySpreadsheetId', async () => {
    localStorage.setItem('mainSpreadsheetId', 'main-id')
    mockAll()
    const result = await runStoreSetup('Toko Santoso', 'owner@example.com')
    expect(result.masterSpreadsheetId).toBe('master-id')
    expect(result.monthlySpreadsheetId).toBe('monthly-id')
  })

  it('saves masterSpreadsheetId and txSheet key to localStorage', async () => {
    localStorage.setItem('mainSpreadsheetId', 'main-id')
    mockAll()
    const now = new Date()
    const expectedKey = `txSheet_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    await runStoreSetup('Toko Santoso')
    expect(localStorage.getItem('masterSpreadsheetId')).toBe('master-id')
    expect(localStorage.getItem(expectedKey)).toBe('monthly-id')
  })
})

// ─── runFirstTimeSetup ────────────────────────────────────────────────────────

describe('runFirstTimeSetup', () => {
  function mockAll() {
    vi.spyOn(adapters.dataAdapter, 'createSpreadsheet')
      .mockResolvedValueOnce('main-id')    // createMainSpreadsheet
      .mockResolvedValueOnce('master-id')  // createMasterSpreadsheet
      .mockResolvedValueOnce('monthly-id') // createMonthlySheet
    vi.spyOn(adapters.dataAdapter, 'writeHeaders').mockResolvedValue()
    vi.spyOn(adapters.dataAdapter, 'appendRow').mockResolvedValue()
    vi.spyOn(adapters.dataAdapter, 'setMonthlySpreadsheetId').mockImplementation(() => {})
  }

  it('creates main, master, and monthly spreadsheets in that order', async () => {
    const createSpy = vi.spyOn(adapters.dataAdapter, 'createSpreadsheet')
      .mockResolvedValueOnce('main-id')
      .mockResolvedValueOnce('master-id')
      .mockResolvedValueOnce('monthly-id')
    vi.spyOn(adapters.dataAdapter, 'writeHeaders').mockResolvedValue()
    vi.spyOn(adapters.dataAdapter, 'appendRow').mockResolvedValue()
    vi.spyOn(adapters.dataAdapter, 'setMonthlySpreadsheetId').mockImplementation(() => {})

    await runFirstTimeSetup('Toko Santoso')

    expect(createSpy).toHaveBeenNthCalledWith(1, 'main', undefined, expect.anything())
    expect(createSpy).toHaveBeenNthCalledWith(2, 'master', undefined, expect.anything())
    expect(createSpy).toHaveBeenNthCalledWith(3, expect.stringMatching(/^transaction_/), undefined, expect.anything())
  })

  it('returns masterSpreadsheetId and monthlySpreadsheetId', async () => {
    mockAll()
    const result = await runFirstTimeSetup('Toko Santoso', 'owner@example.com')
    expect(result.masterSpreadsheetId).toBe('master-id')
    expect(result.monthlySpreadsheetId).toBe('monthly-id')
  })

  it('saves mainSpreadsheetId and masterSpreadsheetId to localStorage', async () => {
    mockAll()
    await runFirstTimeSetup('Toko Santoso')
    expect(localStorage.getItem('mainSpreadsheetId')).toBe('main-id')
    expect(localStorage.getItem('masterSpreadsheetId')).toBe('master-id')
  })

  it('calls setMonthlySpreadsheetId so the adapter routes tx writes correctly', async () => {
    mockAll()
    const monthlySpy = vi.spyOn(adapters.dataAdapter, 'setMonthlySpreadsheetId')
    await runFirstTimeSetup('Toko Santoso')
    expect(monthlySpy).toHaveBeenCalledWith('monthly-id')
  })
})
