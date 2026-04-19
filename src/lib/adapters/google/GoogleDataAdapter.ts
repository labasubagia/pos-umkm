/**
 * GoogleDataAdapter — DataAdapter implementation backed by Google Sheets API v4.
 *
 * Wraps `lib/sheets/sheets.client.ts` and translates the generic DataAdapter
 * interface into concrete Sheets API calls. All Google-specific concerns live
 * here: spreadsheetId management, tab naming, row-to-object mapping, and
 * header row handling.
 *
 * Tab naming convention: sheet tabs are named exactly as the `sheetName`
 * argument (e.g., "Products", "Transactions_2026-04"). The first row of each
 * tab is always the header row; data starts at row 2.
 */
import type { DataAdapter } from '../types'
import { AdapterError } from '../types'
import {
  sheetsAppend,
  sheetsUpdate,
} from '../../sheets/sheets.client'
import { SheetsApiError } from '../../sheets/sheets.types'
import { generateId } from '../../uuid'

const DRIVE_API = 'https://www.googleapis.com/drive/v3'
const MASTER_LS_KEY = 'masterSpreadsheetId'

export class GoogleDataAdapter implements DataAdapter {
  private spreadsheetId: string
  private readonly getToken: () => string

  constructor(spreadsheetId: string, getToken: () => string) {
    this.spreadsheetId = spreadsheetId
    this.getToken = getToken
  }

  /**
   * Fetches all rows from the sheet, maps header columns to object keys,
   * and filters out soft-deleted rows.
   */
  async getSheet(sheetName: string): Promise<Record<string, unknown>[]> {
    try {
      const token = this.getToken()
      // Row 0 is headers (raw, before strip); sheetsGet strips header internally
      // We need the header row to map columns → keys, so fetch with raw range
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values/${encodeURIComponent(sheetName)}`
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        throw new SheetsApiError(res.status, `Sheets API error ${res.status}: ${body}`)
      }
      const data = await res.json()
      const rows: (string | number | boolean)[][] = data.values ?? []
      if (rows.length < 1) return []
      const headers = rows[0] as string[]
      const dataRows = rows.slice(1)
      return dataRows
        .map((row) => {
          const obj: Record<string, unknown> = {}
          headers.forEach((h, i) => {
            obj[h] = row[i] ?? null
          })
          return obj
        })
        .filter((r) => !r['deleted_at'])
    } catch (err) {
      if (err instanceof SheetsApiError) {
        throw new AdapterError(`getSheet failed for "${sheetName}": ${err.message}`, err)
      }
      throw err
    }
  }

  /**
   * Maps the object to an ordered row array (matching header order) and
   * appends it via sheetsAppend.
   */
  async appendRow(sheetName: string, row: Record<string, unknown>): Promise<void> {
    try {
      const token = this.getToken()
      const rowWithId = row['id'] ? row : { id: generateId(), ...row }
      // Append as a single-row 2D array; column order doesn't matter for append
      const values = [Object.values(rowWithId)]
      await sheetsAppend(this.spreadsheetId, sheetName, values as unknown as (string | number | boolean)[][], token)
    } catch (err) {
      if (err instanceof SheetsApiError) {
        throw new AdapterError(`appendRow failed for "${sheetName}": ${err.message}`, err)
      }
      throw err
    }
  }

  /**
   * Finds the row number by id, then updates the specific column cell.
   * Uses sheetsGet to locate the row index, then sheetsUpdate for the cell.
   */
  async updateCell(
    sheetName: string,
    rowId: string,
    column: string,
    value: unknown,
  ): Promise<void> {
    try {
      const token = this.getToken()
      // Fetch raw rows (including header) to find row number
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values/${encodeURIComponent(sheetName)}`
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new SheetsApiError(res.status, `Failed to fetch sheet "${sheetName}"`)
      const data = await res.json()
      const rows: string[][] = data.values ?? []
      if (rows.length < 2) throw new AdapterError(`updateCell: sheet "${sheetName}" has no data rows`)

      const headers = rows[0]
      const colIndex = headers.indexOf(column)
      if (colIndex === -1) throw new AdapterError(`updateCell: column "${column}" not found in "${sheetName}"`)

      // Row index in spreadsheet = header row (1) + data index + 1 (1-based)
      const dataRowIndex = rows.slice(1).findIndex((r) => r[0] === rowId)
      if (dataRowIndex === -1) throw new AdapterError(`updateCell: row "${rowId}" not found in "${sheetName}"`)

      const sheetRowNumber = dataRowIndex + 2 // +1 for header, +1 for 1-based
      const colLetter = columnToLetter(colIndex)
      const range = `${sheetName}!${colLetter}${sheetRowNumber}`
      await sheetsUpdate(this.spreadsheetId, range, [[value as string]], token)
    } catch (err) {
      if (err instanceof AdapterError) throw err
      if (err instanceof SheetsApiError) {
        throw new AdapterError(`updateCell failed: ${err.message}`, err)
      }
      throw err
    }
  }

  /** Stamps `deleted_at` on the row identified by rowId. */
  async softDelete(sheetName: string, rowId: string): Promise<void> {
    await this.updateCell(sheetName, rowId, 'deleted_at', new Date().toISOString())
  }

  /** Updates the active spreadsheetId so subsequent calls target the right sheet. */
  setSpreadsheetId(id: string): void {
    this.spreadsheetId = id
  }

  /**
   * Creates a new Google Spreadsheet via Drive API and returns its id.
   * If parentFolderId is supplied the file is placed inside that Drive folder.
   */
  async createSpreadsheet(name: string, parentFolderId?: string): Promise<string> {
    const token = this.getToken()
    const body: Record<string, unknown> = {
      name,
      mimeType: 'application/vnd.google-apps.spreadsheet',
    }
    if (parentFolderId) body.parents = [parentFolderId]

    const res = await fetch(`${DRIVE_API}/files`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new AdapterError(`createSpreadsheet failed: ${body}`)
    }
    const data = await res.json()
    return data.id as string
  }

  /** Reads the master spreadsheetId from the canonical localStorage key. */
  getSpreadsheetId(_key: string): string | null {
    return localStorage.getItem(MASTER_LS_KEY)
  }

  /**
   * Ensures each folder in `path` exists under the previous one (starting at Drive root).
   * Creates any missing folders. Returns the leaf folder ID.
   * Used to create `apps/pos_umkm/<Store Name>/` before placing spreadsheets there.
   */
  async ensureFolder(path: string[]): Promise<string | null> {
    const token = this.getToken()
    let parentId = 'root'
    for (const name of path) {
      parentId = await ensureDriveFolderUnder(parentId, name, token)
    }
    return parentId
  }

  /** Shares the spreadsheet by creating a Drive permission. */
  async shareSpreadsheet(
    spreadsheetId: string,
    email: string,
    role: 'editor' | 'viewer',
  ): Promise<void> {
    const token = this.getToken()
    const driveRole = role === 'editor' ? 'writer' : 'reader'
    const res = await fetch(`${DRIVE_API}/files/${spreadsheetId}/permissions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ type: 'user', role: driveRole, emailAddress: email }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new AdapterError(`shareSpreadsheet failed: ${body}`)
    }
  }
}

/** Converts a 0-based column index to a spreadsheet column letter (0 → A, 1 → B, …). */
function columnToLetter(index: number): string {
  let result = ''
  let n = index
  while (n >= 0) {
    result = String.fromCharCode((n % 26) + 65) + result
    n = Math.floor(n / 26) - 1
  }
  return result
}

/**
 * Finds or creates a Drive folder named `name` directly under `parentId`.
 * Uses the Drive Files list API to avoid creating duplicate folders.
 */
async function ensureDriveFolderUnder(parentId: string, name: string, token: string): Promise<string> {
  const q = `name=${JSON.stringify(name)} and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`
  const searchUrl = `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id)&spaces=drive`
  const searchRes = await fetch(searchUrl, { headers: { Authorization: `Bearer ${token}` } })
  if (!searchRes.ok) {
    throw new AdapterError(`ensureFolder: search failed for "${name}" (HTTP ${searchRes.status})`)
  }
  const searchData = await searchRes.json()
  const files = searchData.files as Array<{ id: string }>
  if (files.length > 0) return files[0].id

  const createRes = await fetch(`${DRIVE_API}/files`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    }),
  })
  if (!createRes.ok) {
    const body = await createRes.text().catch(() => '')
    throw new AdapterError(`ensureFolder: failed to create "${name}": ${body}`)
  }
  const createData = await createRes.json()
  return createData.id as string
}
