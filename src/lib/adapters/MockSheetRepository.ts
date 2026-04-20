/**
 * MockSheetRepository — ISheetRepository backed by localStorage.
 *
 * Mirrors the tab-naming convention of the real adapter so mock and
 * production data structures are identical — switching adapters requires
 * no migration logic in feature modules.
 */
import type { ISheetRepository } from './SheetRepository'
import { AdapterError } from './types'
import { generateId } from '../uuid'

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

export class MockSheetRepository<T extends Record<string, unknown>> implements ISheetRepository<T> {
  readonly spreadsheetId = 'mock'
  readonly sheetName: string

  constructor(sheetName: string) {
    this.sheetName = sheetName
  }

  async getAll(): Promise<T[]> {
    return readRows(this.sheetName).filter((r) => !r['deleted_at']) as T[]
  }

  async batchAppend(rows: Array<Partial<T> & Record<string, unknown>>): Promise<void> {
    const existing = readRows(this.sheetName)
    for (const row of rows) {
      existing.push({ id: generateId(), ...row })
    }
    writeRows(this.sheetName, existing)
  }

  async batchUpdateCells(updates: Array<{ rowId: string; column: string; value: unknown }>): Promise<void> {
    const rows = readRows(this.sheetName)
    for (const { rowId, column, value } of updates) {
      const idx = rows.findIndex((r) => r['id'] === rowId)
      if (idx === -1) {
        throw new AdapterError(
          `MockSheetRepository.batchUpdateCells: row "${rowId}" not found in "${this.sheetName}"`,
        )
      }
      rows[idx] = { ...rows[idx], [column]: value }
    }
    writeRows(this.sheetName, rows)
  }

  async batchUpsertByKey(
    lookupColumn: string,
    updateColumn: string,
    entries: Array<{ lookupValue: string; value: unknown }>,
    makeNewRow: (lookupValue: string, value: unknown) => Record<string, unknown>,
  ): Promise<void> {
    const toUpdate: Array<{ rowId: string; column: string; value: unknown }> = []
    const toAppend: Array<Partial<T> & Record<string, unknown>> = []
    const rows = readRows(this.sheetName).filter((r) => !r['deleted_at'])
    for (const { lookupValue, value } of entries) {
      const existing = rows.find((r) => r[lookupColumn] === lookupValue)
      if (existing) {
        toUpdate.push({ rowId: existing['id'] as string, column: updateColumn, value })
      } else {
        toAppend.push(makeNewRow(lookupValue, value) as Partial<T> & Record<string, unknown>)
      }
    }
    if (toUpdate.length > 0) await this.batchUpdateCells(toUpdate)
    if (toAppend.length > 0) await this.batchAppend(toAppend)
  }

  async softDelete(rowId: string): Promise<void> {
    const rows = readRows(this.sheetName)
    const idx = rows.findIndex((r) => r['id'] === rowId)
    if (idx === -1) {
      throw new AdapterError(
        `MockSheetRepository.softDelete: row "${rowId}" not found in "${this.sheetName}"`,
      )
    }
    rows[idx] = { ...rows[idx], deleted_at: new Date().toISOString() }
    writeRows(this.sheetName, rows)
  }

  async writeHeaders(_headers: string[]): Promise<void> {
    // no-op: mock uses object keys directly, no header row needed
  }
}
