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

// Fallback spreadsheet ID used when no fixtures have been set (e.g. pure UI
// CRUD tests that write through forms without pre-seeding data).
const E2E_MAIN_SPREADSHEET_ID_DEFAULT = "e2e-main-id";
const E2E_FOLDER_ID_DEFAULT = "new-e2e-id";

type FixtureMap = Record<string, Record<string, unknown>[]>;

function getFixtures(): FixtureMap {
  return (
    ((window as unknown as Record<string, unknown>).__E2E_FIXTURES__ as
      | FixtureMap
      | undefined) ?? {}
  );
}

function getActiveFolderId(): string {
  return (
    ((window as unknown as Record<string, unknown>).__E2E_FOLDER_ID__ as
      | string
      | undefined) ?? E2E_FOLDER_ID_DEFAULT
  );
}

/**
 * Returns the active spreadsheet ID from the current E2E fixture map.
 * All fixture keys are `${spreadsheetId}/${tableName}`, so we extract the
 * prefix of the first key. Falls back to E2E_MAIN_SPREADSHEET_ID for tests
 * that don't pre-seed fixture data (e.g. pure UI CRUD tests).
 *
 * This makes the Drive folder listing work for both DEFAULT_STORE tests
 * (where spreadsheetId = "e2e-main-id") and makeStoreConfig tests (where
 * spreadsheetId = "e2e-main-<test-slug>").
 */
function getActiveSpreadsheetId(): string {
  const keys = Object.keys(getFixtures());
  return keys.length > 0
    ? (keys[0].split("/")[0] ?? E2E_MAIN_SPREADSHEET_ID_DEFAULT)
    : E2E_MAIN_SPREADSHEET_ID_DEFAULT;
}

export const driveHandlers = [
  // ── Drive: list files — returns folder structure for store traversal
  http.get(`${DRIVE_BASE}/files`, ({ request }) => {
    const url = new URL(request.url);
    const q = url.searchParams.get("q") || "";

    // Query format: '${folderId}' in parents and trashed = false and ...
    const folderId = getActiveFolderId();
    const isFolder = q.includes(`'${folderId}'`);

    if (isFolder) {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const spreadsheetId = getActiveSpreadsheetId();

      return HttpResponse.json({
        files: [
          {
            // Single master spreadsheet containing all non-transaction tabs.
            id: spreadsheetId,
            name: "main",
            mimeType: "application/vnd.google-apps.spreadsheet",
          },
          {
            // Named `transaction_YYYY-MM` so StoreFolderService.flattenToMap()
            // recognises it as a monthly sheet and populates
            // storeMap.monthlySheets — required for commitTransaction() to find
            // the Transactions spreadsheet ID at checkout time.
            id: spreadsheetId,
            name: `transaction_${year}-${month}`,
            mimeType: "application/vnd.google-apps.spreadsheet",
          },
        ],
      });
    }

    // Default empty for other queries
    return HttpResponse.json({ files: [] });
  }),

  // ── Drive: get file metadata — returns folder info for e2e operations
  http.get(`${DRIVE_BASE}/files/:fileId`, ({ params }) => {
    const { fileId } = params;
    const folderId = getActiveFolderId();
    if (fileId === folderId) {
      return HttpResponse.json({
        id: folderId,
        name: "My Store",
        parents: ["root"],
        mimeType: "application/vnd.google-apps.folder",
      });
    }
    return HttpResponse.json({
      id: fileId,
      name: "Spreadsheet",
      parents: [folderId],
    });
  }),

  // ── Drive: create file/folder — returns new ID
  http.post(`${DRIVE_BASE}/files`, () =>
    HttpResponse.json({ id: getActiveFolderId() }),
  ),

  // ── Drive: update/move file — returns success
  http.patch(`${DRIVE_BASE}/files/:fileId`, () =>
    HttpResponse.json({ id: getActiveFolderId() }),
  ),

  // ── Sheets: create spreadsheet — returns the active fixture spreadsheet ID so
  // HydrationService queries the same ID that fixtures are keyed under.
  http.post(new RegExp(`${SHEETS_BASE.replace(/\./g, "\\.")}$`), () =>
    HttpResponse.json({
      spreadsheetId: getActiveSpreadsheetId(),
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
