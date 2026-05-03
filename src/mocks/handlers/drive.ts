/**
 * MSW handlers for the Google Drive v3 API and spreadsheet-level operations.
 *
 * These return safe default responses so E2E tests run without real credentials.
 * The folder listing returns a fake structure so StoreFolderService.traverse()
 * can build a store map and find spreadsheets.
 * For tests that need precise control (e.g. store-management.spec.ts), the spec
 * can override specific routes via Playwright's page.route() which takes precedence
 * over the MSW service worker.
 */
import { HttpResponse, http } from "msw";

const DRIVE_BASE = "https://www.googleapis.com/drive/v3";
const SHEETS_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

// All sheets in E2E tests are under the same main spreadsheet for fixture lookup.
// This matches how MSW fixtures are keyed (e.g. "e2e-main-id/Products").
const E2E_MAIN_SPREADSHEET_ID = "e2e-main-id";

const e2eFolderSpreadsheets = [
  {
    id: E2E_MAIN_SPREADSHEET_ID,
    name: "main",
    mimeType: "application/vnd.google-apps.spreadsheet",
  },
  {
    id: E2E_MAIN_SPREADSHEET_ID,
    name: "Settings",
    mimeType: "application/vnd.google-apps.spreadsheet",
  },
  {
    id: E2E_MAIN_SPREADSHEET_ID,
    name: "Members",
    mimeType: "application/vnd.google-apps.spreadsheet",
  },
  {
    id: E2E_MAIN_SPREADSHEET_ID,
    name: "Categories",
    mimeType: "application/vnd.google-apps.spreadsheet",
  },
  {
    id: E2E_MAIN_SPREADSHEET_ID,
    name: "Products",
    mimeType: "application/vnd.google-apps.spreadsheet",
  },
  {
    id: E2E_MAIN_SPREADSHEET_ID,
    name: "Variants",
    mimeType: "application/vnd.google-apps.spreadsheet",
  },
  {
    id: E2E_MAIN_SPREADSHEET_ID,
    name: "Customers",
    mimeType: "application/vnd.google-apps.spreadsheet",
  },
];

function buildTransactionSheets(
  year: number,
  month: number,
): Record<string, unknown>[] {
  return [
    {
      id: `e2e-tx-${year}-${month}`,
      name: "Transactions",
      mimeType: "application/vnd.google-apps.spreadsheet",
    },
    {
      id: `e2e-txi-${year}-${month}`,
      name: "Transaction_Items",
      mimeType: "application/vnd.google-apps.spreadsheet",
    },
    {
      id: `e2e-ref-${year}-${month}`,
      name: "Refunds",
      mimeType: "application/vnd.google-apps.spreadsheet",
    },
  ];
}

export const driveHandlers = [
  // ── Drive: list files — returns folder structure for store traversal
  http.get(`${DRIVE_BASE}/files`, ({ request }) => {
    const url = new URL(request.url);
    const q = url.searchParams.get("q") || "";

    // If querying for a specific folder (e.g. "e2e-folder-id" in parents), return its contents
    if (q.includes("e2e-folder-id") || q.includes("'e2e-folder-id'")) {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");

      // Return transactions folder containing monthly sheets
      if (q.includes("transactions") || q.includes(`'${year}'`)) {
        return HttpResponse.json({
          files: buildTransactionSheets(year, parseInt(month, 10)),
        });
      }

      return HttpResponse.json({ files: e2eFolderSpreadsheets });
    }

    // Default empty for other queries
    return HttpResponse.json({ files: [] });
  }),

  // ── Drive: get file metadata — returns folder info for e2e operations
  http.get(`${DRIVE_BASE}/files/:fileId`, ({ params }) => {
    const { fileId } = params;
    if (fileId === "e2e-folder-id") {
      return HttpResponse.json({
        id: "e2e-folder-id",
        name: "My Store",
        parents: ["root"],
        mimeType: "application/vnd.google-apps.folder",
      });
    }
    return HttpResponse.json({
      id: fileId,
      name: "Spreadsheet",
      parents: ["e2e-folder-id"],
    });
  }),

  // ── Drive: create file/folder — returns new ID
  http.post(`${DRIVE_BASE}/files`, () =>
    HttpResponse.json({ id: "new-e2e-id" }),
  ),

  // ── Drive: update/move file — returns success
  http.patch(`${DRIVE_BASE}/files/:fileId`, () =>
    HttpResponse.json({ id: "new-e2e-id" }),
  ),

  // ── Sheets: create spreadsheet — returns fake ID
  http.post(new RegExp(`${SHEETS_BASE.replace(/\./g, "\\.")}$`), () =>
    HttpResponse.json({
      spreadsheetId: "new-sheet-id",
      properties: { title: "E2E Sheet" },
    }),
  ),

  // ── Sheets: spreadsheet-level batchUpdate
  http.post(
    new RegExp(`${SHEETS_BASE.replace(/\./g, "\\.")}/[^/]+:batchUpdate`),
    () => HttpResponse.json({ replies: [] }),
  ),

  // ── OAuth token endpoint
  http.post("https://oauth2.googleapis.com/token", () =>
    HttpResponse.json({ access_token: "fake-e2e-token", expires_in: 3600 }),
  ),

  // ── Catch-all: any remaining googleapis.com requests
  http.all(/(googleapis\.com|accounts\.google\.com)/, () =>
    HttpResponse.json({}),
  ),
];
