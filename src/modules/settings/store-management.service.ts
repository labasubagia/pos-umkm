/**
 * store-management.service.ts — Create, edit, and remove stores for an owner.
 *
 * All mutations go through makeRepo (ISheetRepository<T>) so they work with
 * both the Google adapter (offline-first via Dexie) and the Mock adapter.
 *
 * The Stores tab lives on the main spreadsheet (one per Google account) rather
 * than on the per-store master spreadsheet. This service always reads/writes
 * the main spreadsheet directly via makeRepo() — never via getRepos(), which
 * is scoped to the active master spreadsheet.
 *
 * Ownership check: the caller's email is compared against store.owner_email
 * (written when the store was created). This is enforced in the UI; the
 * service itself does not restrict by ownership — it trusts the caller.
 */

import { makeRepo } from '../../lib/adapters'
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
 * Uses makeRepo (raw SheetRepository / Mock) rather than getRepos().stores
 * because the Stores tab uses `store_id` as its primary key, not `id`.
 * SheetRepository.getAll() already filters rows where deleted_at is set.
 */
export async function listStores(): Promise<StoreRecord[]> {
  const mainId = requireMainId()
  const rows = await makeRepo(mainId, 'Stores').getAll()
  return rows
    .filter((r) => r['store_id'] && r['master_spreadsheet_id'])
    .map(toStoreRecord)
}

/**
 * Creates a new store:
 *   1. Provisions a new master spreadsheet via createMasterSpreadsheet()
 *      (creates Drive folder + spreadsheet + registers row in main.Stores).
 *   2. Writes column headers to every master-sheet tab.
 *   3. Re-reads main.Stores to return the persisted StoreRecord.
 *
 * The store_id is generated inside createMasterSpreadsheet; re-reading after
 * creation is the simplest way to return it without modifying the existing
 * setup-service signature.
 */
export async function createStore(name: string): Promise<StoreRecord> {
  const trimmedName = name.trim()
  if (!trimmedName) throw new StoreManagementError('createStore: store name cannot be empty')

  const mainId = requireMainId()
  const ownerEmail = useAuthStore.getState().user?.email ?? ''

  const masterId = await createMasterSpreadsheet(trimmedName, ownerEmail, mainId)
  await initializeMasterSheets(masterId)

  // Re-read so the returned record includes the generated store_id.
  const stores = await listStores()
  const created = stores.find((s) => s.master_spreadsheet_id === masterId)
  if (!created) throw new StoreManagementError('createStore: store not found after creation')
  return created
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

  const mainId = requireMainId()
  await makeRepo(mainId, 'Stores').batchUpdateCells([
    { rowId: storeId, column: 'store_name', value: trimmedName },
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
  const mainId = requireMainId()
  const repo = makeRepo(mainId, 'Stores')

  // Verify the store exists before stamping — avoids silent no-ops.
  const rows = await repo.getAll()
  const exists = rows.some((r) => r['store_id'] === storeId)
  if (!exists) {
    throw new StoreManagementError(`removeOwnedStore: store "${storeId}" not found`)
  }

  await repo.batchUpdateCells([{ rowId: storeId, column: 'deleted_at', value: nowUTC() }])
}

/**
 * Removes the caller's own access to a non-owned store by soft-deleting their
 * row in the target store's Members tab.
 *
 * Does NOT modify main.Stores — the store record remains in the owner's
 * spreadsheet. Only the caller's membership entry is revoked.
 *
 * Throws StoreManagementError if the caller is not found in Members.
 */
export async function removeAccessToStore(masterSpreadsheetId: string): Promise<void> {
  const callerEmail = useAuthStore.getState().user?.email
  if (!callerEmail) throw new StoreManagementError('removeAccessToStore: user not authenticated')

  const membersRepo = makeRepo<Record<string, unknown>>(masterSpreadsheetId, 'Members')
  const members = await membersRepo.getAll()
  const myRow = members.find((r) => r['email'] === callerEmail)
  if (!myRow) {
    throw new StoreManagementError(
      `removeAccessToStore: caller "${callerEmail}" not found in Members`,
    )
  }

  await membersRepo.softDelete(String(myRow['id']))
}
