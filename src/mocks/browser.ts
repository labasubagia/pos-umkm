/**
 * MSW browser service worker setup.
 *
 * Imported lazily by main.tsx when window.__MSW_ENABLED__ === true (set by
 * Playwright's page.addInitScript before navigation in E2E tests).
 *
 * Handler precedence (highest → lowest):
 *   1. Playwright page.route()   — CDP-level, wins over the SW
 *   2. sheetsHandlers            — fixture data for HydrationService reads
 *   3. driveHandlers             — Drive API + spreadsheet ops + catch-all
 *
 * To override a handler in a specific test, use page.route() in that test —
 * Playwright CDP routing is applied before the service worker sees the request.
 */
import { setupWorker } from "msw/browser";
import { driveHandlers } from "./handlers/drive";
import { sheetsHandlers } from "./handlers/sheets";

export const worker = setupWorker(...sheetsHandlers, ...driveHandlers);
