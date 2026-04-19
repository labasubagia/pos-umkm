/**
 * Low-level HTTP transport for Google Sheets API v4.
 *
 * Used EXCLUSIVELY inside GoogleDataAdapter — no module or service file calls
 * this directly. All Google-specific concerns (auth token, retry logic, URL
 * building) live here so:
 *   (1) retry/backoff logic lives in one place;
 *   (2) MSW mocking surface is minimal (only this file makes fetch calls);
 *   (3) swapping to a different HTTP client only touches this file.
 *
 * Rate-limit handling: Google Sheets API returns HTTP 429 when the per-minute
 * quota is exceeded. We retry with exponential backoff (up to MAX_RETRIES).
 */
import type {
  SheetsGetResponse,
  SheetsAppendResponse,
  SheetsUpdateResponse,
  SheetsBatchGetResponse,
  SheetValues,
} from './sheets.types'
import { SheetsApiError } from './sheets.types'

const BASE_URL = 'https://sheets.googleapis.com/v4/spreadsheets'
const MAX_RETRIES = 3
const BASE_DELAY_MS = 500

function authHeader(token: string): Record<string, string> {
  if (!token) throw new SheetsApiError(401, 'sheetsClient: token must not be empty')
  return { Authorization: `Bearer ${token}` }
}

/**
 * Wraps fetch with exponential-backoff retry on HTTP 429 (rate limit).
 * Throws SheetsApiError on non-retriable HTTP errors.
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  attempt = 0,
): Promise<Response> {
  const res = await fetch(url, options)

  if (res.status === 429 && attempt < MAX_RETRIES) {
    // Exponential backoff: 500ms, 1000ms, 2000ms
    const delay = BASE_DELAY_MS * Math.pow(2, attempt)
    await new Promise((resolve) => setTimeout(resolve, delay))
    return fetchWithRetry(url, options, attempt + 1)
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new SheetsApiError(res.status, `Sheets API error ${res.status}: ${body}`)
  }

  return res
}

/**
 * Fetches a range from a Google Sheet.
 * The header row (row 1) is stripped from the returned values.
 * Returns a 2-D array of data rows (row 2 onwards).
 */
export async function sheetsGet(
  spreadsheetId: string,
  range: string,
  token: string,
): Promise<SheetValues> {
  const url = `${BASE_URL}/${spreadsheetId}/values/${encodeURIComponent(range)}`
  const res = await fetchWithRetry(url, { headers: authHeader(token) })
  const data: SheetsGetResponse = await res.json()
  const values = data.values ?? []
  // Strip header row (row 1); return data rows only
  return values.slice(1)
}

/**
 * Appends rows to a Google Sheet after the last row of data in the given range.
 */
export async function sheetsAppend(
  spreadsheetId: string,
  range: string,
  rows: SheetValues,
  token: string,
): Promise<SheetsAppendResponse> {
  const url = `${BASE_URL}/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`
  const res = await fetchWithRetry(url, {
    method: 'POST',
    headers: { ...authHeader(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: rows }),
  })
  return res.json() as Promise<SheetsAppendResponse>
}

/**
 * Updates a specific range in a Google Sheet (single cell or multi-cell).
 */
export async function sheetsUpdate(
  spreadsheetId: string,
  range: string,
  values: SheetValues,
  token: string,
): Promise<SheetsUpdateResponse> {
  const url = `${BASE_URL}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`
  const res = await fetchWithRetry(url, {
    method: 'PUT',
    headers: { ...authHeader(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ values }),
  })
  return res.json() as Promise<SheetsUpdateResponse>
}

/**
 * Fetches multiple ranges in a single API call (batchGet).
 * More efficient than calling sheetsGet N times — reduces API quota usage.
 */
export async function sheetsBatchGet(
  spreadsheetId: string,
  ranges: string[],
  token: string,
): Promise<SheetsBatchGetResponse> {
  const params = ranges.map((r) => `ranges=${encodeURIComponent(r)}`).join('&')
  const url = `${BASE_URL}/${spreadsheetId}/values:batchGet?${params}`
  const res = await fetchWithRetry(url, { headers: authHeader(token) })
  return res.json() as Promise<SheetsBatchGetResponse>
}
