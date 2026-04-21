/**
 * store-management.service.ts — Create, edit, and remove stores for an owner.
 *
 * All reads and mutations use the Dexie offline-first adapter (via getRepos()).
 * Stores are cached in the active store's Dexie DB; writes are queued to the
 * outbox (or inserted locally for remote-first operations like createStore).
 *
 * Ownership check: the caller's email is compared against store.owner_email
 * (written when the store was created). This is enforced in the UI; the
 * service itself does not restrict by ownership — it trusts the caller.
 */

import { getRepos, localCachePut, getMembersForStore } from '../../lib/adapters'
import { nowUTC } from '../../lib/formatters'
import { useAuthStore } from '../../store/authStore'
import {
  createMasterSpreadsheet,
  initializeMasterSheets,
  getMainSpreadsheetId,
  type StoreRecord,
} from '../auth/setup.service'

// ─── Error class ──────────────────────────────────────────────────────────────

export class StoreManagementError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StoreManagementError'
  }
}

// ─── Private helpers ──────────────────────────────────────────────────────────

/** Returns mainSpreadsheetId or throws if the user is not logged in. */
function requireMainId(): string {
  const id = getMainSpreadsheetId()
  if (!id) throw new StoreManagementError('mainSpreadsheetId not set; user must be logged in')
  return id
}

/** Maps a raw Stores-tab row to a typed StoreRecord. */
function toStoreRecord(r: Record<string, unknown>): StoreRecord {
  return {
    store_id: String(r['store_id']),
    store_name: String(r['store_name'] ?? ''),
    master_spreadsheet_id: String(r['master_spreadsheet_id']),
    drive_folder_id: String(r['drive_folder_id'] ?? ''),
    owner_email: String(r['owner_email'] ?? ''),
    my_role: String(r['my_role'] ?? 'owner'),
    joined_at: String(r['joined_at'] ?? ''),
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns all stores the user has access to, excluding soft-deleted entries.
 *
 * Reads from the Dexie offline-first cache (getRepos().stores). HydrationService
 * normalizes Stores rows to include `id = store_id` so Dexie lookups work.
 */
export async function listStores(): Promise<StoreRecord[]> {
  requireMainId()
  const rows = await getRepos().stores.getAll()
  return rows
    .filter((r) => r['store_id'] && r['master_spreadsheet_id'])
    .map(toStoreRecord)
}

/**
 * Creates a new store:
 *   1. Provisions a new master spreadsheet via createMasterSpreadsheet()
 *      (creates Drive folder + spreadsheet + registers row in main.Stores via Sheets API).
 *   2. Writes column headers to every master-sheet tab.
 *   3. Inserts the new store record into Dexie local cache (no outbox — remote already has it).
 *
 * Writes the Dexie cache directly to avoid a duplicate outbox write (createMasterSpreadsheet
 * already appended to Sheets via the raw SheetRepository).
 */
export async function createStore(name: string): Promise<StoreRecord> {
  const trimmedName = name.trim()
  if (!trimmedName) throw new StoreManagementError('createStore: store name cannot be empty')

  const ownerEmail = useAuthStore.getState().user?.email ?? ''
  const mainId = requireMainId()

  const { masterId, storeId, driveFolderId } = await createMasterSpreadsheet(trimmedName, ownerEmail, mainId)
  await initializeMasterSheets(masterId)

  const record: StoreRecord = {
    store_id: storeId,
    store_name: trimmedName,
    master_spreadsheet_id: masterId,
    drive_folder_id: driveFolderId,
    owner_email: ownerEmail,
    my_role: 'owner',
    joined_at: nowUTC(),
  }

  // Insert into local Dexie cache without queueing an outbox entry — the remote
  // write already happened inside createMasterSpreadsheet.
  // id = storeId so that batchUpdateCells / softDelete can look up by primary key.
  await localCachePut('Stores', [{ ...record, id: storeId }])

  return record
}

/**
 * Updates editable store fields. Currently only store_name is supported.
 * No-op when the patch contains no meaningful changes.
 */
export async function updateStore(
  storeId: string,
  patch: Partial<Pick<StoreRecord, 'store_name'>>,
): Promise<void> {
  const trimmedName = patch.store_name?.trim()
  if (!trimmedName) return

  await getRepos().stores.batchUpdate([
    { id: storeId, store_name: trimmedName },
  ])
}

/**
 * Soft-deletes an owned store row in main.Stores by stamping deleted_at.
 *
 * The store's master spreadsheet and all transaction data are preserved —
 * a hard delete is intentionally avoided to prevent accidental data loss.
 * The store becomes invisible to all members after the next hydration cycle.
 *
 * Throws StoreManagementError if storeId is not found in main.Stores.
 */
export async function removeOwnedStore(storeId: string): Promise<void> {
  const repo = getRepos().stores

  // Verify the store exists before stamping — avoids silent no-ops.
  const rows = await repo.getAll()
  const exists = rows.some((r) => r['store_id'] === storeId)
  if (!exists) {
    throw new StoreManagementError(`removeOwnedStore: store "${storeId}" not found`)
  }

  await repo.batchUpdate([{ id: storeId, deleted_at: nowUTC() }])
}

/**
 * Removes the caller's own access to a non-owned store by soft-deleting their
 * row in the target store's Members tab.
 *
 * Reads from and writes to the Dexie DB for the target store (identified by
 * looking up store_id from the Stores list).
 *
 * Throws StoreManagementError if the caller is not found in Members.
 */
export async function removeAccessToStore(masterSpreadsheetId: string): Promise<void> {
  const callerEmail = useAuthStore.getState().user?.email
  if (!callerEmail) throw new StoreManagementError('removeAccessToStore: user not authenticated')

  // Resolve the target storeId from the cached Stores list.
  const stores = await listStores()
  const targetStore = stores.find((s) => s.master_spreadsheet_id === masterSpreadsheetId)
  const targetStoreId = targetStore?.store_id ?? masterSpreadsheetId

  const membersRepo = getMembersForStore(targetStoreId, masterSpreadsheetId)
  const members = await membersRepo.getAll()
  const myRow = members.find((r) => r['email'] === callerEmail)
  if (!myRow) {
    throw new StoreManagementError(
      `removeAccessToStore: caller "${callerEmail}" not found in Members`,
    )
  }

  await membersRepo.softDelete(String(myRow['id']))
}
