/**
 * MSW handlers for the Google Sheets API v4.
 *
 * GET  /v4/spreadsheets/:id/values/:range   — returns fixture rows (for HydrationService)
 * GET  /v4/spreadsheets/:id/values:batchGet — returns empty (header-lookup in batchUpdateCells)
 * POST /v4/spreadsheets/:id/values/*:append — success (SyncManager outbox drain)
 * POST /v4/spreadsheets/:id/values:batchUpdate — success (SyncManager outbox drain)
 * PUT  /v4/spreadsheets/:id/values/*        — success (writeHeaders)
 *
 * Fixture data is read from window.__E2E_FIXTURES__ which is injected by
 * setMswFixtures() in msw-state.ts before page navigation.
 * Key format: `${spreadsheetId}/${sheetName}` → row objects array.
 */
import { HttpResponse, http } from "msw";
import { ALL_TAB_HEADERS } from "../../api/adapters/zod-schemas";

type FixtureMap = Record<string, Record<string, unknown>[]>;

function getFixtures(): FixtureMap {
  return (
    ((window as unknown as Record<string, unknown>).__E2E_FIXTURES__ as
      | FixtureMap
      | undefined) ?? {}
  );
}

/**
 * Serialises row objects into the Sheets API values format:
 * [[header1, header2, ...], [val1, val2, ...], ...]
 */
function rowsToValues(
  sheetName: string,
  rows: Record<string, unknown>[],
): (string | number | boolean | null)[][] {
  const headers = ALL_TAB_HEADERS[sheetName];
  if (!headers || headers.length === 0) return [];
  const dataRows = rows.map((r) =>
    headers.map((h) => {
      const v = r[h];
      return v === undefined ? null : (v as string | number | boolean | null);
    }),
  );
  return [headers as (string | number | boolean | null)[], ...dataRows];
}

const SHEETS_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

export const sheetsHandlers = [
  // ── Read: GET sheet values ────────────────────────────────────────────────
  // Matches GET /spreadsheets/:id/values/:sheetName  (no colon in path segment)
  http.get(
    new RegExp(`${SHEETS_BASE.replace(/\./g, "\\.")}/[^/]+/values/[^?/:]+`),
    ({ request }) => {
      const url = new URL(request.url);
      const parts = url.pathname.split("/");
      const valuesIdx = parts.lastIndexOf("values");
      const spreadsheetId = parts[valuesIdx - 1] ?? "";
      const range = decodeURIComponent(parts[valuesIdx + 1] ?? "");
      const sheetName = range.split("!")[0];

      const fixtures = getFixtures();
      const rows = fixtures[`${spreadsheetId}/${sheetName}`] ?? [];
      const values = rowsToValues(sheetName, rows);

      return HttpResponse.json({
        range: sheetName,
        majorDimension: "ROWS",
        // Always include headers even when no data rows
        values:
          values.length > 0
            ? values
            : ALL_TAB_HEADERS[sheetName]
              ? [ALL_TAB_HEADERS[sheetName]]
              : [],
      });
    },
  ),

  // ── Read: batchGet (header-lookup in batchUpdateCells) ───────────────────
  http.get(
    new RegExp(`${SHEETS_BASE.replace(/\./g, "\\.")}/[^/]+/values:batchGet`),
    () => HttpResponse.json({ valueRanges: [] }),
  ),

  // ── Write: append rows ────────────────────────────────────────────────────
  http.post(
    new RegExp(
      `${SHEETS_BASE.replace(/\./g, "\\.")}/[^/]+/values/[^?]+:append`,
    ),
    () =>
      HttpResponse.json({
        updates: {
          updatedRows: 1,
          updatedRange: "",
          updatedColumns: 1,
          updatedCells: 1,
        },
      }),
  ),

  // ── Write: batchUpdate cell values ───────────────────────────────────────
  http.post(
    new RegExp(`${SHEETS_BASE.replace(/\./g, "\\.")}/[^/]+/values:batchUpdate`),
    () => HttpResponse.json({ totalUpdatedRows: 1, responses: [] }),
  ),

  // ── Read: spreadsheet metadata ─────────────────────────────────────────────
  // Returns sheet info so StoreFolderService can map sheet names to spreadsheet IDs
  http.get(new RegExp(`${SHEETS_BASE.replace(/\./g, "\\.")}/[^/]+$`), () => {
    // Return a mock sheet list for any spreadsheet ID.
    // Includes transaction tabs so StoreFolderService.flattenToMap() correctly
    // populates storeMap.monthlySheets when it processes the transaction_YYYY-MM
    // spreadsheet returned by the Drive folder listing mock.
    const mockSheets = [
      { properties: { sheetId: 1, title: "Stores" } },
      { properties: { sheetId: 2, title: "Settings" } },
      { properties: { sheetId: 3, title: "Members" } },
      { properties: { sheetId: 4, title: "Categories" } },
      { properties: { sheetId: 5, title: "Products" } },
      { properties: { sheetId: 6, title: "Variants" } },
      { properties: { sheetId: 7, title: "Customers" } },
      { properties: { sheetId: 8, title: "Purchase_Orders" } },
      { properties: { sheetId: 9, title: "Purchase_Order_Items" } },
      { properties: { sheetId: 10, title: "Stock_Log" } },
      { properties: { sheetId: 11, title: "Audit_Log" } },
      { properties: { sheetId: 12, title: "Monthly_Sheets" } },
      { properties: { sheetId: 13, title: "Transactions" } },
      { properties: { sheetId: 14, title: "Transaction_Items" } },
      { properties: { sheetId: 15, title: "Refunds" } },
    ];

    return HttpResponse.json({ sheets: mockSheets });
  }),

  // ── Write: PUT (writeHeaders) ─────────────────────────────────────────────
  http.put(
    new RegExp(`${SHEETS_BASE.replace(/\./g, "\\.")}/[^/]+/values/[^?/]+`),
    () => HttpResponse.json({ updatedRows: 1 }),
  ),
];
