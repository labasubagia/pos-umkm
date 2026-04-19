/**
 * DataAdapter & AuthAdapter interfaces — the central data contract.
 *
 * All module service files import from `lib/adapters/` only — never from
 * `lib/sheets/` directly. Defining the interface before any implementation
 * enforces the contract that both Mock and Google adapters must satisfy.
 * TypeScript's structural typing catches divergence at compile time.
 */

/** Role hierarchy: cashier < manager < owner */
export type Role = 'owner' | 'manager' | 'cashier'

export interface User {
  id: string
  email: string
  name: string
  role: Role
}

/**
 * DataAdapter — abstracts all data read/write operations.
 * Implementations: MockDataAdapter (localStorage), GoogleDataAdapter (Sheets API).
 */
export interface DataAdapter {
  /** Returns all non-deleted rows from the named sheet as objects. */
  getSheet(sheetName: string): Promise<Record<string, unknown>[]>

  /** Appends a new row to the named sheet. Generates a UUID `id` if none provided. */
  appendRow(sheetName: string, row: Record<string, unknown>): Promise<void>

  /**
   * Updates a single cell identified by rowId and column name.
   * Throws AdapterError if the row is not found.
   */
  updateCell(sheetName: string, rowId: string, column: string, value: unknown): Promise<void>

  /**
   * Updates multiple cells in the same sheet in a single API round-trip.
   * More efficient than calling updateCell N times when saving multiple fields.
   * Throws AdapterError if any row or column is not found.
   */
  batchUpdateCells(
    sheetName: string,
    updates: Array<{ rowId: string; column: string; value: unknown }>,
  ): Promise<void>

  /**
   * Upsert by a named lookup column in a single API round-trip.
   * Reads the sheet once, batch-updates rows where lookupColumn matches,
   * and appends new rows for unmatched entries using makeNewRow.
   * Ideal for key-value store sheets (e.g. Settings).
   */
  batchUpsertByKey(
    sheetName: string,
    lookupColumn: string,
    updateColumn: string,
    entries: Array<{ lookupValue: string; value: unknown }>,
    makeNewRow: (lookupValue: string, value: unknown) => Record<string, unknown>,
  ): Promise<void>

  /**
   * Soft-deletes a row by setting its `deleted_at` timestamp.
   * The row is never physically removed; getSheet filters it out.
   * Throws AdapterError if the row is not found.
   */
  softDelete(sheetName: string, rowId: string): Promise<void>

  /**
   * Creates a new spreadsheet in the owner's Google Drive.
   * For MockDataAdapter this stores a fake UUID in localStorage.
   * @param parentFolderId Optional Drive folder ID to place the file inside.
   * @param tabs Optional list of sheet tab names to create upfront. If omitted,
   *             only the default "Sheet1" tab is created by Google Sheets.
   * Returns the spreadsheetId.
   */
  createSpreadsheet(name: string, parentFolderId?: string, tabs?: string[]): Promise<string>

  /**
   * Reads the spreadsheetId for a given key from localStorage.
   * Returns null if not found (triggers setup flow).
   */
  getSpreadsheetId(key: string): string | null

  /**
   * Updates the active spreadsheetId on the adapter instance.
   * Must be called after setup or sign-in so that getSheet/appendRow/etc.
   * target the correct spreadsheet. No-op in MockDataAdapter.
   */
  setSpreadsheetId(id: string): void

  /**
   * Sets the monthly transaction spreadsheet ID.
   * After this call, reads/writes to Transactions, Transaction_Items, and Refunds
   * tabs are routed to this spreadsheet; all other tabs continue to use the
   * master spreadsheetId. No-op in MockDataAdapter (mock stores all tabs in
   * localStorage with no multi-spreadsheet concept).
   */
  setMonthlySpreadsheetId(id: string): void

  /**
   * Writes a header row (row 1) to the named sheet tab.
   * Must be called once after a new spreadsheet is created so that appendRow
   * can map object keys to the correct column positions.
   * No-op in MockDataAdapter (mock uses object keys directly).
   */
  writeHeaders(sheetName: string, headers: string[]): Promise<void>

  /**
   * Ensures a Drive folder hierarchy exists and returns the leaf folder ID.
   * Path is an ordered list of folder names from root: ['apps', 'pos_umkm', 'Toko LB'].
   * Returns null in MockDataAdapter (mock never touches Drive).
   * Optional — only GoogleDataAdapter implements this.
   */
  ensureFolder?(path: string[]): Promise<string | null>

  /**
   * Shares a spreadsheet with another Google account.
   * No-op in MockDataAdapter (logs to console in dev).
   */
  shareSpreadsheet(spreadsheetId: string, email: string, role: 'editor' | 'viewer'): Promise<void>
}

/**
 * AuthAdapter — abstracts authentication.
 * Implementations: MockAuthAdapter (preset user), GoogleAuthAdapter (GIS OAuth).
 */
export interface AuthAdapter {
  /** Initiates the OAuth flow and returns the signed-in user. */
  signIn(): Promise<User>

  /** Signs out the current user and clears the session. */
  signOut(): Promise<void>

  /**
   * Tries to restore a previous session from localStorage without an OAuth popup.
   * Returns the cached User if the stored token is still valid, null if the user
   * must sign in again. No-op (returns null) in MockAuthAdapter.
   */
  restoreSession(): Promise<User | null>

  /** Returns the current user from memory, or null if not signed in. */
  getCurrentUser(): User | null

  /** Returns the OAuth access token, or null if not signed in. */
  getAccessToken(): string | null
}

/** Thrown by adapters when an operation fails due to data or API issues. */
export class AdapterError extends Error {
  readonly cause?: unknown

  constructor(message: string, cause?: unknown) {
    super(message)
    this.name = 'AdapterError'
    this.cause = cause
  }
}
