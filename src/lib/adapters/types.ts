/**
 * DataAdapter & AuthAdapter interfaces — the central data contract.
 *
 * All module service files import from `lib/adapters/` only — never from
 * `lib/sheets/` directly. Defining the interface before any implementation
 * enforces the contract that both Mock and Google adapters must satisfy.
 * TypeScript's structural typing catches divergence at compile time.
 */

export interface User {
  id: string
  email: string
  name: string
  /** 'owner' has full access; 'member' has cashier-only access */
  role: 'owner' | 'member'
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
   * Soft-deletes a row by setting its `deleted_at` timestamp.
   * The row is never physically removed; getSheet filters it out.
   * Throws AdapterError if the row is not found.
   */
  softDelete(sheetName: string, rowId: string): Promise<void>

  /**
   * Creates a new spreadsheet (Master Sheet) in the owner's Google Drive.
   * For MockDataAdapter this stores a fake UUID in localStorage.
   * Returns the spreadsheetId.
   */
  createSpreadsheet(name: string): Promise<string>

  /**
   * Reads the spreadsheetId for a given key from localStorage.
   * Returns null if not found (triggers setup flow).
   */
  getSpreadsheetId(key: string): string | null

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

  /** Returns the current user from memory, or null if not signed in. */
  getCurrentUser(): User | null

  /** Returns the OAuth access token, or null if not signed in. */
  getAccessToken(): string | null
}

/** Thrown by adapters when an operation fails due to data or API issues. */
export class AdapterError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'AdapterError'
  }
}
