/**
 * MockDataAdapter — DataAdapter implementation backed by localStorage.
 *
 * Stores data in localStorage under keys like `mock_Products`,
 * `mock_Transactions_2026-04`. The naming mirrors the Google Sheets tab
 * convention so that mock and production data structures are identical —
 * switching adapters never requires migration logic in feature modules.
 *
 * `getSheet` silently filters rows with a `deleted_at` value (soft delete).
 */
import type { DataAdapter } from '../types'
import { AdapterError } from '../types'
import { generateId } from '../../uuid'

function storageKey(sheetName: string): string {
  return `mock_${sheetName}`
}

function readRows(sheetName: string): Record<string, unknown>[] {
  const raw = localStorage.getItem(storageKey(sheetName))
  if (!raw) return []
  try {
    return JSON.parse(raw) as Record<string, unknown>[]
  } catch {
    return []
  }
}

function writeRows(sheetName: string, rows: Record<string, unknown>[]): void {
  localStorage.setItem(storageKey(sheetName), JSON.stringify(rows))
}

export class MockDataAdapter implements DataAdapter {
  /** Returns all rows that have not been soft-deleted. */
  async getSheet(sheetName: string): Promise<Record<string, unknown>[]> {
    return readRows(sheetName).filter((r) => !r['deleted_at'])
  }

  /** Appends a row; auto-generates `id` via UUID if not supplied. */
  async appendRow(sheetName: string, row: Record<string, unknown>): Promise<void> {
    const rows = readRows(sheetName)
    const newRow = { id: generateId(), ...row }
    rows.push(newRow)
    writeRows(sheetName, rows)
  }

  /** Updates a single field on the row matching `rowId`. */
  async updateCell(
    sheetName: string,
    rowId: string,
    column: string,
    value: unknown,
  ): Promise<void> {
    const rows = readRows(sheetName)
    const idx = rows.findIndex((r) => r['id'] === rowId)
    if (idx === -1) {
      throw new AdapterError(`MockDataAdapter.updateCell: row "${rowId}" not found in "${sheetName}"`)
    }
    rows[idx] = { ...rows[idx], [column]: value }
    writeRows(sheetName, rows)
  }

  /**
   * Soft-deletes a row by stamping `deleted_at` with the current UTC timestamp.
   * The row remains in localStorage but is excluded by getSheet.
   */
  async softDelete(sheetName: string, rowId: string): Promise<void> {
    const rows = readRows(sheetName)
    const idx = rows.findIndex((r) => r['id'] === rowId)
    if (idx === -1) {
      throw new AdapterError(`MockDataAdapter.softDelete: row "${rowId}" not found in "${sheetName}"`)
    }
    rows[idx] = { ...rows[idx], deleted_at: new Date().toISOString() }
    writeRows(sheetName, rows)
  }

  /**
   * Creates a fake spreadsheet by generating a UUID and storing it under
   * a mock-specific localStorage key. Uses a separate key from the Google
   * adapter so mock and google sessions never contaminate each other.
   */
  async createSpreadsheet(_name: string, _parentFolderId?: string, _tabs?: string[]): Promise<string> {
    const id = generateId()
    localStorage.setItem('mock_masterSpreadsheetId', id)
    return id
  }

  /** Reads the mock master spreadsheetId from the mock-specific localStorage key. */
  getSpreadsheetId(_key: string): string | null {
    return localStorage.getItem('mock_masterSpreadsheetId')
  }

  /** No-op — MockDataAdapter has no real spreadsheetId to update. */
  setSpreadsheetId(_id: string): void {
    // intentional no-op: mock adapter doesn't use a spreadsheetId field
  }

  /**
   * No-op in the mock adapter.
   * Logs to console so developers can see the intent during local dev.
   */
  async shareSpreadsheet(
    spreadsheetId: string,
    email: string,
    role: 'editor' | 'viewer',
  ): Promise<void> {
    console.debug(`[MockDataAdapter] shareSpreadsheet: ${spreadsheetId} → ${email} (${role})`)
  }
}
