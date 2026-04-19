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

/** Tabs that live in the monthly transaction spreadsheet (not the master). */
const MONTHLY_TAB_NAMES = new Set(['Transactions', 'Transaction_Items', 'Refunds'])

export class GoogleDataAdapter implements DataAdapter {
  private spreadsheetId: string         // master spreadsheet
  private monthlySpreadsheetId: string  // current month's transaction spreadsheet
  private readonly getToken: () => string

  constructor(spreadsheetId: string, getToken: () => string) {
    this.spreadsheetId = spreadsheetId
    this.monthlySpreadsheetId = ''
    this.getToken = getToken
  }

  /** Routes to monthly spreadsheet for transaction tabs; master for everything else. */
  private resolveId(sheetName: string): string {
    if (MONTHLY_TAB_NAMES.has(sheetName) && this.monthlySpreadsheetId) {
      return this.monthlySpreadsheetId
    }
    return this.spreadsheetId
  }

  /**
   * Fetches all rows from the sheet, maps header columns to object keys,
   * and filters out soft-deleted rows.
   */
  async getSheet(sheetName: string): Promise<Record<string, unknown>[]> {
    try {
      const token = this.getToken()
      const sid = this.resolveId(sheetName)
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${sid}/values/${encodeURIComponent(sheetName)}`
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
   * Writes the header row (row 1) to the named sheet tab using values.update.
   * Must be called once after a new tab is created so that appendRow can map
   * object keys to the correct column positions.
   */
  async writeHeaders(sheetName: string, headers: string[]): Promise<void> {
    const token = this.getToken()
    const sid = this.resolveId(sheetName)
    // Encode only the sheet name; keep the range notation (!1:1) unencoded.
    const range = `${sheetName}!1:1`
    const encodedRange = `${encodeURIComponent(sheetName)}!1:1`
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sid}/values/${encodedRange}?valueInputOption=RAW`,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ range, majorDimension: 'ROWS', values: [headers] }),
      },
    )
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new AdapterError(`writeHeaders failed for "${sheetName}": ${body}`)
    }
  }

  async appendRow(sheetName: string, row: Record<string, unknown>): Promise<void> {
    try {
      const token = this.getToken()
      const sid = this.resolveId(sheetName)
      const rowWithId = row['id'] ? row : { id: generateId(), ...row }

      // Fetch only row 1 (header) to determine column order.
      // Encode the sheet name only; append the range notation unencoded.
      const headerUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sid}/values/${encodeURIComponent(sheetName)}!1:1`
      const headerRes = await fetch(headerUrl, { headers: { Authorization: `Bearer ${token}` } })
      let values: unknown[]
      if (headerRes.ok) {
        const headerData = await headerRes.json()
        const headers: string[] = (headerData.values?.[0] ?? []) as string[]
        if (headers.length > 0) {
          values = headers.map((h) => rowWithId[h] ?? null)
        } else {
          values = Object.values(rowWithId)
        }
      } else {
        values = Object.values(rowWithId)
      }

      await sheetsAppend(sid, sheetName, [values] as unknown as (string | number | boolean)[][], token)
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
      const sid = this.resolveId(sheetName)
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${sid}/values/${encodeURIComponent(sheetName)}`
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
      await sheetsUpdate(sid, range, [[value as string]], token)
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

  /** Routes Transactions/Transaction_Items/Refunds writes to the monthly spreadsheet. */
  setMonthlySpreadsheetId(id: string): void {
    this.monthlySpreadsheetId = id
  }

  /**
   * Creates a new Google Spreadsheet via the Sheets API (not Drive API) so
   * that tab names can be specified upfront. The Sheets API returns the real
   * spreadsheetId directly; the Drive API file-create endpoint does not.
   *
   * Follows the "find or create" pattern from the reference implementation:
   * if a spreadsheet with the same name already exists in the target folder
   * (e.g., from a failed previous setup attempt), its ID is returned instead
   * of creating a duplicate.
   *
   * After creation the file lives in "My Drive" root. If parentFolderId is
   * supplied the file is moved there via a Drive PATCH call.
   */
  async createSpreadsheet(name: string, parentFolderId?: string, tabs?: string[]): Promise<string> {
    const token = this.getToken()

    // ── "Find or create" ────────────────────────────────────────────────────
    // If a spreadsheet with the same name already exists in the target folder,
    // return its ID — prevents duplicates when setup is retried after a failure.
    if (parentFolderId) {
      const q = `name=${JSON.stringify(name)} and mimeType='application/vnd.google-apps.spreadsheet' and '${parentFolderId}' in parents and trashed=false`
      const searchRes = await fetch(
        `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id)&spaces=drive`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      if (searchRes.ok) {
        const searchData = await searchRes.json()
        const files = searchData.files as Array<{ id: string }>
        if (files.length > 0) return files[0].id
      }
    }

    // ── Create via Sheets API ────────────────────────────────────────────────
    // Build the Sheets API body — define all tabs upfront so appendRow never
    // hits a 404 because the tab doesn't exist yet.
    const sheetsBody: Record<string, unknown> = { properties: { title: name } }
    if (tabs && tabs.length > 0) {
      sheetsBody.sheets = tabs.map((title) => ({ properties: { title } }))
    }

    const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(sheetsBody),
    })
    if (!createRes.ok) {
      const body = await createRes.text().catch(() => '')
      throw new AdapterError(`createSpreadsheet failed: ${body}`)
    }
    const data = await createRes.json()
    const spreadsheetId = data.spreadsheetId as string

    // ── Move to target folder ────────────────────────────────────────────────
    // Sheets API always creates in "My Drive" root, so move via Drive PATCH.
    if (parentFolderId) {
      const metaRes = await fetch(`${DRIVE_API}/files/${spreadsheetId}?fields=parents`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (metaRes.ok) {
        const meta = await metaRes.json()
        const currentParents = ((meta.parents as string[]) ?? []).join(',')
        await fetch(
          `${DRIVE_API}/files/${spreadsheetId}?addParents=${parentFolderId}&removeParents=${currentParents}&fields=id`,
          { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } },
        )
      }
    }

    return spreadsheetId
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
