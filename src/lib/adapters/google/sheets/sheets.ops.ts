/**
 * Higher-level Google Sheets operations used exclusively by GoogleDataAdapter.
 *
 * Sits above the raw HTTP transport in sheets.client.ts and handles
 * row-to-object mapping, header resolution, and column lookup. Each
 * function takes explicit (spreadsheetId, token) arguments to remain
 * stateless and independently testable. Error translation from
 * SheetsApiError → AdapterError happens here so GoogleDataAdapter stays thin.
 */
import { sheetsAppend, sheetsUpdate, sheetsBatchUpdate } from './sheets.client'
import { SheetsApiError } from './sheets.types'
import { AdapterError } from '../../types'
import { generateId } from '../../../uuid'

const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets'

/**
 * Fetches all rows from the sheet, maps header columns to object keys,
 * and filters out soft-deleted rows.
 */
export async function getSheet(
  spreadsheetId: string,
  sheetName: string,
  token: string,
): Promise<Record<string, unknown>[]> {
  try {
    const url = `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(sheetName)}`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new SheetsApiError(res.status, `Sheets API error ${res.status}: ${body}`)
    }
    const data = await res.json()
    const rows: (string | number | boolean)[][] = data.values ?? []
    if (rows.length < 1) return []
    const headers = rows[0] as string[]
    return rows
      .slice(1)
      .map((row) => {
        const obj: Record<string, unknown> = {}
        headers.forEach((h, i) => { obj[h] = row[i] ?? null })
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
export async function writeHeaders(
  spreadsheetId: string,
  sheetName: string,
  headers: string[],
  token: string,
): Promise<void> {
  const range = `${sheetName}!1:1`
  const encodedRange = `${encodeURIComponent(sheetName)}!1:1`
  const res = await fetch(
    `${SHEETS_BASE}/${spreadsheetId}/values/${encodedRange}?valueInputOption=RAW`,
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

/**
 * Appends a row to the sheet. Fetches header row first to determine column
 * order so object keys are mapped to the correct columns.
 */
export async function appendRow(
  spreadsheetId: string,
  sheetName: string,
  row: Record<string, unknown>,
  token: string,
): Promise<void> {
  try {
    const rowWithId = row['id'] ? row : { id: generateId(), ...row }
    const headerUrl = `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!1:1`
    const headerRes = await fetch(headerUrl, { headers: { Authorization: `Bearer ${token}` } })
    let values: unknown[]
    if (headerRes.ok) {
      const headerData = await headerRes.json()
      const headers: string[] = (headerData.values?.[0] ?? []) as string[]
      values = headers.length > 0 ? headers.map((h) => rowWithId[h] ?? null) : Object.values(rowWithId)
    } else {
      values = Object.values(rowWithId)
    }
    await sheetsAppend(spreadsheetId, sheetName, [values] as unknown as (string | number | boolean)[][], token)
  } catch (err) {
    if (err instanceof SheetsApiError) {
      throw new AdapterError(`appendRow failed for "${sheetName}": ${err.message}`, err)
    }
    throw err
  }
}

/**
 * Appends multiple rows to the sheet in a single API round-trip.
 *
 * Fetches the header row ONCE, maps every row object to column order, then
 * calls sheetsAppend with all rows at once. Compared to N × appendRow calls
 * this saves (N − 1) GET requests and (N − 1) POST requests.
 */
export async function batchAppendRows(
  spreadsheetId: string,
  sheetName: string,
  rows: Record<string, unknown>[],
  token: string,
): Promise<void> {
  if (rows.length === 0) return
  try {
    const headerUrl = `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!1:1`
    const headerRes = await fetch(headerUrl, { headers: { Authorization: `Bearer ${token}` } })
    let headers: string[] = []
    if (headerRes.ok) {
      const headerData = await headerRes.json()
      headers = (headerData.values?.[0] ?? []) as string[]
    }

    const valueRows = rows.map((row) => {
      const rowWithId = row['id'] ? row : { id: generateId(), ...row }
      if (headers.length > 0) {
        return headers.map((h) => rowWithId[h] ?? null)
      }
      return Object.values(rowWithId)
    })

    await sheetsAppend(spreadsheetId, sheetName, valueRows as (string | number | boolean)[][], token)
  } catch (err) {
    if (err instanceof SheetsApiError) {
      throw new AdapterError(`batchAppendRows failed for "${sheetName}": ${err.message}`, err)
    }
    throw err
  }
}

/**
 * Finds the row number by id, then updates the specific column cell.
 * Fetches the full sheet to locate the row index and resolve the column letter.
 */
export async function updateCell(
  spreadsheetId: string,
  sheetName: string,
  rowId: string,
  column: string,
  value: unknown,
  token: string,
): Promise<void> {
  try {
    const url = `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(sheetName)}`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) throw new SheetsApiError(res.status, `Failed to fetch sheet "${sheetName}"`)
    const data = await res.json()
    const rows: string[][] = data.values ?? []
    if (rows.length < 2) throw new AdapterError(`updateCell: sheet "${sheetName}" has no data rows`)

    const headers = rows[0]
    const colIndex = headers.indexOf(column)
    if (colIndex === -1) throw new AdapterError(`updateCell: column "${column}" not found in "${sheetName}"`)

    const dataRowIndex = rows.slice(1).findIndex((r) => r[0] === rowId)
    if (dataRowIndex === -1) throw new AdapterError(`updateCell: row "${rowId}" not found in "${sheetName}"`)

    const sheetRowNumber = dataRowIndex + 2 // +1 for header, +1 for 1-based
    const range = `${sheetName}!${columnToLetter(colIndex)}${sheetRowNumber}`
    await sheetsUpdate(spreadsheetId, range, [[value as string]], token)
  } catch (err) {
    if (err instanceof AdapterError) throw err
    if (err instanceof SheetsApiError) {
      throw new AdapterError(`updateCell failed: ${err.message}`, err)
    }
    throw err
  }
}

/** Stamps `deleted_at` on the row identified by rowId. */
export async function softDelete(
  spreadsheetId: string,
  sheetName: string,
  rowId: string,
  token: string,
): Promise<void> {
  await updateCell(spreadsheetId, sheetName, rowId, 'deleted_at', new Date().toISOString(), token)
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
 * Updates multiple cells in a sheet with a single API round-trip.
 *
 * Reads the sheet ONCE to resolve row indices and column letters, then
 * calls values.batchUpdate with all ranges in a single HTTP POST.
 * Compared to N × updateCell calls this saves (2N − 1) GET requests.
 *
 * All updates must target the same sheet tab. Rows are identified by their
 * first-column value (same convention as updateCell).
 */
export async function batchUpdateCells(
  spreadsheetId: string,
  sheetName: string,
  updates: Array<{ rowId: string; column: string; value: unknown }>,
  token: string,
): Promise<void> {
  if (updates.length === 0) return
  try {
    const url = `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(sheetName)}`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) throw new SheetsApiError(res.status, `Failed to fetch sheet "${sheetName}"`)
    const data = await res.json()
    const rows: string[][] = data.values ?? []
    if (rows.length < 2) throw new AdapterError(`batchUpdateCells: sheet "${sheetName}" has no data rows`)

    const headers = rows[0]
    const dataRows = rows.slice(1)

    const rangeUpdates: Array<{ range: string; values: (string | number | boolean)[][] }> = []
    for (const { rowId, column, value } of updates) {
      const colIndex = headers.indexOf(column)
      if (colIndex === -1) throw new AdapterError(`batchUpdateCells: column "${column}" not found in "${sheetName}"`)
      const dataRowIndex = dataRows.findIndex((r) => r[0] === rowId)
      if (dataRowIndex === -1) throw new AdapterError(`batchUpdateCells: row "${rowId}" not found in "${sheetName}"`)
      const sheetRowNumber = dataRowIndex + 2 // +1 header, +1 one-based
      rangeUpdates.push({
        range: `${sheetName}!${columnToLetter(colIndex)}${sheetRowNumber}`,
        values: [[value as string]],
      })
    }

    await sheetsBatchUpdate(spreadsheetId, rangeUpdates, token)
  } catch (err) {
    if (err instanceof AdapterError) throw err
    if (err instanceof SheetsApiError) throw new AdapterError(`batchUpdateCells failed: ${err.message}`, err)
    throw err
  }
}

/**
 * Upsert by a named key column in a single API round-trip.
 *
 * Reads the sheet ONCE, then:
 *   - rows where `lookupColumn === entry.lookupValue` → batched into one batchUpdate
 *   - entries with no matching row → appended individually
 *
 * Ideal for key-value store sheets (e.g. Settings) where the caller knows
 * the lookup key but not the row UUID.
 */
export async function batchUpsertByKey(
  spreadsheetId: string,
  sheetName: string,
  lookupColumn: string,
  updateColumn: string,
  entries: Array<{ lookupValue: string; value: unknown }>,
  makeNewRow: (lookupValue: string, value: unknown) => Record<string, unknown>,
  token: string,
): Promise<void> {
  if (entries.length === 0) return
  try {
    const url = `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(sheetName)}`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) throw new SheetsApiError(res.status, `Failed to fetch sheet "${sheetName}"`)
    const data = await res.json()
    const rows: string[][] = data.values ?? []

    const headers = rows.length > 0 ? rows[0] : []
    const dataRows = rows.slice(1)
    const lookupColIndex = headers.indexOf(lookupColumn)
    const updateColIndex = headers.indexOf(updateColumn)

    const rangeUpdates: Array<{ range: string; values: (string | number | boolean)[][] }> = []
    const toAppend: Array<{ lookupValue: string; value: unknown }> = []

    for (const entry of entries) {
      const dataRowIndex = lookupColIndex >= 0
        ? dataRows.findIndex((r) => r[lookupColIndex] === entry.lookupValue)
        : -1

      if (dataRowIndex === -1 || lookupColIndex === -1 || updateColIndex === -1) {
        toAppend.push(entry)
      } else {
        const sheetRowNumber = dataRowIndex + 2
        rangeUpdates.push({
          range: `${sheetName}!${columnToLetter(updateColIndex)}${sheetRowNumber}`,
          values: [[entry.value as string]],
        })
      }
    }

    if (rangeUpdates.length > 0) {
      await sheetsBatchUpdate(spreadsheetId, rangeUpdates, token)
    }
    for (const { lookupValue, value } of toAppend) {
      await sheetsAppend(spreadsheetId, sheetName, [Object.values(makeNewRow(lookupValue, value)) as (string | number | boolean)[]], token)
    }
  } catch (err) {
    if (err instanceof AdapterError) throw err
    if (err instanceof SheetsApiError) throw new AdapterError(`batchUpsertByKey failed: ${err.message}`, err)
    throw err
  }
}
