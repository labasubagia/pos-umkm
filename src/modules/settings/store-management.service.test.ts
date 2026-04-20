/**
 * Unit tests for store-management.service.ts
 *
 * All external I/O is mocked:
 *   - makeRepo  → in-memory stub
 *   - createMasterSpreadsheet / initializeMasterSheets → vi.fn()
 *   - useAuthStore → preset state
 *
 * Tests validate the orchestration logic in each service function;
 * lower-level repo / Google Sheets behaviour is tested elsewhere.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as adapters from '../../lib/adapters'
import * as setupService from '../auth/setup.service'
import { useAuthStore } from '../../store/authStore'
import {
  listStores,
  createStore,
  updateStore,
  removeOwnedStore,
  removeAccessToStore,
  StoreManagementError,
} from './store-management.service'
import type { StoreRecord } from '../auth/setup.service'

// ─── Fixtures ────────────────────────────────────────────────────────────────

const MAIN_ID = 'main-spreadsheet-id'
const MASTER_ID_A = 'master-a'
const MASTER_ID_B = 'master-b'

const storeA: StoreRecord = {
  store_id: 'store-a',
  store_name: 'Toko A',
  master_spreadsheet_id: MASTER_ID_A,
  drive_folder_id: 'folder-a',
  owner_email: 'owner@test.com',
  my_role: 'owner',
  joined_at: '2026-01-01T00:00:00Z',
}

const storeB: StoreRecord = {
  store_id: 'store-b',
  store_name: 'Toko B',
  master_spreadsheet_id: MASTER_ID_B,
  drive_folder_id: 'folder-b',
  owner_email: 'other@test.com',
  my_role: 'manager',
  joined_at: '2026-02-01T00:00:00Z',
}

// ─── Mock helpers ─────────────────────────────────────────────────────────────

function makeRepoStub(rows: Record<string, unknown>[] = []) {
  return {
    getAll: vi.fn().mockResolvedValue(rows),
    batchAppend: vi.fn().mockResolvedValue(undefined),
    batchUpdateCells: vi.fn().mockResolvedValue(undefined),
    softDelete: vi.fn().mockResolvedValue(undefined),
    batchUpsertByKey: vi.fn().mockResolvedValue(undefined),
    writeHeaders: vi.fn().mockResolvedValue(undefined),
  }
}

beforeEach(() => {
  vi.restoreAllMocks()
  // Preset auth store: logged-in owner with mainSpreadsheetId
  vi.spyOn(useAuthStore, 'getState').mockReturnValue({
    ...useAuthStore.getState(),
    user: { id: 'u1', email: 'owner@test.com', name: 'Test Owner', role: 'owner' },
    mainSpreadsheetId: MAIN_ID,
  } as ReturnType<typeof useAuthStore.getState>)
  vi.spyOn(setupService, 'getMainSpreadsheetId').mockReturnValue(MAIN_ID)
})

// ─── listStores ───────────────────────────────────────────────────────────────

describe('listStores', () => {
  it('returns all non-deleted stores', async () => {
    const storesRepo = makeRepoStub([storeA, storeB] as unknown as Record<string, unknown>[])
    vi.spyOn(adapters, 'makeRepo').mockReturnValue(storesRepo as unknown as ReturnType<typeof adapters.makeRepo>)

    const result = await listStores()

    expect(storesRepo.getAll).toHaveBeenCalledOnce()
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ store_id: 'store-a', store_name: 'Toko A' })
    expect(result[1]).toMatchObject({ store_id: 'store-b', store_name: 'Toko B' })
  })

  it('excludes rows with deleted_at set (already filtered by getAll via SheetRepository)', async () => {
    // getAll() in SheetRepository filters deleted rows — the service tests that it
    // calls getAll() and maps the returned rows. Rows with deleted_at are not returned by getAll.
    const storesRepo = makeRepoStub([storeA] as unknown as Record<string, unknown>[])
    vi.spyOn(adapters, 'makeRepo').mockReturnValue(storesRepo as unknown as ReturnType<typeof adapters.makeRepo>)

    const result = await listStores()

    expect(result).toHaveLength(1)
    expect(result[0].store_id).toBe('store-a')
  })

  it('throws StoreManagementError when mainSpreadsheetId is not set', async () => {
    vi.spyOn(setupService, 'getMainSpreadsheetId').mockReturnValue(null)

    await expect(listStores()).rejects.toThrow(StoreManagementError)
  })
})

// ─── createStore ──────────────────────────────────────────────────────────────

describe('createStore', () => {
  it('appends a new store row and returns the store with a uuid', async () => {
    const newMasterId = 'master-new'
    vi.spyOn(setupService, 'createMasterSpreadsheet').mockResolvedValue(newMasterId)
    vi.spyOn(setupService, 'initializeMasterSheets').mockResolvedValue(undefined)

    const newStore: StoreRecord = {
      store_id: 'store-new',
      store_name: 'Toko Baru',
      master_spreadsheet_id: newMasterId,
      drive_folder_id: 'folder-new',
      owner_email: 'owner@test.com',
      my_role: 'owner',
      joined_at: '2026-04-21T00:00:00Z',
    }
    const storesRepo = makeRepoStub([newStore] as unknown as Record<string, unknown>[])
    vi.spyOn(adapters, 'makeRepo').mockReturnValue(storesRepo as unknown as ReturnType<typeof adapters.makeRepo>)

    const result = await createStore('Toko Baru')

    expect(setupService.createMasterSpreadsheet).toHaveBeenCalledWith('Toko Baru', 'owner@test.com', MAIN_ID)
    expect(setupService.initializeMasterSheets).toHaveBeenCalledWith(newMasterId)
    expect(result).toMatchObject({ store_name: 'Toko Baru', master_spreadsheet_id: newMasterId })
  })

  it('propagates error when createMasterSpreadsheet fails', async () => {
    vi.spyOn(setupService, 'createMasterSpreadsheet').mockRejectedValue(new Error('Drive API error'))
    vi.spyOn(setupService, 'initializeMasterSheets').mockResolvedValue(undefined)
    vi.spyOn(adapters, 'makeRepo').mockReturnValue(makeRepoStub() as unknown as ReturnType<typeof adapters.makeRepo>)

    await expect(createStore('Toko Gagal')).rejects.toThrow('Drive API error')
  })
})

// ─── updateStore ──────────────────────────────────────────────────────────────

describe('updateStore', () => {
  it('calls batchUpdateCells with the patched store_name', async () => {
    const storesRepo = makeRepoStub()
    vi.spyOn(adapters, 'makeRepo').mockReturnValue(storesRepo as unknown as ReturnType<typeof adapters.makeRepo>)

    await updateStore('store-a', { store_name: 'Toko A Baru' })

    expect(storesRepo.batchUpdateCells).toHaveBeenCalledWith([
      { rowId: 'store-a', column: 'store_name', value: 'Toko A Baru' },
    ])
  })

  it('does nothing when patch is empty or store_name is blank', async () => {
    const storesRepo = makeRepoStub()
    vi.spyOn(adapters, 'makeRepo').mockReturnValue(storesRepo as unknown as ReturnType<typeof adapters.makeRepo>)

    await updateStore('store-a', { store_name: '  ' })

    expect(storesRepo.batchUpdateCells).not.toHaveBeenCalled()
  })
})

// ─── removeOwnedStore ─────────────────────────────────────────────────────────

describe('removeOwnedStore', () => {
  it('soft-deletes the matching store row in the Stores tab', async () => {
    const storesRepo = makeRepoStub([storeA] as unknown as Record<string, unknown>[])
    vi.spyOn(adapters, 'makeRepo').mockReturnValue(storesRepo as unknown as ReturnType<typeof adapters.makeRepo>)

    await removeOwnedStore('store-a')

    expect(storesRepo.batchUpdateCells).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ rowId: 'store-a', column: 'deleted_at' }),
      ]),
    )
  })

  it('throws StoreManagementError if storeId does not exist', async () => {
    const storesRepo = makeRepoStub([])
    vi.spyOn(adapters, 'makeRepo').mockReturnValue(storesRepo as unknown as ReturnType<typeof adapters.makeRepo>)

    await expect(removeOwnedStore('nonexistent')).rejects.toThrow(StoreManagementError)
  })
})

// ─── removeAccessToStore ──────────────────────────────────────────────────────

describe('removeAccessToStore', () => {
  it("soft-deletes the caller's row in the target store's Members tab", async () => {
    const membersRepo = makeRepoStub([
      { id: 'm1', email: 'owner@test.com', role: 'manager', invited_at: '', deleted_at: null },
    ])
    vi.spyOn(adapters, 'makeRepo').mockReturnValue(membersRepo as unknown as ReturnType<typeof adapters.makeRepo>)

    await removeAccessToStore(MASTER_ID_B)

    expect(membersRepo.softDelete).toHaveBeenCalledWith('m1')
  })

  it('throws StoreManagementError if caller is not a member of the store', async () => {
    const membersRepo = makeRepoStub([
      { id: 'm99', email: 'someone-else@test.com', role: 'cashier', invited_at: '', deleted_at: null },
    ])
    vi.spyOn(adapters, 'makeRepo').mockReturnValue(membersRepo as unknown as ReturnType<typeof adapters.makeRepo>)

    await expect(removeAccessToStore(MASTER_ID_B)).rejects.toThrow(StoreManagementError)
  })
})
