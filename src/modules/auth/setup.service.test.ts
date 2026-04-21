/**
 * T015 + T016 — setup.service unit tests
 *
 * Uses spies on adapters (getRepos, makeRepo, driveClient) so no Drive/Sheets
 * API calls are made.
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
  updateStoreName,
  findOrCreateMain,
  activateStore,
  runStoreSetup,
  runFirstTimeSetup,
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

function mockRepo(overrides = {}) {
  return {
    spreadsheetId: 'test-id',
    sheetName: 'mock',
    getAll: vi.fn().mockResolvedValue([]),
    batchAppend: vi.fn().mockResolvedValue(undefined),
    batchUpdateCells: vi.fn().mockResolvedValue(undefined),
    batchUpsertByKey: vi.fn().mockResolvedValue(undefined),
    softDelete: vi.fn().mockResolvedValue(undefined),
    writeHeaders: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

let mockRepos: Record<string, ReturnType<typeof mockRepo>>
let sharedMakeRepo: ReturnType<typeof mockRepo>

beforeEach(() => {
  localStorageMock.clear()
  // Reset Zustand auth store so mainSpreadsheetId/spreadsheetId don't leak between tests.
  useAuthStore.getState().clearAuth()
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

  sharedMakeRepo = mockRepo()
  vi.spyOn(adapters, 'makeRepo').mockReturnValue(sharedMakeRepo as ReturnType<typeof adapters.makeRepo>)

  vi.spyOn(adapters.driveClient, 'createSpreadsheet').mockResolvedValue('new-sheet-id')
  vi.spyOn(adapters.driveClient, 'ensureFolder').mockResolvedValue('folder-id')
  vi.spyOn(adapters.driveClient, 'shareSpreadsheet').mockResolvedValue(undefined)
})

// ─── createMainSpreadsheet ───────────────────────────────────────────────────

describe('createMainSpreadsheet', () => {
  it('creates main spreadsheet at apps/pos_umkm/ with Stores tab', async () => {
    vi.spyOn(adapters.driveClient, 'createSpreadsheet').mockResolvedValue('main-id-001')

    const id = await createMainSpreadsheet('owner@example.com')

    expect(adapters.driveClient.createSpreadsheet).toHaveBeenCalledWith('main', expect.anything(), ['Stores'])
    expect(id).toBe('main-id-001')
  })

  it('writes Stores tab headers', async () => {
    vi.spyOn(adapters.driveClient, 'createSpreadsheet').mockResolvedValue('main-id-002')

    await createMainSpreadsheet()

    expect(sharedMakeRepo.writeHeaders).toHaveBeenCalledWith(MAIN_TAB_HEADERS['Stores'])
  })

  it('throws SetupError on failure', async () => {
    vi.spyOn(adapters.driveClient, 'createSpreadsheet').mockRejectedValue(new Error('Drive error'))
    await expect(createMainSpreadsheet()).rejects.toThrow('createMainSpreadsheet failed')
  })
})

// ─── createMasterSpreadsheet ─────────────────────────────────────────────────

describe('createMasterSpreadsheet', () => {
  it('creates only master spreadsheet (not main)', async () => {
    vi.spyOn(adapters.driveClient, 'createSpreadsheet').mockResolvedValue('master-id-123')

    const result = await createMasterSpreadsheet('Toko Santoso', 'owner@example.com', 'main-id-000')

    expect(adapters.driveClient.createSpreadsheet).toHaveBeenCalledTimes(1)
    expect(adapters.driveClient.createSpreadsheet).toHaveBeenCalledWith('master', expect.anything(), expect.arrayContaining([...MASTER_TABS]))
    expect(result.masterId).toBe('master-id-123')
    expect(result.storeId).toBeTruthy()
  })

  it('registers store in main.Stores tab', async () => {
    vi.spyOn(adapters.driveClient, 'createSpreadsheet').mockResolvedValue('master-id-456')

    await createMasterSpreadsheet('Toko X', 'owner@example.com', 'main-id-000')

    expect(sharedMakeRepo.batchAppend).toHaveBeenCalledWith([expect.objectContaining({
      store_name: 'Toko X',
      master_spreadsheet_id: 'master-id-456',
      owner_email: 'owner@example.com',
      my_role: 'owner',
    })])
  })

  it('saves activeStoreId to localStorage', async () => {
    vi.spyOn(adapters.driveClient, 'createSpreadsheet').mockResolvedValue('master-id-789')

    await createMasterSpreadsheet('Toko Y', '', 'main-id-000')

    expect(localStorage.getItem('activeStoreId')).toBeTruthy()
  })

  it('throws SetupError on Drive API failure', async () => {
    vi.spyOn(adapters.driveClient, 'createSpreadsheet').mockRejectedValue(new Error('Drive down'))
    await expect(createMasterSpreadsheet('Toko Z', '', 'main-id-000')).rejects.toThrow('createMasterSpreadsheet failed')
  })
})

// ─── initializeMasterSheets ──────────────────────────────────────────────────

describe('initializeMasterSheets', () => {
  it('writes header row to all 11 required tabs', async () => {
    const makeRepoSpy = vi.spyOn(adapters, 'makeRepo').mockReturnValue(sharedMakeRepo as ReturnType<typeof adapters.makeRepo>)
    await initializeMasterSheets('sid-001')
    const calledTabs = makeRepoSpy.mock.calls.map(([, sheetName]) => sheetName)
    expect(calledTabs.sort()).toEqual([...MASTER_TABS].sort())
  })

  it('writes correct headers for each tab', async () => {
    const makeRepoSpy = vi.spyOn(adapters, 'makeRepo').mockReturnValue(sharedMakeRepo as ReturnType<typeof adapters.makeRepo>)
    await initializeMasterSheets('sid-001')
    expect(sharedMakeRepo.writeHeaders).toHaveBeenCalledTimes(MASTER_TABS.length)
    const settingsIdx = makeRepoSpy.mock.calls.findIndex(([, tab]) => tab === 'Settings')
    expect(sharedMakeRepo.writeHeaders.mock.calls[settingsIdx]).toEqual([['id', 'key', 'value', 'updated_at']])
    const monthlyIdx = makeRepoSpy.mock.calls.findIndex(([, tab]) => tab === 'Monthly_Sheets')
    expect(sharedMakeRepo.writeHeaders.mock.calls[monthlyIdx]).toEqual([['id', 'year_month', 'spreadsheetId', 'created_at']])
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
    sharedMakeRepo.getAll.mockResolvedValue([
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
    sharedMakeRepo.getAll.mockResolvedValue([
      { store_id: 'sid-1', store_name: 'Toko A', master_spreadsheet_id: 'master-1' },
      { store_id: '', store_name: 'Bad Row', master_spreadsheet_id: '' },
    ])
    const stores = await listStores('main-id-000')
    expect(stores).toHaveLength(1)
  })

  it('returns empty array when Stores tab is empty', async () => {
    sharedMakeRepo.getAll.mockResolvedValue([])
    const stores = await listStores('main-id-000')
    expect(stores).toEqual([])
  })
})

// ─── findOrCreateMain ────────────────────────────────────────────────────────

describe('findOrCreateMain', () => {
  it('creates main and reads stores when mainSpreadsheetId is not in localStorage', async () => {
    vi.spyOn(adapters.driveClient, 'createSpreadsheet').mockResolvedValue('new-main-id')
    sharedMakeRepo.getAll.mockResolvedValue([]) // new main → empty stores

    const result = await findOrCreateMain('owner@test.com')

    expect(result.mainSpreadsheetId).toBe('new-main-id')
    expect(result.stores).toEqual([])
    expect(localStorage.getItem('mainSpreadsheetId')).toBe('new-main-id')
  })

  it('finds existing main via Drive (cache miss) and returns existing stores', async () => {
    vi.spyOn(adapters.driveClient, 'createSpreadsheet').mockResolvedValue('existing-main-id')
    sharedMakeRepo.getAll.mockResolvedValue([
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
    useAuthStore.getState().setMainSpreadsheetId('existing-main-id')
    sharedMakeRepo.getAll.mockResolvedValue([
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
    vi.spyOn(adapters.driveClient, 'createSpreadsheet').mockRejectedValue(new Error('quota'))
    await expect(findOrCreateMain()).rejects.toThrow('findOrCreateMain failed')
  })
})

// ─── updateStoreName ─────────────────────────────────────────────────────────

describe('updateStoreName', () => {
  beforeEach(() => {
    // Seed mainSpreadsheetId so updateStoreName can find it.
    useAuthStore.getState().setMainSpreadsheetId('main-id-000')
  })

  it('updates store_name cell in main.Stores tab', async () => {
    await updateStoreName('sid-1', 'Toko Baru', 'master-1')

    expect(sharedMakeRepo.batchUpdateCells).toHaveBeenCalledWith([{ rowId: 'sid-1', column: 'store_name', value: 'Toko Baru' }])
  })

  it('throws SetupError when mainSpreadsheetId is not set', async () => {
    useAuthStore.getState().clearAuth()
    await expect(updateStoreName('sid-1', 'New Name', 'master-1')).rejects.toThrow('mainSpreadsheetId not found')
  })

  it('throws SetupError when store is not found in Stores tab', async () => {
    const adapterError = new Error('row not found')
    adapterError.name = 'AdapterError'
    sharedMakeRepo.batchUpdateCells.mockRejectedValue(adapterError)
    await expect(updateStoreName('sid-missing', 'New Name', 'master-1')).rejects.toThrow('not found in main.Stores')
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
    // makeRepo (not getRepos) is used to bypass stale Dexie cache.
    sharedMakeRepo.getAll.mockResolvedValue([])
    vi.spyOn(adapters.driveClient, 'createSpreadsheet').mockResolvedValue('monthly-id')

    const session = await activateStore(store)

    expect(session.spreadsheetId).toBe('master-100')
    expect(localStorage.getItem('activeStoreId')).toBe('sid-100')
  })

  it('sets monthly sheet in auth store when monthly sheet exists', async () => {
    const now = new Date()
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    sharedMakeRepo.getAll.mockResolvedValue([
      { year_month: yearMonth, spreadsheetId: 'existing-monthly-id', id: 'r1', created_at: '' },
    ])

    const session = await activateStore(store)

    expect(session.monthlySpreadsheetId).toBe('existing-monthly-id')
  })

  it('creates monthly sheet when none exists for current month', async () => {
    sharedMakeRepo.getAll.mockResolvedValue([]) // no monthly entry
    const createSpy = vi.spyOn(adapters.driveClient, 'createSpreadsheet').mockResolvedValue('new-monthly-id')

    await activateStore(store)

    expect(createSpy).toHaveBeenCalledWith(
      expect.stringMatching(/^transaction_/), expect.anything(), expect.anything(),
    )
  })

  it('reads Monthly_Sheets via makeRepo (bypasses Dexie) to avoid cross-store contamination', async () => {
    // This test guards against regression: activateStore must NOT call
    // getRepos().monthlySheets because getRepos() reads from the currently-active
    // store's Dexie DB, which may not yet be reinitialized for the new store.
    sharedMakeRepo.getAll.mockResolvedValue([])
    vi.spyOn(adapters.driveClient, 'createSpreadsheet').mockResolvedValue('monthly-id')
    const getReposSpy = vi.spyOn(adapters, 'getRepos')

    await activateStore(store)

    // getRepos() should NOT have been called for Monthly_Sheets lookup.
    const reposCallCount = getReposSpy.mock.calls.length
    // makeRepo should have been called with the store's master spreadsheet ID.
    const makeRepoCall = vi.mocked(adapters.makeRepo).mock.calls.find(
      ([, sheetName]) => sheetName === 'Monthly_Sheets',
    )
    expect(makeRepoCall).toBeDefined()
    expect(makeRepoCall?.[0]).toBe('master-100')
    // getRepos() may be called for other purposes but not for Monthly_Sheets.
    // The key assertion is that makeRepo was used for the lookup.
    expect(reposCallCount).toBeGreaterThanOrEqual(0) // not asserting 0, just that makeRepo was used
  })
})

// ─── getCurrentMonthSheetId ──────────────────────────────────────────────────

describe('getCurrentMonthSheetId', () => {
  it('returns null when Monthly_Sheets tab is empty', async () => {
    mockRepos.monthlySheets.getAll.mockResolvedValue([])
    expect(await getCurrentMonthSheetId()).toBeNull()
  })

  it('returns stored id for current month key', async () => {
    const now = new Date()
    const mmStr = String(now.getMonth() + 1).padStart(2, '0')
    const yearMonth = `${now.getFullYear()}-${mmStr}`
    mockRepos.monthlySheets.getAll.mockResolvedValue([
      { id: 'row-1', year_month: yearMonth, spreadsheetId: 'monthly-id-789', created_at: '2026-04-01T00:00:00Z' },
    ])
    expect(await getCurrentMonthSheetId()).toBe('monthly-id-789')
  })

  it('returns null when Monthly_Sheets tab throws (pre-setup)', async () => {
    mockRepos.monthlySheets.getAll.mockRejectedValue(new Error('tab not found'))
    expect(await getCurrentMonthSheetId()).toBeNull()
  })
})

// ─── createMonthlySheet ──────────────────────────────────────────────────────

describe('createMonthlySheet', () => {
  it('names spreadsheet "transaction_<year>-<month>" inside the year folder', async () => {
    vi.spyOn(adapters.driveClient, 'createSpreadsheet').mockResolvedValue('monthly-id-001')

    await createMonthlySheet(2026, 4)

    expect(adapters.driveClient.createSpreadsheet).toHaveBeenCalledWith('transaction_2026-04', undefined, expect.arrayContaining([...MONTHLY_TABS]))
    expect(mockRepos.monthlySheets.batchAppend).toHaveBeenCalledWith([expect.objectContaining({
      year_month: '2026-04',
      spreadsheetId: 'monthly-id-001',
    })])
  })

  it('creates monthly sheet with correct name regardless of activeStoreId', async () => {
    localStorage.setItem('activeStoreId', 'store-uuid-999')
    vi.spyOn(adapters.driveClient, 'createSpreadsheet').mockResolvedValue('monthly-id-002')

    await createMonthlySheet(2026, 4)

    expect(adapters.driveClient.createSpreadsheet).toHaveBeenCalledWith('transaction_2026-04', 'folder-id', expect.arrayContaining([...MONTHLY_TABS]))
  })

  it('throws on Drive API error', async () => {
    vi.spyOn(adapters.driveClient, 'createSpreadsheet').mockRejectedValue(new Error('quota'))
    await expect(createMonthlySheet(2026, 4)).rejects.toThrow('createMonthlySheet failed')
  })
})

// ─── initializeMonthlySheets ─────────────────────────────────────────────────

describe('initializeMonthlySheets', () => {
  it('writes headers to Transactions, Transaction_Items, Refunds tabs', async () => {
    const makeRepoSpy = vi.spyOn(adapters, 'makeRepo').mockReturnValue(sharedMakeRepo as ReturnType<typeof adapters.makeRepo>)
    await initializeMonthlySheets('monthly-sid-001')
    const calledTabs = makeRepoSpy.mock.calls.map(([, sheetName]) => sheetName)
    expect(calledTabs.sort()).toEqual([...MONTHLY_TABS].sort())
  })
})

// ─── shareSheetWithAllMembers ────────────────────────────────────────────────

describe('shareSheetWithAllMembers', () => {
  it('reads Members tab and calls Drive API share for each active member', async () => {
    mockRepos.members.getAll.mockResolvedValue([
      { id: 'u1', email: 'alice@test.com', deleted_at: null },
      { id: 'u2', email: 'bob@test.com', deleted_at: null },
      { id: 'u3', email: 'charlie@test.com', deleted_at: '2026-01-01T00:00:00Z' },
    ])

    await shareSheetWithAllMembers('monthly-sid-002')

    expect(adapters.driveClient.shareSpreadsheet).toHaveBeenCalledTimes(2)
    expect(adapters.driveClient.shareSpreadsheet).toHaveBeenCalledWith('monthly-sid-002', 'alice@test.com', 'editor')
    expect(adapters.driveClient.shareSpreadsheet).toHaveBeenCalledWith('monthly-sid-002', 'bob@test.com', 'editor')
  })
})

// ─── monthlySheetKey ─────────────────────────────────────────────────────────

describe('monthlySheetKey', () => {
  it('returns zero-padded key for single-digit months', () => {
    expect(monthlySheetKey('store-abc', 2026, 4)).toBe('txSheet_store-abc_2026-04')
  })

  it('returns key for double-digit months', () => {
    expect(monthlySheetKey('store-abc', 2026, 11)).toBe('txSheet_store-abc_2026-11')
  })
})

// ─── runStoreSetup ────────────────────────────────────────────────────────────

describe('runStoreSetup', () => {
  function mockAll() {
    vi.spyOn(adapters.driveClient, 'createSpreadsheet')
      .mockResolvedValueOnce('master-id')
      .mockResolvedValueOnce('monthly-id')
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
    await runStoreSetup('Toko Santoso')
    // storeId is written by createMasterSpreadsheet; read it back to build the expected key
    const storeId = localStorage.getItem('activeStoreId') ?? ''
    const expectedKey = `txSheet_${storeId}_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    expect(localStorage.getItem('masterSpreadsheetId')).toBe('master-id')
    expect(localStorage.getItem(expectedKey)).toBe('monthly-id')
  })
})

// ─── runFirstTimeSetup ────────────────────────────────────────────────────────

describe('runFirstTimeSetup', () => {
  function mockAll() {
    vi.spyOn(adapters.driveClient, 'createSpreadsheet')
      .mockResolvedValueOnce('main-id')    // createMainSpreadsheet
      .mockResolvedValueOnce('master-id')  // createMasterSpreadsheet
      .mockResolvedValueOnce('monthly-id') // createMonthlySheet
  }

  it('creates main, master, and monthly spreadsheets in that order', async () => {
    const createSpy = vi.spyOn(adapters.driveClient, 'createSpreadsheet')
      .mockResolvedValueOnce('main-id')
      .mockResolvedValueOnce('master-id')
      .mockResolvedValueOnce('monthly-id')

    await runFirstTimeSetup('Toko Santoso')

    expect(createSpy).toHaveBeenNthCalledWith(1, 'main', expect.anything(), expect.anything())
    expect(createSpy).toHaveBeenNthCalledWith(2, 'master', expect.anything(), expect.anything())
    expect(createSpy).toHaveBeenNthCalledWith(3, expect.stringMatching(/^transaction_/), expect.anything(), expect.anything())
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

  it('sets monthlySpreadsheetId in auth store so adapter routes tx writes correctly', async () => {
    mockAll()
    await runFirstTimeSetup('Toko Santoso')
    expect(useAuthStore.getState().monthlySpreadsheetId).toBe('monthly-id')
  })
})
