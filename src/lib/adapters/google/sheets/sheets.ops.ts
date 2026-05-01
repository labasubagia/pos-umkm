/**
 * Higher-level Google Sheets operations used exclusively by GoogleDataAdapter.
 *
 * Handles row-to-object mapping, header resolution, column lookup, and
 * HTTP transport. Each function takes explicit (spreadsheetId, token) arguments
 * to remain stateless and independently testable. Error translation from
 * SheetsApiError → AdapterError happens here so GoogleDataAdapter stays thin.
 */

import { queryClient } from "../../../queryClient";
import { generateId } from "../../../uuid";
import { AdapterError } from "../../types";
import { SheetsApiError } from "./sheets.types";

const SHEETS_BASE = "https://sheets.googleapis.com/v4/spreadsheets";
const STALE_TIME = 10 * 60 * 1000; // 10 minutes

function authHeader(token: string): Record<string, string> {
  if (!token)
    throw new SheetsApiError(401, "sheetsOps: token must not be empty");
  return { Authorization: `Bearer ${token}` };
}

/**
 * Fetches all rows from the sheet, maps header columns to object keys,
 * and filters out soft-deleted rows. Results are cached via TanStack Query.
 */
export async function getAll(
  spreadsheetId: string,
  sheetName: string,
  token: string,
): Promise<Record<string, unknown>[]> {
  return queryClient.fetchQuery({
    queryKey: ["sheetData", spreadsheetId, sheetName],
    queryFn: async () => {
      try {
        const url = `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(sheetName)}`;
        const res = await fetch(url, { headers: authHeader(token) });
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          throw new SheetsApiError(
            res.status,
            `Sheets API error ${res.status}: ${body}`,
          );
        }
        const data = (await res.json()) as {
          values?: (string | number | boolean)[][];
        };
        const rows = data.values ?? [];
        if (rows.length < 1) return [];
        const headers = rows[0] as string[];
        return rows
          .slice(1)
          .map((row) => {
            const obj: Record<string, unknown> = {};
            headers.forEach((h, i) => {
              obj[h] = row[i] ?? null;
            });
            return obj;
          })
          .filter((r) => !r.deleted_at);
      } catch (err) {
        if (err instanceof SheetsApiError) {
          throw new AdapterError(
            `getSheet failed for "${sheetName}": ${err.message}`,
            err,
          );
        }
        throw err;
      }
    },
    staleTime: STALE_TIME,
  });
}

/**
 * Writes the header row (row 1) to the named sheet tab using values.update.
 * Must be called once after a new tab is created so that batchAppendRows can map
 * object keys to the correct column positions.
 */
export async function writeHeaders(
  spreadsheetId: string,
  sheetName: string,
  headers: string[],
  token: string,
): Promise<void> {
  const range = `${sheetName}!1:1`;
  const encodedRange = `${encodeURIComponent(sheetName)}!1:1`;
  try {
    const res = await fetch(
      `${SHEETS_BASE}/${spreadsheetId}/values/${encodedRange}?valueInputOption=RAW`,
      {
        method: "PUT",
        headers: { ...authHeader(token), "Content-Type": "application/json" },
        body: JSON.stringify({
          range,
          majorDimension: "ROWS",
          values: [headers],
        }),
      },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new SheetsApiError(
        res.status,
        `Sheets API error ${res.status}: ${body}`,
      );
    }
  } catch (err) {
    if (err instanceof SheetsApiError) {
      throw new AdapterError(
        `writeHeaders failed for "${sheetName}": ${err.message}`,
        err,
      );
    }
    throw err;
  }
  void queryClient.invalidateQueries({
    queryKey: ["sheetData", spreadsheetId, sheetName],
  });
}

/**
 * Appends multiple rows to the sheet in a single API round-trip.
 *
 * Fetches the header row ONCE, maps every row object to column order, then
 * calls sheetsAppend with all rows at once. Compared to N × appendRow calls
 * this saves (N − 1) GET requests and (N − 1) POST requests.
 * Pass `knownHeaders` to skip even the single header-fetch GET.
 */
export async function batchInsert(
  spreadsheetId: string,
  sheetName: string,
  rows: Record<string, unknown>[],
  token: string,
  knownHeaders?: string[],
): Promise<void> {
  if (rows.length === 0) return;
  try {
    let headers: string[] = knownHeaders ?? [];
    if (headers.length === 0) {
      const headerUrl = `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!1:1`;
      const headerRes = await fetch(headerUrl, { headers: authHeader(token) });
      if (headerRes.ok) {
        const headerData = (await headerRes.json()) as { values?: string[][] };
        headers = (headerData.values?.[0] ?? []) as string[];
      }
    }

    const valueRows = rows.map((row) => {
      const rowWithId = row.id ? row : { id: generateId(), ...row };
      if (headers.length > 0) {
        return headers.map((h) => rowWithId[h] ?? null);
      }
      return Object.values(rowWithId);
    });

    const url = `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(sheetName)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
    const res = await fetch(url, {
      method: "POST",
      headers: { ...authHeader(token), "Content-Type": "application/json" },
      body: JSON.stringify({ values: valueRows }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new SheetsApiError(
        res.status,
        `Sheets API error ${res.status}: ${body}`,
      );
    }
    void queryClient.invalidateQueries({
      queryKey: ["sheetData", spreadsheetId, sheetName],
    });
  } catch (err) {
    if (err instanceof SheetsApiError) {
      throw new AdapterError(
        `batchInsert failed for "${sheetName}": ${err.message}`,
        err,
      );
    }
    throw err;
  }
}

/** Stamps `deleted_at` on the row identified by rowId. */
export async function softDelete(
  spreadsheetId: string,
  sheetName: string,
  rowId: string,
  token: string,
): Promise<void> {
  await batchUpdate(
    spreadsheetId,
    sheetName,
    [{ rowId, column: "deleted_at", value: new Date().toISOString() }],
    token,
  );
}

/** Converts a 0-based column index to a spreadsheet column letter (0 → A, 1 → B, …). */
function columnToLetter(index: number): string {
  let result = "";
  let n = index;
  while (n >= 0) {
    result = String.fromCharCode((n % 26) + 65) + result;
    n = Math.floor(n / 26) - 1;
  }
  return result;
}

/**
 * Updates multiple cells in a sheet with a single API round-trip.
 *
 * Fetches only the header row (Sheet!1:1) and ID column (Sheet!A:A) via
 * values.batchGet — not the full sheet — to resolve row indices and column
 * letters. Then calls values.batchUpdate with all ranges in a single HTTP POST.
 * Compared to N × updateCell calls this saves (2N − 1) GET requests, and
 * compared to a full-sheet fetch this avoids transferring unused cell data.
 *
 * All updates must target the same sheet tab. Rows are identified by their
 * first-column value (same convention as updateCell).
 */
export async function batchUpdate(
  spreadsheetId: string,
  sheetName: string,
  updates: Array<{ rowId: string; column: string; value: unknown }>,
  token: string,
): Promise<void> {
  if (updates.length === 0) return;
  try {
    const params = [`${sheetName}!1:1`, `${sheetName}!A:A`]
      .map((r) => `ranges=${encodeURIComponent(r)}`)
      .join("&");
    const batchUrl = `${SHEETS_BASE}/${spreadsheetId}/values:batchGet?${params}`;
    const batchRes = await fetch(batchUrl, { headers: authHeader(token) });
    if (!batchRes.ok) {
      const body = await batchRes.text().catch(() => "");
      throw new SheetsApiError(
        batchRes.status,
        `Sheets API error ${batchRes.status}: ${body}`,
      );
    }
    const batchData = (await batchRes.json()) as {
      valueRanges: { values?: string[][] }[];
    };
    const headers = (batchData.valueRanges[0].values?.[0] ?? []) as string[];
    const idColumn = (batchData.valueRanges[1].values ?? []) as string[][];
    const idRows = idColumn.slice(1);

    if (idRows.length === 0)
      throw new AdapterError(
        `batchUpdate: sheet "${sheetName}" has no data rows`,
      );

    const colIndexByName = new Map(headers.map((h, i) => [h, i]));
    const sheetRowByRowId = new Map(idRows.map((r, i) => [r[0], i + 2]));

    const rangeUpdates: Array<{
      range: string;
      values: (string | number | boolean)[][];
    }> = [];
    for (const { rowId, column, value } of updates) {
      const colIndex = colIndexByName.get(column);
      if (colIndex === undefined)
        throw new AdapterError(
          `batchUpdate: column "${column}" not found in "${sheetName}"`,
        );
      const sheetRowNumber = sheetRowByRowId.get(rowId);
      if (sheetRowNumber === undefined)
        throw new AdapterError(
          `batchUpdate: row "${rowId}" not found in "${sheetName}"`,
        );
      rangeUpdates.push({
        range: `${sheetName}!${columnToLetter(colIndex)}${sheetRowNumber}`,
        values: [[value as string]],
      });
    }

    const updateUrl = `${SHEETS_BASE}/${spreadsheetId}/values:batchUpdate`;
    const updateRes = await fetch(updateUrl, {
      method: "POST",
      headers: { ...authHeader(token), "Content-Type": "application/json" },
      body: JSON.stringify({
        valueInputOption: "RAW",
        data: rangeUpdates,
      }),
    });
    if (!updateRes.ok) {
      const body = await updateRes.text().catch(() => "");
      throw new SheetsApiError(
        updateRes.status,
        `Sheets API error ${updateRes.status}: ${body}`,
      );
    }
    void queryClient.invalidateQueries({
      queryKey: ["sheetData", spreadsheetId, sheetName],
    });
  } catch (err) {
    if (err instanceof AdapterError) throw err;
    if (err instanceof SheetsApiError)
      throw new AdapterError(`batchUpdate failed: ${err.message}`, err);
    throw err;
  }
}
