/**
 * MSW handlers for the Google Drive v3 API and spreadsheet-level operations.
 *
 * These return safe default responses so E2E tests run without real credentials.
 * For tests that need precise control (e.g. store-management.spec.ts), the spec
 * can override specific routes via Playwright's page.route() which takes precedence
 * over the MSW service worker.
 */
import { HttpResponse, http } from "msw";

const DRIVE_BASE = "https://www.googleapis.com/drive/v3";
const SHEETS_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

export const driveHandlers = [
  // ── Drive: list files ─────────────────────────────────────────────────────
  http.get(`${DRIVE_BASE}/files`, () => HttpResponse.json({ files: [] })),

  // ── Drive: get file metadata ──────────────────────────────────────────────
  http.get(`${DRIVE_BASE}/files/:fileId`, () =>
    HttpResponse.json({ id: "e2e-folder-id", parents: ["root"] }),
  ),

  // ── Drive: create file/folder ─────────────────────────────────────────────
  http.post(`${DRIVE_BASE}/files`, () =>
    HttpResponse.json({ id: "new-folder-id" }),
  ),

  // ── Drive: update/move file ───────────────────────────────────────────────
  http.patch(`${DRIVE_BASE}/files/:fileId`, () =>
    HttpResponse.json({ id: "new-folder-id" }),
  ),

  // ── Sheets: create spreadsheet ────────────────────────────────────────────
  http.post(new RegExp(`${SHEETS_BASE.replace(/\./g, "\\.")}$`), () =>
    HttpResponse.json({
      spreadsheetId: "new-sheet-id",
      properties: { title: "E2E Sheet" },
    }),
  ),

  // ── Sheets: spreadsheet-level batchUpdate (add tabs, rename, etc.) ────────
  http.post(
    new RegExp(`${SHEETS_BASE.replace(/\./g, "\\.")}/[^/]+:batchUpdate`),
    () => HttpResponse.json({ replies: [] }),
  ),

  // ── OAuth token endpoint ──────────────────────────────────────────────────
  http.post("https://oauth2.googleapis.com/token", () =>
    HttpResponse.json({ access_token: "fake-e2e-token", expires_in: 3600 }),
  ),

  // ── Catch-all: any remaining googleapis.com or accounts.google.com request
  http.all(/(googleapis\.com|accounts\.google\.com)/, () =>
    HttpResponse.json({}),
  ),
];
