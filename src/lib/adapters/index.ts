/**
 * Active adapter selected at build time via VITE_ADAPTER env var.
 *
 * Exports:
 *   getRepos()   — typed per-sheet repositories reading IDs from the auth store.
 *   driveClient  — Drive/spreadsheet management (createSpreadsheet, ensureFolder, shareSpreadsheet).
 *   makeRepo()   — one-off repo for a specific (spreadsheetId, sheetName); use in setup code
 *                  before a fresh ID has been persisted to the auth store.
 *   authAdapter  — authentication adapter.
 *
 * Feature modules import from here only — never from sub-modules directly.
 *
 * Vite tree-shakes the unused adapter out of the production bundle because
 * the conditional is resolved at build time (import.meta.env is static).
 *
 * Usage:
 *   VITE_ADAPTER=mock   → MockSheetRepository + MockDriveClient + MockAuthAdapter (dev/CI)
 *   VITE_ADAPTER=google → SheetRepository + GoogleDriveClient + GoogleAuthAdapter (production)
 */
import type { IDriveClient } from './DriveClient'
import { GoogleDriveClient, MockDriveClient } from './DriveClient'
import type { AuthAdapter } from './types'
import { GoogleAuthAdapter } from './google/GoogleAuthAdapter'
import { MockAuthAdapter } from './mock/MockAuthAdapter'
import type { ISheetRepository } from './SheetRepository'
import { SheetRepository } from './SheetRepository'
import { MockSheetRepository } from './MockSheetRepository'
import { createGoogleRepos, createMockRepos } from './repos'
import type { Repos } from './repos'

// Lazy import to avoid circular dependency (authStore imports from here indirectly via services)
import { useAuthStore } from '../../store/authStore'

const adapterType = import.meta.env.VITE_ADAPTER ?? 'mock'

export const authAdapter: AuthAdapter = adapterType === 'google'
  ? new GoogleAuthAdapter()
  : new MockAuthAdapter()

const getToken = (): string =>
  adapterType === 'google' ? (authAdapter as GoogleAuthAdapter).getAccessToken() ?? '' : ''

export const driveClient: IDriveClient = adapterType === 'google'
  ? new GoogleDriveClient(getToken)
  : new MockDriveClient()

/** Returns typed repo instances reading IDs from the current auth store state. */
export function getRepos(): Repos {
  if (adapterType === 'google') {
    const { mainSpreadsheetId, spreadsheetId, monthlySpreadsheetId } = useAuthStore.getState()
    return createGoogleRepos(
      mainSpreadsheetId ?? '',
      spreadsheetId ?? '',
      monthlySpreadsheetId ?? '',
      getToken,
    )
  }
  return createMockRepos()
}

/**
 * Creates a one-off repo for a specific spreadsheetId + sheetName.
 * Use in setup/initialization code where a freshly-created spreadsheet ID
 * is not yet stored in the auth store.
 */
export function makeRepo<T extends Record<string, unknown>>(
  spreadsheetId: string,
  sheetName: string,
): ISheetRepository<T> {
  if (adapterType === 'google') {
    return new SheetRepository<T>(spreadsheetId, sheetName, getToken)
  }
  return new MockSheetRepository<T>(sheetName)
}

export type { IDriveClient, ISheetRepository, Repos }
export type { AuthAdapter }
export { AdapterError } from './types'
export type { User, Role } from './types'
