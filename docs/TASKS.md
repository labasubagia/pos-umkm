# POS UMKM — AI Agent Task Document

> This document is the single source of truth for implementation tasks.
> It is designed to be executed by one or more AI coding agents working in parallel.

## How to Use This Document

- **Status values:** `todo` | `in-progress` | `done` | `blocked` | `need-check`
- **Parallelism:** Tasks within the same section that share no `depends_on` overlap can be worked on simultaneously by different agents.
- **TDD rule:** Write the failing test(s) first, then implement, then refactor. Mark status `in-progress` before starting, `done` after all tests pass.
- **Architecture rule:** After completing each task, verify no module imports another module's internals. All data reads/writes go through `lib/adapters/` (the `DataAdapter` interface) — never call `lib/adapters/google/sheets/` or Google APIs directly from modules. `lib/adapters/google/sheets/` is used only inside `GoogleDataAdapter`.
- **Comments rule:** Every non-trivial function must have a JSDoc comment explaining *why* the approach was chosen, not just what it does.
- **E2E locator rule:** Every interactive element and key output element that an E2E test touches **must** have a `data-testid` attribute. E2E tests must use `page.getByTestId()` as the primary selector. `getByRole`, `getByText`, `getByPlaceholder`, and `.first()` / `.last()` are not permitted as primary locators in assertions or interactions — only for page-level navigation waits. See TRD §7.4 for the full rule and naming convention.

## Status Legend

| Symbol | Meaning |
|---|---|
| ⬜ | todo |
| 🔄 | in-progress |
| ✅ | done |
| 🚫 | blocked |
| 🔍 | need-check — task was implemented but its architecture note or test cases were updated; verify the implementation still matches before closing |

---

## Scaffold

> No test cases required for scaffold tasks. Goal: a running, correctly configured dev environment.

---

### T001 — Initialize Vite + React + TypeScript Project

- **Status:** ✅ done
- **Section:** Scaffold
- **Depends on:** (none)
- **Test type:** none
- **Architecture note:** Vite chosen over CRA because it is significantly faster (native ESM, no bundling in dev) and has first-class TypeScript support without ejection. The static output (`dist/`) is what gets deployed to GitHub Pages.
- **Deliverables:**
  - `package.json` with correct scripts: `dev`, `build`, `preview`, `test`, `test:e2e`
  - `tsconfig.json` with strict mode enabled
  - `vite.config.ts` configured for Vite + React + Tailwind
  - `.gitignore` covering `node_modules`, `dist`, `.env*`
  - `README.md` with setup instructions

---

### T002 — Configure Tailwind CSS + shadcn/ui

- **Status:** ✅ done
- **Section:** Scaffold
- **Depends on:** T001
- **Test type:** none
- **Architecture note:** Tailwind is used for utility-first styling (eliminates CSS naming conflicts in a component-heavy app). shadcn/ui provides accessible, unstyled-by-default components that are copy-pasted into the repo (not a runtime dependency), keeping bundle size controllable.
- **Deliverables:**
  - `tailwind.config.ts` with content paths covering `src/**/*.{ts,tsx}`
  - shadcn/ui initialized (`components.json`)
  - At least one shadcn component installed: `Button`
  - A visual smoke test: app renders a styled Button on the home route

---

### T003 — Set Up React Router v6

- **Status:** ✅ done
- **Section:** Scaffold
- **Depends on:** T001
- **Test type:** none
- **Architecture note:** React Router v6 with `createBrowserRouter` is preferred over the older `<BrowserRouter>` API because it enables data loaders and route-level error boundaries, which will be useful for async Sheets API fetches. Hash routing is avoided since GitHub Pages supports path rewrites via `404.html` redirect trick.
- **Deliverables:**
  - Route definitions in `src/router.tsx`
  - Placeholder pages: `/` (landing), `/setup`, `/cashier`, `/catalog`, `/reports`, `/settings`
  - A 404 catch-all route
  - `public/404.html` for GitHub Pages SPA redirect

---

### T004 — Set Up Zustand for State Management

- **Status:** ✅ done
- **Section:** Scaffold
- **Depends on:** T001
- **Test type:** none
- **Architecture note:** Zustand chosen over Redux Toolkit because it has no boilerplate, no Provider wrapping needed, and stores are independently importable — which aligns with the modular architecture (each module owns its Zustand slice). Redux was considered but rejected for MVP due to verbosity.
- **Deliverables:**
  - `src/store/` directory with a placeholder `authStore.ts` demonstrating the pattern
  - Example: `useAuthStore` with `user`, `role`, `spreadsheetId` fields

---

### T005 — Set Up Vitest + Testing Library

- **Status:** ✅ done
- **Section:** Scaffold
- **Depends on:** T001
- **Test type:** none
- **Architecture note:** Vitest is chosen over Jest because it shares Vite's config (no separate babel transform), runs faster in watch mode, and supports ESM natively. `@testing-library/react` is used over Enzyme because it tests behavior from the user's perspective (no implementation detail coupling).
- **Deliverables:**
  - `vitest.config.ts` with jsdom environment
  - `src/test-setup.ts` with Testing Library matchers
  - MSW (`msw`) installed for API mocking
  - A passing smoke test: `expect(1 + 1).toBe(2)`
  - `npm run test` executes all `*.test.ts(x)` files

---

### T006 — Set Up Playwright for E2E Tests

- **Status:** ✅ done
- **Section:** Scaffold
- **Depends on:** T001
- **Test type:** none
- **Architecture note:** Playwright chosen over Cypress because it supports multiple browsers (Chromium, Firefox, WebKit) from a single runner, has a more reliable auto-waiting model, and its API is more composable for page object patterns. E2E tests run against the local Vite dev server in CI.
- **Deliverables:**
  - `playwright.config.ts` with: Chromium + Firefox, baseURL `http://localhost:5173`, retries: 2 in CI
  - `src/tests/e2e/helpers/auth.ts` — shared sign-in helper function (to be implemented in T022)
  - A passing smoke test: page loads and title contains "POS UMKM"
  - `npm run test:e2e` command

---

### T007 — Set Up i18n (react-i18next)

- **Status:** ✅ done
- **Section:** Scaffold
- **Depends on:** T001
- **Test type:** none
- **Architecture note:** `react-i18next` chosen because it integrates with React's rendering model (hook-based, suspense-compatible). Translation keys are namespaced by module (e.g., `cashier:paymentModal.title`) to allow lazy loading per route. `id-ID` (Bahasa Indonesia) is the default; `en-US` is the fallback.
- **Deliverables:**
  - `src/lib/i18n.ts` with i18next initialization
  - `public/locales/id/common.json` and `public/locales/en/common.json`
  - A rendered component that uses `useTranslation()` and switches language
  - Number formatting utility using `Intl.NumberFormat('id-ID')` for IDR (see T012)

---

### T008 — Set Up GitHub Actions CI Pipeline

- **Status:** ✅ done
- **Section:** Scaffold
- **Depends on:** T005, T006
- **Test type:** none
- **Architecture note:** Two separate jobs: `unit` (fast, no browser) and `e2e` (slow, browser). Separating them allows unit tests to give fast feedback on PRs while e2e can run in parallel. Secrets for test Google account are stored as GitHub Actions secrets, never in code.
- **Deliverables:**
  - `.github/workflows/ci.yml` with jobs: `unit` (Vitest) and `e2e` (Playwright)
  - `.github/workflows/deploy.yml` triggered on merge to `main` → `vite build` → GitHub Pages
  - Secrets documented in `README.md`: `GOOGLE_TEST_EMAIL`, `GOOGLE_TEST_SPREADSHEET_ID`

---

### T009 — Create Module Folder Structure

- **Status:** ✅ done
- **Section:** Scaffold
- **Depends on:** T001
- **Test type:** none
- **Architecture note:** The folder structure enforces the modular boundary at the filesystem level. Each module folder is self-contained. A lint rule (`import/no-internal-modules`) should be configured (via Biome or equivalent) to prevent cross-module internal imports at lint time, catching violations before code review.
- **Deliverables:**
  - Create all module folders with `index.ts` barrel files:
    `src/modules/{auth,catalog,cashier,inventory,customers,reports,settings}/`
  - `src/lib/{formatters.ts,validators.ts,uuid.ts}`
  - `src/tests/e2e/` with spec file stubs
  - Linting configured (Biome) with an import rule to prevent cross-module internal imports
  - Biome / lint rule: warn on cross-module internal imports

---

## Core Library

> Pure utility functions and the Sheets API client. No UI. All must have unit tests.

---

### T010 — Google Sheets API Client (`lib/adapters/google/sheets/`)

- **Status:** ✅ done
- **Section:** Core Library
- **Depends on:** T009
- **Test type:** unit (MSW mocks)
- **Architecture note:** Low-level HTTP transport for Google Sheets API v4. Used exclusively inside `GoogleDataAdapter` (T047). No module or service file calls this directly. Isolated here so: (1) retry/backoff logic lives in one place; (2) MSW mocking surface is minimal; (3) swapping to a different HTTP client later only touches this file.
- **Deliverables:**
  - `src/lib/adapters/google/sheets/sheets.client.ts`:
    - `sheetsGet(spreadsheetId, range, token)` → parsed row arrays
    - `sheetsAppend(spreadsheetId, range, rows, token)` → appended range response
    - `sheetsUpdate(spreadsheetId, range, values, token)` → updated range response
    - `sheetsBatchGet(spreadsheetId, ranges, token)` → multiple ranges in one API call
    - Automatic retry with exponential backoff on HTTP 429 (rate limit)
  - `src/lib/adapters/google/sheets/sheets.types.ts`: TypeScript types for all API shapes
- **Test cases (`sheets.client.test.ts`):**
  - ✅ `sheetsGet returns parsed 2D array of row values`
  - ✅ `sheetsGet strips header row (row 1) from result`
  - ✅ `sheetsAppend sends correct range and values`
  - ✅ `sheetsUpdate sends correct range and single-cell value`
  - ✅ `sheetsBatchGet fetches multiple ranges in one call`
  - ✅ `retries once on HTTP 429 after backoff`
  - ❌ `throws SheetsApiError on HTTP 403 (forbidden)`
  - ❌ `throws SheetsApiError on HTTP 404 (spreadsheet not found)`
  - ❌ `throws SheetsApiError after max retries exceeded`
  - ❌ `throws if token is empty or undefined`

---

### T045 — DataAdapter & AuthAdapter Interfaces (`lib/adapters/types.ts`)

- **Status:** ✅ done
- **Section:** Core Library
- **Depends on:** T009
- **Test type:** none (interface definitions only)
- **Architecture note:** Defining the interface before any implementation enforces the contract that both Mock and Google adapters must satisfy. All module service files import from `lib/adapters/` only — never from `lib/adapters/google/sheets/` directly. This is the single point where the data contract is specified. TypeScript's structural typing will catch any adapter that diverges from the interface at compile time.
- **Deliverables:**
  - `src/lib/adapters/types.ts`:
    ```ts
    interface DataAdapter {
      getSheet(sheetName: string): Promise<Record<string, unknown>[]>
      appendRow(sheetName: string, row: Record<string, unknown>): Promise<void>
      updateCell(sheetName: string, rowId: string, column: string, value: unknown): Promise<void>
      softDelete(sheetName: string, rowId: string): Promise<void>
      createSpreadsheet(name: string): Promise<string>        // returns spreadsheetId
      getSpreadsheetId(key: string): string | null            // reads from localStorage
      shareSpreadsheet(spreadsheetId: string, email: string, role: 'editor' | 'viewer'): Promise<void>
    }

    interface AuthAdapter {
      signIn(): Promise<User>
      signOut(): Promise<void>
      getCurrentUser(): User | null
      getAccessToken(): string | null
    }
    ```
  - `src/lib/adapters/index.ts`:
    ```ts
    // Active adapter selected at build time via VITE_ADAPTER env var.
    // Vite tree-shakes the unused adapter out of the production bundle.
    export const dataAdapter: DataAdapter = ...
    export const authAdapter: AuthAdapter = ...
    ```

---

### T046 — MockDataAdapter & MockAuthAdapter

- **Status:** ✅ done
- **Section:** Core Library
- **Depends on:** T045, T011
- **Test type:** unit
- **Architecture note:** The mock adapter stores data in `localStorage` using the same entity/tab naming convention as Google Sheets (e.g., `mock_Products`, `mock_Transactions_2026-04`). This means mock data structure is identical to production — switching adapters never requires data migration logic in the feature modules. `MockAuthAdapter` returns a hardcoded preset user so no OAuth flow is needed during development or CI.
- **Deliverables:**
  - `src/lib/adapters/mock/MockDataAdapter.ts` — implements `DataAdapter` using `localStorage`
    - `getSheet` → parses JSON array from `localStorage`
    - `appendRow` → pushes to JSON array in `localStorage`, generates UUID if row has no `id`
    - `updateCell` → finds row by `id`, updates field
    - `softDelete` → sets `deleted_at` on matching row
    - `createSpreadsheet` → stores a fake `spreadsheetId` UUID in `localStorage`, returns it
    - `shareSpreadsheet` → no-op (logs to console in dev)
  - `src/lib/adapters/mock/MockAuthAdapter.ts` — implements `AuthAdapter`
    - `signIn()` → returns preset owner user: `{ id: 'mock-owner', email: 'owner@test.com', name: 'Test Owner', role: 'owner' }`
    - `signOut()` → clears user from memory
    - `getCurrentUser()` / `getAccessToken()` → returns in-memory user / `'mock-token'`
  - `src/lib/adapters/mock/seed.ts` — optional: seed `localStorage` with realistic test data for dev
- **Test cases (`MockDataAdapter.test.ts`):**
  - ✅ `appendRow stores row in localStorage under correct key`
  - ✅ `getSheet returns all non-deleted rows`
  - ✅ `getSheet returns empty array when key does not exist`
  - ✅ `updateCell modifies correct field on correct row`
  - ✅ `softDelete sets deleted_at on correct row`
  - ✅ `softDelete does not physically remove the row`
  - ✅ `createSpreadsheet stores and returns a UUID`
  - ❌ `updateCell throws if rowId not found`
  - ❌ `softDelete throws if rowId not found`
- **Test cases (`MockAuthAdapter.test.ts`):**
  - ✅ `signIn returns preset owner user`
  - ✅ `getCurrentUser returns null before signIn`
  - ✅ `signOut clears current user`
  - ✅ `getAccessToken returns "mock-token" after signIn`

---

### T047 — GoogleDataAdapter & GoogleAuthAdapter

- **Status:** ✅ done
- **Section:** Core Library
- **Depends on:** T045, T010
- **Test type:** unit (MSW mocks)
- **Architecture note:** `GoogleDataAdapter` wraps `lib/adapters/google/sheets/sheets.client.ts` and translates the generic `DataAdapter` interface into concrete Sheets API calls. All Google-specific concerns live here: spreadsheetId management, tab naming conventions, row-to-object mapping, and header row handling. `GoogleAuthAdapter` wraps `@react-oauth/google`. By keeping all Google-specific code inside these two files, future migration to a different backend only requires replacing these adapters — zero changes to feature modules.
- **Deliverables:**
  - `src/lib/adapters/google/GoogleDataAdapter.ts` — implements `DataAdapter`
    - `getSheet` → calls `sheetsGet`, maps rows to objects using header row as keys
    - `appendRow` → calls `sheetsAppend`, maps object to ordered row array
    - `updateCell` → reads row index via `sheetsGet`, calls `sheetsUpdate` on specific cell
    - `softDelete` → finds row by id, updates `deleted_at` cell
    - `createSpreadsheet` → calls Drive API `files.create`
    - `shareSpreadsheet` → calls Drive API `permissions.create`
  - `src/lib/adapters/google/GoogleAuthAdapter.ts` — implements `AuthAdapter` via GIS
- **Test cases (`GoogleDataAdapter.test.ts` — all with MSW):**
  - ✅ `getSheet fetches correct spreadsheetId and range`
  - ✅ `getSheet maps header row columns to object keys`
  - ✅ `appendRow maps object fields to ordered row array`
  - ✅ `updateCell reads row number then sends targeted update`
  - ✅ `softDelete sets deleted_at on correct cell`
  - ❌ `getSheet throws AdapterError on Sheets API 403`
  - ❌ `appendRow throws AdapterError on Sheets API 429 after retries`

---

### T011 — UUID v4 Generator (`lib/uuid.ts`)

- **Status:** ✅ done
- **Section:** Core Library
- **Depends on:** T009
- **Test type:** unit
- **Architecture note:** `crypto.randomUUID()` is used because it is natively available in all supported browsers (Chrome 92+, Firefox 95+, Safari 15.4+). A thin wrapper is created so tests can mock it.
- **Test cases (`uuid.test.ts`):**
  - ✅ `generateId returns a valid UUID v4 format string`
  - ✅ `two calls return different values`

---

### T012 — IDR Formatter & Date Utilities (`lib/formatters.ts`)

- **Status:** ✅ done
- **Section:** Core Library
- **Depends on:** T009
- **Test type:** unit
- **Architecture note:** `Intl.NumberFormat` is used for currency formatting (native, no bundle cost) rather than a library like `numeral.js`. All monetary storage is in plain integers (no decimals). `date-fns` with the `id` locale is used for date formatting — chosen over `moment.js` (deprecated, large) and `dayjs` (smaller but less type-safe with locales).
- **Deliverables:**
  - `formatIDR(amount: number): string` — e.g., `15000` → `"Rp 15.000"`
  - `formatDate(isoString: string, timezone: string): string` — e.g., `"2026-04-18"` (DD/MM/YYYY)
  - `formatDateTime(isoString: string, timezone: string): string` — e.g., `"18/04/2026 12:30"`
  - `nowUTC(): string` — current UTC ISO 8601 timestamp
  - `parseIDR(displayString: string): number` — inverse of formatIDR
- **Test cases (`formatters.test.ts`):**
  - ✅ `formatIDR(15000) returns "Rp 15.000"`
  - ✅ `formatIDR(0) returns "Rp 0"`
  - ✅ `formatIDR(1000000) returns "Rp 1.000.000"`
  - ✅ `formatDate returns DD/MM/YYYY in WIB timezone`
  - ✅ `formatDate returns DD/MM/YYYY in WIT timezone`
  - ✅ `nowUTC returns a valid ISO 8601 UTC string`
  - ✅ `parseIDR("Rp 15.000") returns 15000`
  - ❌ `formatIDR throws on negative number`
  - ❌ `formatIDR throws on non-integer (float) input`
  - ❌ `parseIDR throws on malformed string`

---

### T013 — Input Validators (`lib/validators.ts`)

- **Status:** ✅ done
- **Section:** Core Library
- **Depends on:** T009
- **Test type:** unit
- **Architecture note:** Validators are pure functions returning `{ valid: boolean, error?: string }`. They are intentionally not tied to any form library so they can be used in both UI form validation and service-layer data validation without coupling.
- **Deliverables:**
  - `validateEmail(email: string)`
  - `validatePhone(phone: string)` — Indonesian format (+62 or 08xx)
  - `validatePrice(value: number)` — positive integer
  - `validateQuantity(value: number)` — positive integer ≥ 1
  - `validatePIN(pin: string)` — 4–6 digits
  - `validateSKU(sku: string)` — alphanumeric, max 50 chars
- **Test cases (`validators.test.ts`):**
  - ✅ `validateEmail returns valid for "user@gmail.com"`
  - ✅ `validatePhone returns valid for "081234567890"`
  - ✅ `validatePhone returns valid for "+6281234567890"`
  - ✅ `validatePrice returns valid for 3500`
  - ✅ `validatePIN returns valid for "1234"`
  - ✅ `validatePIN returns valid for "123456"`
  - ❌ `validateEmail returns invalid for "notanemail"`
  - ❌ `validatePhone returns invalid for "12345"` (too short)
  - ❌ `validatePrice returns invalid for 0`
  - ❌ `validatePrice returns invalid for -100`
  - ❌ `validatePrice returns invalid for 1.5` (non-integer)
  - ❌ `validatePIN returns invalid for "123"` (too short)
  - ❌ `validatePIN returns invalid for "1234567"` (too long)
  - ❌ `validatePIN returns invalid for "abcd"` (non-numeric)

---

## Authentication

---

### T014 — Google Identity Services (GIS) Integration

- **Status:** ✅ done
- **Section:** Authentication
- **Depends on:** T045, T046
- **Test type:** unit
- **Architecture note:** `@react-oauth/google` is used as a thin React wrapper around GIS. The access token is stored in the Zustand `authStore` in memory only — never in `localStorage` or cookies. This prevents XSS token theft. Token refresh is triggered silently by GIS when the token nears expiry; the store is updated via the `onSuccess` callback. After sign-in, `LoginPage` checks for a cached `masterSpreadsheetId`; if found, routes to `/cashier` (fast path); otherwise routes to `/stores` (StorePickerPage) for store resolution.
- **Deliverables:**
  - `src/modules/auth/AuthProvider.tsx` — wraps app with `GoogleOAuthProvider`
  - `src/modules/auth/useAuth.ts` — Zustand store: `{ user, role, accessToken, spreadsheetId, isAuthenticated }`
  - `src/modules/auth/LoginPage.tsx` — "Sign in with Google" button; navigates to `/stores` after login
  - `src/modules/auth/ProtectedRoute.tsx` — redirects unauthenticated users to `/`
  - `src/modules/auth/StorePickerPage.tsx` — calls `findOrCreateMain()` on mount; routes based on store count (0 → /setup, 1 → auto-activate, 2+ → show picker)
- **Test cases (`auth.test.ts`):**
  - ✅ `isAuthenticated is false on initial state`
  - ✅ `login sets user, role, accessToken in store`
  - ✅ `logout clears user, role, accessToken from store`
  - ✅ `ProtectedRoute redirects to / when not authenticated`
  - ✅ `ProtectedRoute renders children when authenticated`
  - ❌ `login does not store accessToken in localStorage`

---

### T015 — First-Time Setup: Create Master Spreadsheet

- **Status:** ✅ done
- **Section:** Authentication
- **Depends on:** T014, T046, T011
- **Test type:** unit
- **Architecture note:** The Drive API calls use the `drive` scope, which is requested only for the owner at first-time setup (and when inviting members or creating branches). Subsequent cashier/member logins only need the `spreadsheets` scope. On setup the owner session creates the full folder hierarchy (`apps/pos_umkm/stores/<store_id>/`), the `main` spreadsheet (via `findOrCreateMain`), and the `master` spreadsheet. The `mainSpreadsheetId`, `masterSpreadsheetId`, and `activeStoreId` are saved to `localStorage`. `SetupWizard` calls `runStoreSetup()` (not `runFirstTimeSetup`) — `findOrCreateMain()` is called earlier by `StorePickerPage` before navigating to `/setup`.
- **Deliverables:**
  - `src/modules/auth/setup.service.ts`:
    - `findOrCreateMain(ownerEmail?)` → `{ mainSpreadsheetId, stores[] }` — creates `apps/pos_umkm/main` if absent
    - `createMasterSpreadsheet(businessName, ownerEmail, mainSpreadsheetId)` → returns `masterSpreadsheetId`
    - `initializeMasterSheets(spreadsheetId)` → creates all tab headers (Settings, Members, Categories, Products, Variants, Customers, Purchase_Orders, Purchase_Order_Items, Stock_Log, Audit_Log, Monthly_Sheets)
    - `activateStore(store)` → routes adapter to master + monthly sheets, saves IDs to localStorage
    - `runStoreSetup(businessName, ownerEmail?)` → orchestrates master + monthly sheet creation
    - `saveSpreadsheetId(spreadsheetId)` → writes to `localStorage`
  - `src/modules/auth/SetupWizard.tsx` — onboarding form: business name, timezone, PPN toggle; calls `runStoreSetup()`
- **Test cases (`setup.service.test.ts`):**
  - ✅ `createMasterSpreadsheet creates only master spreadsheet (not main)`
  - ✅ `createMasterSpreadsheet registers store in main.Stores tab`
  - ✅ `createMasterSpreadsheet saves activeStoreId to localStorage`
  - ✅ `initializeMasterSheets creates all 11 required tabs`
  - ✅ `initializeMasterSheets writes correct headers for each tab`
  - ✅ `saveSpreadsheetId writes to localStorage key "masterSpreadsheetId"`
  - ✅ `findOrCreateMain creates main and returns empty stores when mainSpreadsheetId is not in localStorage`
  - ✅ `findOrCreateMain reads stores from existing main when mainSpreadsheetId is cached`
  - ✅ `activateStore saves masterSpreadsheetId and activeStoreId to localStorage`
  - ✅ `activateStore creates monthly sheet when none exists for current month`
  - ✅ `runStoreSetup throws SetupError when mainSpreadsheetId is not in localStorage`
  - ✅ `runStoreSetup returns masterSpreadsheetId and monthlySpreadsheetId`
  - ❌ `createMasterSpreadsheet throws SetupError on Drive API failure`
  - ❌ `initializeMasterSheets throws if spreadsheetId is invalid`

---

### T016 — Monthly Transaction Spreadsheet Management

- **Status:** ✅ done
- **Section:** Authentication
- **Depends on:** T015, T046
- **Test type:** unit
- **Architecture note:** A new monthly spreadsheet is created on the first transaction of each new calendar month (lazy creation) — by an owner or manager session only (cashiers lack the `drive` scope to create files). The recommended pattern is to pre-create next month's sheet during the last week of the current month when an owner/manager session is active. The `spreadsheetId` for each month is registered in the master sheet's `Monthly_Sheets` tab (`year_month → spreadsheetId`). On app load, the auth flow reads `Monthly_Sheets` to resolve the current month's sheet — no Drive folder listing needed.
- **Deliverables:**
  - `src/modules/auth/setup.service.ts` (additions):
    - `getCurrentMonthSheetId(token, masterSpreadsheetId): string | null` — reads from `Monthly_Sheets` tab in master sheet
    - `createMonthlySheet(year, month, token, masterSpreadsheetId)` → `spreadsheetId`
    - `initializeMonthlySheets(spreadsheetId, token)` → creates Transactions, Transaction_Items, Refunds tabs
    - `shareSheetWithAllMembers(spreadsheetId, token, masterSpreadsheetId)` — reads Members tab, shares with each member
- **Test cases (`setup.service.test.ts` additions):**
  - ✅ `getCurrentMonthSheetId returns null when localStorage is empty`
  - ✅ `getCurrentMonthSheetId returns stored id for current month key`
  - ✅ `createMonthlySheet names spreadsheet "transaction_<year>-<month>" inside the year folder`
  - ✅ `initializeMonthlySheets creates Transactions, Transaction_Items, Refunds tabs`
  - ✅ `shareSheetWithAllMembers reads Members tab and calls Drive API share for each active member`
  - ❌ `createMonthlySheet throws on Drive API error`

---

### T017 — Member Invite Flow

- **Status:** ✅ done
- **Section:** Authentication
- **Depends on:** T015, T046, T012
- **Test type:** unit + e2e
- **Architecture note:** Inviting a member requires two actions: (1) share the `stores/<store_id>/` folder via Drive API (granting access to all current and future files inside), (2) append a row to the `Members` tab. The Store Link is a URL containing the `masterSpreadsheetId` encoded in a query param (`/join?sid=<id>`). The owner never needs to share a password — the link is the invite mechanism. The invited user must still authenticate with Google.
- **Deliverables:**
  - `src/modules/settings/members.service.ts`:
    - `inviteMember(email, role, token, masterSpreadsheetId)` — shares `stores/<store_id>/` folder + appends to Members tab
    - `generateStoreLink(masterSpreadsheetId): string` — returns `https://<domain>/join?sid=<masterSpreadsheetId>`
    - `revokeMember(userId, token, masterSpreadsheetId)` — sets `deleted_at` in Members tab (soft delete); does not unshare Drive folder (must be done manually)
    - `listMembers(token, masterSpreadsheetId): Member[]`
  - `src/modules/settings/MemberManagement.tsx` — UI for invite + list + revoke
- **Test cases (`members.service.test.ts`):**
  - ✅ `inviteMember appends correct row to Members tab with role and invited_at`
  - ✅ `inviteMember calls Drive API share with editor permission`
  - ✅ `generateStoreLink includes spreadsheetId as ?sid= query param`
  - ✅ `revokeMember sets deleted_at on correct Members row`
  - ✅ `listMembers filters out rows where deleted_at is non-empty`
  - ❌ `inviteMember throws if email is invalid`
  - ❌ `inviteMember throws if role is not owner/manager/cashier`
  - ❌ `inviteMember throws on Drive API error`
- **E2E spec:** `src/tests/e2e/members.flow.spec.ts`
  - `"owner can invite a member via email and generate Store Link"`
  - `"owner can revoke a member's access"`

---

### T018 — Store Link Join Flow (Member Onboarding)

- **Status:** ✅ done
- **Section:** Authentication
- **Depends on:** T017, T014
- **Test type:** unit + e2e
- **Architecture note:** When a member opens a Store Link (`/join?sid=<masterSpreadsheetId>`), the app stores the `masterSpreadsheetId` in `localStorage` before prompting Google Login. Members only request the `spreadsheets` scope (not `drive`) because they access spreadsheets shared via the store folder — they don't need Drive API access. Their role is resolved by reading the `Members` tab and matching by email. After joining, the app reads `Settings` to get `store_id` and `drive_folder_id`, then creates/updates the member's own `main` spreadsheet with a `Stores` row for this store.
- **Deliverables:**
  - `src/modules/auth/JoinPage.tsx` — reads `?sid` param, stores it, shows Google Login
  - `src/modules/auth/auth.service.ts`:
    - `resolveUserRole(email, token, masterSpreadsheetId): Role` — reads Members tab
    - `isFirstTimeOwner(masterSpreadsheetId): boolean` — checks if Members tab is empty
- **Test cases (`auth.service.test.ts`):**
  - ✅ `resolveUserRole returns "cashier" for a known member email`
  - ✅ `resolveUserRole returns "owner" for the store owner email`
  - ✅ `isFirstTimeOwner returns true when Members tab has no rows`
  - ❌ `resolveUserRole throws UnauthorizedError if email not in Members tab`
  - ❌ `resolveUserRole throws if member has been revoked (deleted_at set)`
- **E2E spec:** `src/tests/e2e/members.flow.spec.ts`
  - `"member can join store via Store Link and is assigned correct role"`
  - `"cashier role cannot access /reports (redirected to /cashier)"`

---

### T019 — Role-Based Route Protection

- **Status:** ✅ done
- **Section:** Authentication
- **Depends on:** T018, T003
- **Test type:** unit + e2e
- **Architecture note:** Route-level access control is implemented as a `<RoleRoute>` wrapper component (similar to `<ProtectedRoute>`). This is UI-level enforcement only — there is no backend to enforce it server-side. This is acceptable for the family-trust model. Each route declares its minimum required role; any user with insufficient role is redirected to `/cashier`.
- **Deliverables:**
  - `src/modules/auth/RoleRoute.tsx` — `<RoleRoute minRole="manager">` wrapper
  - Role hierarchy: `cashier < manager < owner`
  - Apply `<RoleRoute>` to: `/reports` (manager+), `/catalog` (manager+), `/settings` (owner only)
- **Test cases (`RoleRoute.test.tsx`):**
  - ✅ `owner can access /settings`
  - ✅ `manager can access /reports`
  - ✅ `cashier can access /cashier`
  - ❌ `cashier redirected from /reports to /cashier`
  - ❌ `cashier redirected from /settings to /cashier`
  - ❌ `manager redirected from /settings to /cashier`
- **E2E spec:** `src/tests/e2e/members.flow.spec.ts`
  - `"cashier role cannot navigate to /reports"`

---

### T020 — POS Terminal PIN Lock

- **Status:** ✅ done
- **Section:** Authentication
- **Depends on:** T018, T012
- **Test type:** unit + e2e
- **Architecture note:** The PIN is hashed with bcrypt (via `bcryptjs`, a pure JS implementation — no native dependency required in browser) before being stored in the `Members` sheet. PIN validation happens entirely in the browser using `bcryptjs.compare()`. No network call is needed for unlock. The idle timer uses `setTimeout` reset on any user interaction event (`mousemove`, `keydown`, `touchstart`).
- **Deliverables:**
  - `src/modules/auth/PinLock.tsx` — lock screen overlay component
  - `src/modules/auth/usePinLock.ts` — idle timer hook, lock/unlock state
  - `src/modules/auth/pin.service.ts`:
    - `hashPIN(pin: string): Promise<string>`
    - `verifyPIN(pin: string, hash: string): Promise<boolean>`
    - `savePINHash(userId, hash, token, spreadsheetId)`
- **Test cases (`pin.service.test.ts`):**
  - ✅ `hashPIN returns a bcrypt hash string`
  - ✅ `verifyPIN returns true for correct PIN against its hash`
  - ✅ `verifyPIN returns false for wrong PIN`
  - ✅ `usePinLock locks after idle period elapses`
  - ✅ `usePinLock resets timer on user interaction`
  - ✅ `usePinLock unlocks on correct PIN`
  - ❌ `verifyPIN returns false for empty PIN`
  - ❌ `usePinLock does not unlock on wrong PIN`
- **E2E spec:** `src/tests/e2e/members.flow.spec.ts`
  - `"POS terminal auto-locks after idle timeout"`
  - `"cashier can unlock terminal with correct PIN"`
  - `"wrong PIN does not unlock terminal"`

---

## Catalog

> Sections Catalog through Settings can be parallelized once Authentication is done. Each module is independent.

---

### T021 — Categories CRUD

- **Status:** ✅ done
- **Section:** Catalog
- **Depends on:** T015, T046, T011, T012
- **Test type:** unit + e2e
- **Architecture note:** Categories are stored in the `Categories` tab of the Master Sheet. They are fetched once on app load and cached in a Zustand `catalogStore`. All writes go through `catalog.service.ts` → `lib/adapters/`. Soft deletes are used: setting `deleted_at` instead of removing the row, to preserve referential integrity (Products that reference a deleted category still display correctly).
- **Deliverables:**
  - `src/modules/catalog/catalog.service.ts`:
    - `fetchCategories(token, spreadsheetId): Category[]`
    - `addCategory(name, token, spreadsheetId): Category`
    - `updateCategory(id, name, token, spreadsheetId)`
    - `deleteCategory(id, token, spreadsheetId)` — soft delete
  - `src/modules/catalog/useCatalog.ts` — Zustand store slice for categories
  - `src/modules/catalog/CategoryList.tsx` + `CategoryForm.tsx`
- **Test cases (`catalog.service.test.ts`):**
  - ✅ `fetchCategories returns parsed list excluding soft-deleted rows`
  - ✅ `addCategory appends correct row with generated UUID`
  - ✅ `updateCategory updates name cell of correct row`
  - ✅ `deleteCategory sets deleted_at on correct row`
  - ❌ `addCategory throws if name is empty`
  - ❌ `addCategory throws if name exceeds 100 characters`
  - ❌ `deleteCategory throws if category has associated products` (block delete)
- **E2E spec:** `src/tests/e2e/inventory.flow.spec.ts`
  - `"owner can create, rename, and delete a category"`

---

### T022 — Products CRUD

- **Status:** ✅ done
- **Section:** Catalog
- **Depends on:** T021
- **Test type:** unit + e2e
- **Architecture note:** Products are the most frequently read entity. The full Products tab is loaded into React state on app open and searched client-side — avoiding an API call per search keystroke. Stock is stored as an integer column on the product row; it is decremented via `values.update` targeting the specific cell (row, column G). This is read-then-write and not atomic, which is documented and acceptable for single-cashier MVP.
- **Deliverables:**
  - `src/modules/catalog/catalog.service.ts` (additions):
    - `fetchProducts(token, spreadsheetId): Product[]`
    - `addProduct(product, token, spreadsheetId): Product`
    - `updateProduct(id, changes, token, spreadsheetId)`
    - `deleteProduct(id, token, spreadsheetId)` — soft delete
    - `decrementStock(productId, qty, token, spreadsheetId)` — read + update stock cell
  - `src/modules/catalog/ProductList.tsx` + `ProductForm.tsx`
- **Test cases (`catalog.service.test.ts` additions):**
  - ✅ `fetchProducts returns all non-deleted products`
  - ✅ `addProduct appends row with all required fields`
  - ✅ `updateProduct updates only changed fields`
  - ✅ `decrementStock reads current stock, computes new value, writes updated cell`
  - ✅ `deleteProduct sets deleted_at`
  - ❌ `addProduct throws if price is not a positive integer`
  - ❌ `addProduct throws if name is empty`
  - ❌ `decrementStock throws if resulting stock would go below 0` (warn owner; still allow)
  - ❌ `deleteProduct throws if product has unsynced transactions`
- **E2E spec:** `src/tests/e2e/inventory.flow.spec.ts`
  - `"owner can add a product and it appears in cashier product search"`
  - `"completing a sale decrements product stock by correct quantity"`

---

### T023 — Product Variants

- **Status:** ✅ done
- **Section:** Catalog
- **Depends on:** T022
- **Test type:** unit
- **Architecture note:** Variants (e.g., Kaos — Size S / M / L, each with own price and stock) are stored in the `Variants` tab, linked to their parent product by `product_id`. When a product has `has_variants: TRUE`, the cashier screen shows a variant selector instead of adding the base product directly. Stock is tracked per variant, not on the parent product row.
- **Deliverables:**
  - `src/modules/catalog/catalog.service.ts` (additions):
    - `fetchVariants(token, spreadsheetId): Variant[]`
    - `addVariant(productId, optionName, optionValue, price, stock, token, spreadsheetId)`
    - `deleteVariant(variantId, token, spreadsheetId)`
    - `decrementVariantStock(variantId, qty, token, spreadsheetId)`
  - `src/modules/catalog/VariantManager.tsx`
- **Test cases:**
  - ✅ `fetchVariants returns all variants for a given product_id`
  - ✅ `addVariant appends row linked to correct product_id`
  - ✅ `decrementVariantStock updates stock on correct variant row`
  - ❌ `addVariant throws if price is non-positive`
  - ❌ `addVariant throws if optionValue is empty`

---

### T024 — CSV Bulk Product Import

- **Status:** ✅ done
- **Section:** Catalog
- **Depends on:** T022
- **Test type:** unit
- **Architecture note:** CSV parsing is done with `papaparse` (robust, handles edge cases like quoted commas). A downloadable CSV template is provided so users know the column format. Import validates each row before any write; if any row is invalid, the entire import is rejected with a per-row error report. This all-or-nothing approach prevents partial imports that leave data in an inconsistent state.
- **Deliverables:**
  - `src/modules/catalog/csv.service.ts`:
    - `parseProductCSV(file: File): ParsedProduct[]`
    - `validateImportRows(rows): ValidationResult[]`
    - `bulkImportProducts(rows, token, spreadsheetId)` — uses `values.append` with all rows in one call
  - `src/modules/catalog/CSVImport.tsx` — file picker + preview + error table
  - `public/templates/products-template.csv`
- **Test cases (`csv.service.test.ts`):**
  - ✅ `parseProductCSV correctly maps CSV columns to Product fields`
  - ✅ `validateImportRows returns valid for a well-formed row`
  - ✅ `bulkImportProducts appends all rows in a single API call`
  - ❌ `validateImportRows returns error for row with empty name`
  - ❌ `validateImportRows returns error for row with non-numeric price`
  - ❌ `bulkImportProducts throws and does not write if any row is invalid`

---

## Cashier

---

### T025 — Cart State Management

- **Status:** ✅ done
- **Section:** Cashier
- **Depends on:** T004, T012, T013
- **Test type:** unit
- **Architecture note:** Cart state lives in a Zustand `cartStore` (not React local state) so it persists across route changes and survives a page re-render. The cart is reset on transaction completion. All price calculations (subtotal, discount, tax, total, change) are pure functions in `cashier.service.ts` so they are independently testable without any React component.
- **Deliverables:**
  - `src/modules/cashier/useCart.ts` — Zustand store: `{ items, discount, paymentMethod, cashReceived, heldCarts }`
  - `src/modules/cashier/cashier.service.ts`:
    - `calculateSubtotal(items): number`
    - `applyDiscount(subtotal, discount: DiscountType): number`
    - `calculateTax(subtotalAfterDiscount, taxRate): number`
    - `calculateTotal(subtotal, discount, tax): number`
    - `calculateChange(total, cashReceived): number`
- **Test cases (`cashier.service.test.ts`):**
  - ✅ `calculateSubtotal sums item price × quantity correctly`
  - ✅ `calculateSubtotal returns 0 for empty cart`
  - ✅ `applyDiscount applies percentage discount correctly (e.g., 10% of 15000 = 1500)`
  - ✅ `applyDiscount applies flat IDR discount correctly`
  - ✅ `calculateTax applies 11% PPN on subtotal after discount`
  - ✅ `calculateTax returns 0 when tax is disabled`
  - ✅ `calculateTotal = subtotal - discount + tax`
  - ✅ `calculateChange = cashReceived - total`
  - ✅ `calculateChange returns 0 when cashReceived equals total`
  - ❌ `calculateChange throws when cashReceived is less than total`
  - ❌ `applyDiscount throws when percentage discount > 100`
  - ❌ `applyDiscount throws when flat discount > subtotal`

---

### T026 — Product Search (Cashier Screen)

- **Status:** ✅ done
- **Section:** Cashier
- **Depends on:** T025, T022
- **Test type:** unit + e2e
- **Architecture note:** Search runs against the in-memory product list from `catalogStore` using a simple case-insensitive `includes()` match on name and SKU. No Sheets API call per keystroke. Debounced at 150ms to avoid excessive renders on fast typing. Search by barcode is deferred to post-MVP (see §9 TRD).
- **Deliverables:**
  - `src/modules/cashier/ProductSearch.tsx` — search input + results grid
  - `src/modules/cashier/cashier.service.ts` (addition):
    - `searchProducts(query, products): Product[]`
- **Test cases (`cashier.service.test.ts` additions):**
  - ✅ `searchProducts returns products matching name case-insensitively`
  - ✅ `searchProducts returns products matching SKU`
  - ✅ `searchProducts returns all products for empty query`
  - ✅ `searchProducts returns empty array when no match`
  - ❌ `searchProducts excludes soft-deleted products`
  - ❌ `searchProducts excludes products with has_variants=true from direct add (must go through variant selector)`
- **E2E spec:** `src/tests/e2e/cashier.flow.spec.ts`
  - `"cashier can search for a product by name and add it to cart"`

---

### T027 — Cash Payment + Change Calculation

- **Status:** ✅ done
- **Section:** Cashier
- **Depends on:** T025
- **Test type:** unit + e2e
- **Architecture note:** The change amount is computed in real-time as the cashier types the received amount, using the pure `calculateChange()` from T025. Quick-amount buttons (Rp 5.000 / Rp 10.000 / Rp 20.000 / Rp 50.000 / Rp 100.000) are rendered dynamically based on the transaction total, rounding up to the nearest denomination. This reduces input time for the most common case (paying with a banknote).
- **Deliverables:**
  - `src/modules/cashier/PaymentModal.tsx` — payment method selector
  - `src/modules/cashier/CashPayment.tsx`:
    - `cash received` input (integer, IDR)
    - Real-time change display using `calculateChange()`
    - Quick-amount buttons (nearest common IDR denominations above total)
  - `src/modules/cashier/cashier.service.ts` (addition):
    - `suggestDenominations(total: number): number[]` — returns quick-amount button values
- **Test cases (`cashier.service.test.ts` additions):**
  - ✅ `suggestDenominations(13000) returns [15000, 20000, 50000, 100000]`
  - ✅ `suggestDenominations(50000) returns [50000, 100000]`
  - ✅ `calculateChange(20000, 16650) returns 3350`
  - ✅ `calculateChange(16650, 16650) returns 0`
  - ❌ `calculateChange(10000, 16650) throws InsufficientCashError`
- **E2E spec:** `src/tests/e2e/cashier.flow.spec.ts`
  - `"cashier enters cash received and sees correct change amount"`
  - `"quick-amount buttons show correct denominations"`
  - `"selecting a quick-amount button fills cash received and computes change"`

---

### T028 — QRIS Payment (Manual Confirmation)

- **Status:** ✅ done
- **Section:** Cashier
- **Depends on:** T025
- **Test type:** unit + e2e
- **Architecture note:** Real-time QRIS webhook confirmation requires Bank Indonesia PJSP licensing (post-MVP). MVP uses a static merchant QRIS QR code displayed as an image. The cashier manually confirms receipt of payment by pressing "Payment Received". The QR image is stored as a URL in the `Settings` tab (owner uploads it during setup). This approach requires zero additional infrastructure.
- **Deliverables:**
  - `src/modules/cashier/QRISPayment.tsx` — displays QR image + amount + "Payment Received" button
  - `src/modules/settings/settings.service.ts` (addition):
    - `getQRISImageUrl(token, spreadsheetId): string`
    - `saveQRISImageUrl(url, token, spreadsheetId)`
- **Test cases:**
  - ✅ `QRISPayment renders the QRIS image from settings`
  - ✅ `"Payment Received" button completes the transaction`
  - ❌ `QRISPayment shows error state if no QRIS image configured in settings`
- **E2E spec:** `src/tests/e2e/cashier.flow.spec.ts`
  - `"cashier can complete a QRIS payment by manually confirming"`

---

### T029 — Discount Application

- **Status:** ✅ done
- **Section:** Cashier
- **Depends on:** T025
- **Test type:** unit
- **Architecture note:** Discounts are applied at the transaction level (not item level) in MVP, as this covers the majority of UMKM use cases (e.g., "10% off today"). Item-level discounts are a post-MVP feature. Discounts can be a flat IDR amount or a percentage. Both are stored as structured data on the transaction row: `discount_type` ("flat" | "percent") and `discount_value` (integer).
- **Deliverables:**
  - `src/modules/cashier/DiscountInput.tsx` — toggle flat vs. percent, value input
  - `src/modules/cashier/useCart.ts` (addition): `setDiscount(type, value)`
- **Test cases:**
  - ✅ `flat discount of Rp 2.000 on Rp 15.000 subtotal = Rp 13.000`
  - ✅ `10% discount on Rp 15.000 subtotal = Rp 13.500`
  - ✅ `discount of 0 leaves subtotal unchanged`
  - ❌ `flat discount larger than subtotal shows validation error`
  - ❌ `percentage discount > 100 shows validation error`

---

### T030 — Split Payment (Cash + QRIS)

- **Status:** ✅ done
- **Section:** Cashier
- **Depends on:** T027, T028
- **Test type:** unit + e2e
- **Architecture note:** Split payment allows part of the transaction to be paid in cash and the remainder via QRIS. The cart store holds a `splitPayment` object: `{ cashAmount, qrisAmount }`. `cashAmount + qrisAmount` must equal the transaction total. This is validated before the transaction is committed. The `payment_method` column on the Transactions tab stores "SPLIT" for these transactions, and `cash_received` stores only the cash portion.
- **Deliverables:**
  - `src/modules/cashier/SplitPayment.tsx` — cash amount input + QRIS QR for remainder
  - `src/modules/cashier/cashier.service.ts` (addition):
    - `validateSplitPayment(cashAmount, qrisAmount, total): boolean`
- **Test cases:**
  - ✅ `split of Rp 10.000 cash + Rp 6.650 QRIS on Rp 16.650 total is valid`
  - ✅ `cash portion change is correctly calculated`
  - ❌ `split amounts not summing to total throws SplitPaymentError`
  - ❌ `negative cash or QRIS amount throws SplitPaymentError`
- **E2E spec:** `src/tests/e2e/cashier.flow.spec.ts`
  - `"cashier can complete a split payment (part cash, part QRIS)"`

---

### T031 — Hold Transaction

- **Status:** ✅ done
- **Section:** Cashier
- **Depends on:** T025
- **Test type:** unit + e2e
- **Architecture note:** Held carts are stored in the Zustand `cartStore` as an array of `heldCarts`. They are NOT persisted to Sheets (they are temporary, in-progress states). If the browser is refreshed, held carts are lost. This is acceptable for MVP — holding a cart is a short-term operation during a single session.
- **Deliverables:**
  - `src/modules/cashier/useCart.ts` (additions): `holdCart()`, `retrieveCart(index)`, `heldCarts[]`
  - `src/modules/cashier/HeldCartsPanel.tsx` — list of held carts with retrieve button
- **Test cases:**
  - ✅ `holdCart saves current cart to heldCarts and clears active cart`
  - ✅ `retrieveCart restores the selected held cart as active cart`
  - ✅ `multiple carts can be held simultaneously`
  - ❌ `holdCart on empty cart shows validation error`
  - ❌ `retrieveCart with invalid index throws`
- **E2E spec:** `src/tests/e2e/cashier.flow.spec.ts`
  - `"cashier can hold a transaction, start a new one, and retrieve the held transaction"`

---

### T032 — Transaction Commit + Stock Decrement

- **Status:** ✅ done
- **Section:** Cashier
- **Depends on:** T027, T022, T016
- **Test type:** unit + e2e
- **Architecture note:** Transaction commit is a multi-step write sequence: (1) append to `Transactions` tab, (2) append to `Transaction_Items` tab (all items in one `values.append` call), (3) decrement stock for each distinct product. Steps are attempted sequentially. If step 3 partially fails (e.g., rate limit on product N), the transaction header is already written — the cashier is shown an alert to manually verify stock. This is safer than rolling back (which would require deleting the appended row, which is complex with Sheets API).
- **Deliverables:**
  - `src/modules/cashier/cashier.service.ts` (addition):
    - `commitTransaction(cart, payment, token, masterSpreadsheetId, monthlySpreadsheetId)`
    - `ensureMonthlySheetExists(token, masterSpreadsheetId)` — creates monthly sheet if needed
- **Test cases (`cashier.service.test.ts` additions):**
  - ✅ `commitTransaction appends 1 row to Transactions tab`
  - ✅ `commitTransaction appends all cart items in 1 call to Transaction_Items tab`
  - ✅ `commitTransaction decrements stock for each distinct product`
  - ✅ `commitTransaction creates a new monthly sheet if one does not exist for current month`
  - ✅ `commitTransaction returns the completed transaction object with generated ID`
  - ❌ `commitTransaction throws if cart is empty`
  - ❌ `commitTransaction shows partial failure alert if stock decrement fails for any product`
- **E2E spec:** `src/tests/e2e/cashier.flow.spec.ts`
  - `"completing a transaction writes to Transactions and Transaction_Items sheets"`
  - `"product stock is decremented after transaction"`

---

### T033 — WhatsApp Receipt Generation

- **Status:** ✅ done
- **Section:** Cashier
- **Depends on:** T032, T012
- **Test type:** unit + e2e
- **Architecture note:** Receipts are shared via a pre-filled `wa.me` link (e.g., `https://wa.me/?text=...`). The receipt text is URL-encoded and includes: business name, date/time, itemized list, subtotal, discount, tax, total, payment method, and receipt number. This requires zero infrastructure — it opens WhatsApp on the customer's device with the receipt pre-typed. Thermal printing is post-MVP.
- **Deliverables:**
  - `src/modules/cashier/receipt.service.ts`:
    - `generateReceiptText(transaction, items, settings): string` — plain text receipt
    - `generateWhatsAppLink(phoneNumber, receiptText): string` — `wa.me/?text=...`
    - `generateReceiptNumber(prefix, sequence): string` — e.g., `INV/2026/001`
  - `src/modules/cashier/ReceiptModal.tsx` — shows receipt preview + "Share via WhatsApp" button
- **Test cases (`receipt.service.test.ts`):**
  - ✅ `generateReceiptText includes business name, date, all items, total`
  - ✅ `generateReceiptText includes correct tax and discount lines`
  - ✅ `generateWhatsAppLink produces a valid wa.me URL with encoded text`
  - ✅ `generateReceiptNumber formats correctly as INV/YYYY/NNN`
  - ✅ `generateReceiptNumber zero-pads sequence to 3 digits`
  - ❌ `generateWhatsAppLink throws if phoneNumber is not a valid Indonesian number`
- **E2E spec:** `src/tests/e2e/cashier.flow.spec.ts`
  - `"after transaction, receipt modal shows correct totals and WhatsApp share button"`

---

## Inventory

---

### T034 — Stock Opname

- **Status:** ✅ done
- **Section:** Inventory
- **Depends on:** T022, T046
- **Test type:** unit + e2e
- **Architecture note:** Stock opname (physical stock count) shows the current system stock for each product alongside an input field. The owner enters the actual physical count. On save, the system calculates the discrepancy (system - physical) and: (1) updates the stock cell on the Products tab, (2) appends a row to the `Stock_Log` tab with `reason: "opname"` and the before/after values. All products are updated in a `batchUpdate` call to minimize API calls.
- **Deliverables:**
  - `src/modules/inventory/inventory.service.ts`:
    - `fetchStockOpnameData(token, spreadsheetId): OpnameRow[]`
    - `saveOpnameResults(results, token, spreadsheetId)` — batch update + log entries
  - `src/modules/inventory/StockOpname.tsx`
- **Test cases:**
  - ✅ `saveOpnameResults updates stock for each product where count differs`
  - ✅ `saveOpnameResults appends Stock_Log entry with before/after and reason "opname"`
  - ✅ `saveOpnameResults skips products where physical count matches system count`
  - ❌ `saveOpnameResults throws if physical count is negative`
- **E2E spec:** `src/tests/e2e/inventory.flow.spec.ts`
  - `"owner can run stock opname and discrepancies are logged"`

---

### T035 — Purchase Orders (Incoming Stock)

- **Status:** ✅ done
- **Section:** Inventory
- **Depends on:** T022, T046
- **Test type:** unit + e2e
- **Architecture note:** Purchase orders (recording incoming stock from a supplier) increase product stock. On "Receive" action, the stock cell is incremented (read + write, same pattern as decrement). A `Stock_Log` entry is also appended with `reason: "purchase_order"`. Purchase orders are stored in `Purchase_Orders` and `Purchase_Order_Items` tabs of the Master Sheet.
- **Deliverables:**
  - `src/modules/inventory/inventory.service.ts` (additions):
    - `createPurchaseOrder(supplier, items, token, spreadsheetId)`
    - `receivePurchaseOrder(orderId, token, spreadsheetId)` — increments stock + logs
  - `src/modules/inventory/PurchaseOrders.tsx`
- **Test cases:**
  - ✅ `createPurchaseOrder appends to Purchase_Orders and Purchase_Order_Items tabs`
  - ✅ `receivePurchaseOrder increments stock for each item`
  - ✅ `receivePurchaseOrder appends Stock_Log entry with reason "purchase_order"`
  - ❌ `receivePurchaseOrder throws if order status is already "received"`
- **E2E spec:** `src/tests/e2e/inventory.flow.spec.ts`
  - `"owner can create a purchase order and mark it as received, increasing stock"`

---

## Customers

---

### T036 — Customer Management

- **Status:** ✅ done
- **Section:** Customers
- **Depends on:** T015, T046, T011
- **Test type:** unit + e2e
- **Architecture note:** Customers are stored in the `Customers` tab of the Master Sheet. Customer lookup in the cashier screen is done client-side (against cached list) — no API call per keystroke. Phone number is the natural identifier (most UMKM customers are identified by phone, not email).
- **Deliverables:**
  - `src/modules/customers/customers.service.ts`:
    - `fetchCustomers(token, spreadsheetId): Customer[]`
    - `addCustomer(name, phone, token, spreadsheetId): Customer`
    - `updateCustomer(id, changes, token, spreadsheetId)`
  - `src/modules/customers/CustomerSearch.tsx` — typeahead search for cashier screen
- **Test cases:**
  - ✅ `fetchCustomers returns non-deleted customers`
  - ✅ `addCustomer validates phone format before appending`
  - ❌ `addCustomer throws if phone is invalid Indonesian format`
  - ❌ `addCustomer throws if duplicate phone already exists`
- **E2E spec:** `src/tests/e2e/cashier.flow.spec.ts`
  - `"cashier can attach a customer to a transaction"`

---

### T037 — Refund / Return Flow

- **Status:** ✅ done
- **Section:** Customers
- **Depends on:** T032, T022
- **Test type:** unit + e2e
- **Architecture note:** Refunds do not delete or modify the original transaction row (transactions are immutable). Instead, a new row is appended to the `Refunds` tab in the Monthly Sheet. Stock is re-incremented for returned items (read + write on Products tab). An `Audit_Log` entry is also written. The refund amount is manually confirmed by the owner — no automatic cash drawer integration.
- **Deliverables:**
  - `src/modules/customers/refund.service.ts`:
    - `fetchTransaction(transactionId, token, spreadsheetId): Transaction`
    - `createRefund(transactionId, items, reason, token, masterSid, monthlySid)`
  - `src/modules/customers/RefundFlow.tsx`
- **Test cases:**
  - ✅ `createRefund appends row to Refunds tab`
  - ✅ `createRefund re-increments stock for each returned product`
  - ✅ `createRefund appends Audit_Log entry`
  - ❌ `createRefund throws if transaction not found`
  - ❌ `createRefund throws if refund amount exceeds original transaction total`
- **E2E spec:** `src/tests/e2e/cashier.flow.spec.ts`
  - `"owner can process a refund for a completed transaction and stock is restored"`

---

## Reports

---

### T038 — Daily Sales Summary

- **Status:** ✅ done
- **Section:** Reports
- **Depends on:** T016, T046, T012
- **Test type:** unit + e2e
- **Architecture note:** The daily summary aggregates data from the current month's `Transactions` and `Transaction_Items` tabs. All aggregation (sum, count, average, top products) is done in JavaScript after fetching the full tabs. This is efficient because a single month's transaction data fits comfortably in memory for typical UMKM volumes (<5,000 transactions/month).
- **Deliverables:**
  - `src/modules/reports/reports.service.ts`:
    - `fetchDailySummary(date, token, monthlySpreadsheetId): DailySummary`
    - `aggregateTransactions(transactions, items): SummaryStats`
  - `src/modules/reports/DailySummary.tsx`
- **Test cases (`reports.service.test.ts`):**
  - ✅ `aggregateTransactions returns correct total revenue`
  - ✅ `aggregateTransactions returns correct transaction count`
  - ✅ `aggregateTransactions returns correct top 5 products by quantity`
  - ✅ `aggregateTransactions returns correct average basket size`
  - ✅ `aggregateTransactions returns 0 values for a day with no transactions`
  - ❌ `fetchDailySummary throws if monthly sheet does not exist yet`
- **E2E spec:** `src/tests/e2e/reports.flow.spec.ts`
  - `"owner can view today's sales summary after completing transactions"`

---

### T039 — Date-Range Sales Report

- **Status:** ✅ done
- **Section:** Reports
- **Depends on:** T038
- **Test type:** unit + e2e
- **Architecture note:** For date ranges spanning multiple months, the service fetches each relevant Monthly Sheet sequentially (not in parallel, to stay within API rate limits). Results are merged and aggregated client-side. The UI allows filtering by cashier (user email), category, and payment method.
- **Deliverables:**
  - `src/modules/reports/reports.service.ts` (additions):
    - `fetchTransactionsForRange(startDate, endDate, token, masterSpreadsheetId): Transaction[]`
    - `filterTransactions(transactions, filters: ReportFilters): Transaction[]`
  - `src/modules/reports/SalesReport.tsx` — date pickers + filter controls + results table
- **Test cases:**
  - ✅ `fetchTransactionsForRange fetches single monthly sheet for same-month range`
  - ✅ `fetchTransactionsForRange fetches and merges two monthly sheets for cross-month range`
  - ✅ `filterTransactions filters by cashier email correctly`
  - ✅ `filterTransactions filters by payment method correctly`
  - ❌ `fetchTransactionsForRange throws if startDate is after endDate`
- **E2E spec:** `src/tests/e2e/reports.flow.spec.ts`
  - `"owner can filter report by date range and see correct totals"`

---

### T040 — Gross Profit Report

- **Status:** ✅ done
- **Section:** Reports
- **Depends on:** T039, T022
- **Test type:** unit
- **Architecture note:** Gross profit = (selling price - cost price) × qty, summed across all items in the period. Cost price is read from the `Products` tab (master data). A cross-join between `Transaction_Items` (which stores `unit_price` at time of sale) and the current `Products` list (which stores `cost_price`) is done in JavaScript. Note: if the cost price changes after a sale, the report reflects the *current* cost, not the cost at time of sale. This is a known MVP simplification.
- **Deliverables:**
  - `src/modules/reports/reports.service.ts` (addition):
    - `calculateGrossProfit(transactions, items, products): ProfitSummary`
  - `src/modules/reports/GrossProfitReport.tsx`
- **Test cases:**
  - ✅ `calculateGrossProfit returns correct margin for a single item`
  - ✅ `calculateGrossProfit returns correct total across multiple items`
  - ✅ `calculateGrossProfit returns 0 profit for items with no cost price set`
  - ❌ `calculateGrossProfit handles product that was deleted (cost_price unknown) gracefully`

---

### T041 — Cash Reconciliation

- **Status:** ✅ done
- **Section:** Reports
- **Depends on:** T038
- **Test type:** unit + e2e
- **Architecture note:** End-of-day cash reconciliation compares expected cash (opening balance + all cash sales - all cash refunds) against the actual closing balance entered by the cashier. The result (surplus or deficit) is appended to the `Audit_Log` tab as a `CASH_RECONCILIATION` event. This creates a paper trail without requiring any additional spreadsheet tab.
- **Deliverables:**
  - `src/modules/reports/reports.service.ts` (addition):
    - `calculateExpectedCash(openingBalance, transactions, refunds): number`
    - `saveReconciliation(expected, actual, token, masterSid, monthlySid)`
  - `src/modules/reports/CashReconciliation.tsx`
- **Test cases:**
  - ✅ `calculateExpectedCash = opening + cash sales - cash refunds`
  - ✅ `calculateExpectedCash excludes QRIS and transfer transactions`
  - ✅ `saveReconciliation appends Audit_Log entry with surplus/deficit`
  - ❌ `saveReconciliation throws if actual closing balance is negative`
- **E2E spec:** `src/tests/e2e/reports.flow.spec.ts`
  - `"owner can complete end-of-day cash reconciliation and discrepancy is logged"`

---

### T042 — PDF / Excel Export

- **Status:** ✅ done
- **Section:** Reports
- **Depends on:** T039
- **Test type:** unit
- **Architecture note:** PDF export uses `window.print()` with a print-optimized CSS stylesheet — no additional library needed. Excel export uses `SheetJS` (`xlsx` npm package) to generate an `.xlsx` file client-side and trigger a download. Both approaches run entirely in the browser with no server involvement.
- **Deliverables:**
  - `src/modules/reports/export.service.ts`:
    - `exportToExcel(reportData, filename): void` — uses SheetJS
    - `printReport(): void` — triggers `window.print()`
  - Print CSS: `src/modules/reports/reports.print.css`
- **Test cases:**
  - ✅ `exportToExcel calls SheetJS write with correct sheet data`
  - ✅ `exportToExcel triggers file download with .xlsx extension`
  - ❌ `exportToExcel throws if reportData is empty`

---

## Settings

---

### T048 — App Shell & Navigation Bar

- **Status:** ✅ done
- **Section:** Scaffold (retroactive)
- **Depends on:** T003, T014, T019
- **Test type:** unit
- **Architecture note:** The `AppShell` component is used as a **React Router v6 layout route** — a route with no `path` that renders `<NavBar>` + `<Outlet>`. This ensures the nav bar appears on every authenticated page without each page component having to import it. Public routes (`/`, `/login`, `/join`, `/setup`) sit outside the layout route and render without a nav bar. Nav links are filtered at render time by `ROLE_RANK` (same logic as `RoleRoute`) so cashiers never see manager-only links — the actual route protection is still enforced by `RoleRoute`. See TRD §2.6 for the full layout diagram.
- **Deliverables:**
  - `src/components/NavBar.tsx`:
    - `<header>` with `h-16` (4 rem) matching `CashierPage`'s `h-[calc(100vh-4rem)]`
    - Logo, role-filtered nav links with icons (lucide-react), username display, sign-out button
    - Calls `authAdapter.signOut()` + `clearAuth()` + navigates to `/` on sign-out
    - All interactive/key elements have `data-testid` per TRD §2.6 naming table
    - Responsive: labels hidden on `< sm` (460 px), username hidden on `< md` (768 px)
  - `src/components/AppShell.tsx`:
    - Renders `<NavBar />` + `<Outlet />` inside a `min-h-screen flex flex-col` container
    - `data-testid="app-shell"` on root, `data-testid="main-content"` on `<main>`
  - `src/router.tsx` updated:
    - New pathless layout route wrapping all protected pages under `<ProtectedRoute> + <AppShell>`
    - `<SetupWizard>` (`/setup`) remains outside the layout route (no nav during onboarding)
- **Test cases (`NavBar.test.tsx`):**
  - ✅ `renders logo text "POS UMKM"`
  - ✅ `owner sees all 6 nav links (Kasir, Katalog, Inventori, Pelanggan, Laporan, Pengaturan)`
  - ✅ `manager sees 5 nav links (not Pengaturan)`
  - ✅ `cashier sees only Kasir link`
  - ✅ `active route link has active styling`
  - ✅ `renders username from auth store`
  - ✅ `sign-out button calls authAdapter.signOut and clearAuth`
  - ❌ `unauthenticated user sees no nav links and no username`

---

### T043 — Business Profile & Tax Configuration

- **Status:** ✅ done
- **Section:** Settings
- **Depends on:** T015, T046
- **Test type:** unit
- **Architecture note:** Settings are stored in the `Settings` tab of the Master Sheet as key-value rows (column A: key, column B: value). This is simpler than a fixed-column schema for settings because the number of settings fields may grow. The `settings.service.ts` provides a typed `getSettings()` that reads all rows and maps them to a typed object.
- **Deliverables:**
  - `src/modules/settings/settings.service.ts`:
    - `getSettings(token, spreadsheetId): AppSettings`
    - `saveSettings(settings, token, spreadsheetId)`
  - `src/modules/settings/BusinessProfile.tsx` — name, logo URL, address, phone, timezone, PPN toggle
- **Test cases:**
  - ✅ `getSettings correctly maps all key-value rows to typed AppSettings object`
  - ✅ `saveSettings writes each changed field to correct cell`
  - ❌ `getSettings throws if Settings tab is missing (corrupted sheet)`

---

### T044 — QRIS Configuration

- **Status:** ✅ done
- **Section:** Settings
- **Depends on:** T043
- **Test type:** unit
- **Architecture note:** The QRIS QR code is a static merchant QR image. The owner uploads it to the app by pasting a public image URL (hosted on Google Drive, Imgur, etc.) or using a file input that converts the image to a data URL (stored directly in the Settings tab cell). Data URL approach avoids needing a separate file hosting service.
- **Deliverables:**
  - `src/modules/settings/QRISConfig.tsx` — URL input or file upload → preview
  - `settings.service.ts` additions:
    - `saveQRISImage(dataUrlOrUrl, token, spreadsheetId)`
    - `getQRISImage(token, spreadsheetId): string`
- **Test cases:**
  - ✅ `saveQRISImage stores data URL in Settings tab`
  - ✅ `getQRISImage returns stored value`
  - ❌ `saveQRISImage throws if value is not a valid URL or data URL`

### T049 — Migrate All UI Components to shadcn/ui

- **Status:** ✅ done
- **Section:** Scaffold (retroactive)
- **Depends on:** T002, T048
- **Test type:** none (visual/UX; functional behaviour tested by existing unit + E2E tests)
- **Architecture note:** shadcn/ui components are copied into `src/components/ui/` (not a runtime dependency) so the bundle only includes what is actually used. Tailwind CSS continues to handle all layout and spacing. The migration keeps all `data-testid` attributes intact so E2E tests require no changes. Native `<select>` is preserved for elements that Playwright's `.selectOption()` interacts with (`select-product-category`, `select-po-product-*`) — replacing those with a custom Radix-based Select would silently break E2E tests.
- **Deliverables:**
  - **13 new shadcn/ui primitives** added to `src/components/ui/`:
    `input`, `label`, `select`, `dialog`, `card`, `badge`, `table`, `tabs`, `alert`, `separator`, `scroll-area`, `textarea`, `checkbox`
  - **35 UI files updated** (all pages + all module components):
    - All custom button-tab navigation replaced with `Tabs` / `TabsList` / `TabsTrigger` / `TabsContent`
    - All hand-rolled overlay modals replaced with `Dialog` (PaymentModal, ReceiptModal, ProductSearch variant picker, PurchaseOrders detail)
    - All raw `<input>` + inline label replaced with `Input` + `Label`
    - All raw `<select>` for non-E2E selects replaced with `Select` + `SelectContent` + `SelectItem`
    - All error/success divs replaced with `Alert` / `AlertDescription`
    - Container divs with `rounded border p-4` replaced with `Card` / `CardContent`
    - All data tables replaced with `Table` / `TableHeader` / `TableBody` / `TableRow` / `TableCell`
    - Status labels replaced with `Badge`
    - NavBar logout + nav links updated to use `Button variant="ghost"/"secondary"`
    - LandingPage `asChild` type error fixed
  - **TRD.md §2.1** updated to list all 14 shadcn components; version bumped to 2.3

### T050 — Mobile-First UI (NavBar, BottomNav, CashierPage)

- **Status:** ✅ done
- **Section:** Scaffold (retroactive)
- **Depends on:** T048, T049
- **Test type:** none (layout; covered by existing 64 E2E tests at desktop viewport; no mobile-specific tests added)
- **Architecture note:** Mobile-first is enforced via Tailwind breakpoints: styles without a prefix target mobile, `md:` (768px+) overrides for tablet/desktop. E2E tests run at `Desktop Chrome` / `Desktop Firefox` (1280×720+) so all `md:hidden` / `hidden md:flex` classes are safe to add without breaking existing tests. `navigateTo()` in E2E helpers uses `history.pushState` (not nav link clicks), so duplicate `data-testid` values between NavBar and BottomNav at desktop viewport are not a concern. `min-h-0` is required on flex children that must scroll — without it, `min-height: auto` prevents overflow from working in a flex column.
- **Deliverables:**
  - `src/components/BottomNav.tsx` (new) — fixed `h-16` bottom bar; `md:hidden`; role-filtered nav items; active-route highlight; `data-testid="bottom-nav-{route}"`
  - `src/components/AppShell.tsx` updated — imports `BottomNav`; adds `pb-16 md:pb-0` to `<main>` for bottom clearance on mobile
  - `src/components/NavBar.tsx` updated — nav links wrapped in `hidden md:flex`; `flex-1` spacer on mobile; height changed to `h-14 md:h-16`
  - `src/pages/CashierPage.tsx` updated — adds `mobileView: 'products' | 'cart'` state; mobile toggle tabs (`btn-tab-products`, `btn-tab-cart`) with live item count badge; outer container changed from `h-[calc(100vh-4rem)]` to `flex flex-1 overflow-hidden flex-col md:flex-row`; cart panel adapts width from full-width on mobile to fixed `md:w-80` on desktop
  - `src/modules/cashier/ProductSearch.tsx` updated — product grid changed from `max-h-[60vh] overflow-y-auto` to `flex-1 min-h-0 overflow-y-auto content-start`; grid breakpoint changed from `sm:grid-cols-3` to `md:grid-cols-3`; wrapper uses `h-full min-h-0 flex flex-col`
  - `docs/TRD.md` §2.6 updated to document BottomNav, mobile-first CashierPage layout, `min-h-0` pattern; §2.5 updated to list `BottomNav.tsx`; version bumped to 2.4

---

## Offline-First

> All reads served from IndexedDB; writes queued in `_outbox` and replayed to Google Sheets in the background. Transparent to all module service code via the existing `ISheetRepository<T>` interface. See TRD §12.

---

### T051 — Dexie DB Schema

- **Status:** ✅ done
- **Section:** Offline-First
- **Depends on:** T045
- **Test type:** unit
- **Architecture note:** All 15 entity tables plus `_outbox` and `_syncMeta` are defined in a single `PosUmkmDatabase` Dexie class (`src/lib/adapters/dexie/db.ts`). Table names match the Google Sheets tab names exactly so `db.table(sheetName)` works at runtime via string lookup — no mapping table needed. `_outbox` is keyed on auto-increment `id` to preserve FIFO ordering. `_syncMeta` is keyed on `tableName` for O(1) staleness checks.
- **Deliverables:**
  - `src/lib/adapters/dexie/db.ts`
    - `PosUmkmDatabase extends Dexie` with all 15 entity tables + `_outbox` + `_syncMeta`
    - `OutboxEntry` type (id, spreadsheetId, sheetName, operation, payload, retries, createdAt)
    - `SyncMetaEntry` type (tableName, lastHydratedAt)
    - Singleton `db` exported
- **Test cases:**
  - ✅ `db.table() returns correct table for each known entity name`
  - ✅ `_outbox supports add and bulkGet with auto-increment id`
  - ✅ `_syncMeta supports put and get by tableName`

---

### T052 — DexieSheetRepository

- **Status:** ✅ done
- **Section:** Offline-First
- **Depends on:** T051
- **Test type:** unit
- **Architecture note:** `DexieSheetRepository<T>` implements `ISheetRepository<T>` backed by IndexedDB. Every write method runs a Dexie ACID transaction that atomically writes to the entity table **and** appends to `_outbox`. This guarantees no write is lost even if the app is closed between the local write and the Sheets sync. `batchUpsertByKey` (used only by Settings service) is decomposed at write time — it queries Dexie locally to distinguish updates vs inserts, then creates separate `batchUpdateCells` and `batchAppend` outbox entries — avoiding the need to serialize the unserializable `makeNewRow` callback. `writeHeaders` bypasses IndexedDB and calls `SheetRepository` directly because it is only called during `SetupWizard` (always online, spreadsheet just created).
- **Deliverables:**
  - `src/lib/adapters/dexie/DexieSheetRepository.ts`
    - `getAll()` — reads from Dexie, filters soft-deleted rows
    - `append(row)` — Dexie txn: entity table put + `_outbox` add
    - `batchAppend(rows)` — Dexie txn: bulkPut + single outbox entry
    - `batchUpdateCells(updates)` — Dexie txn: updates applied via key lookup + outbox entry
    - `softDelete(id)` — Dexie txn: sets `deleted_at` + outbox entry
    - `batchUpsertByKey(rows, key, makeNewRow)` — decomposes locally; no outbox closure serialization
    - `writeHeaders(headers)` — direct pass-through to `SheetRepository` (online only)
- **Test cases (using `fake-indexeddb`):**
  - ✅ `getAll returns only non-deleted rows`
  - ✅ `append adds row to entity table and creates outbox entry`
  - ✅ `batchAppend adds all rows and creates one outbox entry`
  - ✅ `batchUpdateCells updates local row and creates outbox entry`
  - ✅ `softDelete sets deleted_at and creates outbox entry`
  - ✅ `batchUpsertByKey creates append entry for new rows and update entry for existing rows`
  - ❌ `getAll returns empty array when table is empty`
  - ❌ `append throws if row has no id field`

---

### T053 — SyncManager

- **Status:** ✅ done
- **Section:** Offline-First
- **Depends on:** T051, T052
- **Test type:** unit
- **Architecture note:** `SyncManager` drains `_outbox` to Google Sheets in FIFO order. Each entry creates a fresh `SheetRepository` from the stored `spreadsheetId` and `sheetName` — this handles monthly sheet rollovers correctly (no stale spreadsheetId from a prior month cached in a long-lived object). HTTP 429 (rate limit) stops the drain loop and sets a 60-second backoff before resuming; the `SyncManager` listens for the browser `online` event to also trigger an immediate drain. `MAX_RETRIES = 5`; entries exceeding this are permanently skipped (logged to console, not surfaced to the user as they are stale). Sync state is written to `syncStore` for the `SyncStatus` UI component.
- **Deliverables:**
  - `src/lib/adapters/dexie/SyncManager.ts`
    - `start()` — begins polling (30 s interval) + registers `window.addEventListener('online', triggerSync)`
    - `triggerSync()` — immediately drains the full `_outbox`
    - `stop()` — clears interval + removes event listener
    - `applyToSheets(entry)` — creates `SheetRepository` and calls the correct method based on `entry.operation`
- **Test cases (using `fake-indexeddb` + `vi.spyOn`):**
  - ✅ `triggerSync drains all outbox entries in FIFO order`
  - ✅ `triggerSync sets isSyncing=true during drain and false after`
  - ✅ `triggerSync increments retry count on failure and keeps entry in outbox`
  - ✅ `triggerSync permanently skips entry after MAX_RETRIES`
  - ✅ `triggerSync stops drain loop and sets backoff on HTTP 429`
  - ✅ `triggerSync updates pendingCount in syncStore after each entry`
  - ❌ `triggerSync does nothing when outbox is empty`
  - ❌ `applyToSheets throws for unknown operation type`

---

### T054 — HydrationService

- **Status:** ✅ done
- **Section:** Offline-First
- **Depends on:** T051, T052
- **Test type:** unit
- **Architecture note:** `HydrationService.hydrateAll()` fetches all entity tables from Google Sheets in parallel (`Promise.allSettled`) and writes them into IndexedDB via `bulkPut`. Two skip conditions prevent unnecessary fetches and data loss: (a) table hydrated within the last 5 minutes (`_syncMeta.lastHydratedAt`) — avoids redundant Sheets API reads on rapid app restarts; (b) table has pending/unretried outbox entries — avoids overwriting local writes that have not yet been synced to Sheets. `getRawRows()` fetches including soft-deleted rows (unlike `ISheetRepository.getAll()`) to preserve the full dataset.
- **Deliverables:**
  - `src/lib/adapters/dexie/HydrationService.ts`
    - `hydrateAll(mainSpreadsheetId, masterSpreadsheetId, monthlySpreadsheetId)` — hydrates all 15 tables in parallel; records `lastHydratedAt` per table; resolves all errors individually via `allSettled`
    - `hydrateTable(spreadsheetId, sheetName)` — fetches raw rows, writes to Dexie, updates `_syncMeta`
    - Skip logic: freshness check (5 min) + pending outbox guard
- **Test cases:**
  - ✅ `hydrateAll writes all fetched rows into the correct Dexie tables`
  - ✅ `hydrateAll skips table if hydrated within last 5 minutes`
  - ✅ `hydrateAll skips table if there are pending outbox entries for that table`
  - ✅ `hydrateAll continues hydrating other tables when one table fails`
  - ❌ `hydrateTable does not overwrite existing rows when skipped`

---

### T055 — Sync Status UI & syncStore

- **Status:** ✅ done
- **Section:** Offline-First
- **Depends on:** T053, T048
- **Test type:** unit
- **Architecture note:** `syncStore` is a Zustand store (not persisted) that `SyncManager` updates during sync. It is the single source of truth for the `SyncStatus` UI component. The `SyncStatus` component is passed to `NavBar` via a `syncStatusSlot?: ReactNode` prop (slot/composition pattern) so NavBar has no knowledge of the sync system. This keeps NavBar testable without requiring a `SyncManager` mock. All labels are in Bahasa Indonesia per TRD §2.4. Click-to-retry on error/pending states calls `syncManager.triggerSync()`.
- **Deliverables:**
  - `src/store/syncStore.ts` — Zustand store: `pendingCount`, `isSyncing`, `lastSyncedAt`, `lastError`, `setSyncState()`
  - `src/components/SyncStatus.tsx` — 5 visual states: offline, syncing, error+pending, pending-only, synced
    - All interactive elements have `data-testid` per TRD §2.6 convention
    - Labels: "Offline", "Menyinkronkan…", "Gagal, ketuk untuk coba lagi", "{n} perubahan menunggu", "Tersinkronisasi"
- **Test cases:**
  - ✅ `SyncStatus shows "Tersinkronisasi" when pendingCount=0 and online`
  - ✅ `SyncStatus shows "Menyinkronkan…" spinner when isSyncing=true`
  - ✅ `SyncStatus shows pending count badge when pendingCount > 0`
  - ✅ `SyncStatus shows "Offline" indicator when navigator.onLine=false`
  - ✅ `SyncStatus calls triggerSync on click when in error state`
  - ❌ `SyncStatus renders nothing when not mounted in NavBar`

---

### T056 — Wire Offline-First into AppShell & Adapter Index

- **Status:** ✅ done
- **Section:** Offline-First
- **Depends on:** T052, T053, T054, T055
- **Test type:** none (integration wiring; covered by module unit tests + existing E2E)
- **Architecture note:** `lib/adapters/index.ts` is the single switching point — it exports `syncManager` and `hydrationService` as singletons. When `VITE_ADAPTER=mock`, both are no-op stubs so `AppShell` can call `.start()` / `.hydrateAll()` unconditionally without branching. When `VITE_ADAPTER=google`, `getRepos()` returns `DexieSheetRepository` instances via `createDexieRepos()`. `makeRepo()` continues to return a raw `SheetRepository` for setup code (SetupWizard), which is always online. `AppShell` triggers hydration inside a `useEffect` that runs only when all three spreadsheet IDs are present in `authStore`, preventing premature Sheets API calls.
- **Deliverables:**
  - `src/lib/adapters/index.ts` updated:
    - `createDexieRepos()` private helper returns `DexieSheetRepository` instances for all 15 entity tables
    - `getRepos()` uses `createDexieRepos()` for `VITE_ADAPTER=google`; `createMockRepos()` for mock
    - `syncManager` export: `SyncManager` singleton for google; no-op object for mock
    - `hydrationService` export: `HydrationService` singleton for google; no-op object for mock
  - `src/components/AppShell.tsx` updated:
    - `useEffect` calling `syncManager.start()` once on mount
    - `useEffect` calling `hydrationService.hydrateAll(mainId, masterId, monthlyId)` when all three IDs are set
    - Passes `<SyncStatus />` to `<NavBar syncStatusSlot={...} />`
  - `src/components/NavBar.tsx` updated:
    - Accepts `syncStatusSlot?: ReactNode` prop
    - Renders the slot between the centre nav links and the right user section

---

### T057 — Multi-Store Dexie Partitioning

- **Status:** ✅ done All entity tables (`Products`, `Transactions`, etc.) hold rows from whatever store was last hydrated. When a user owns multiple stores (or is a member of several), switching the active store in `authStore` leaves stale rows from the previous store in every Dexie table — module reads immediately return wrong data without any network call.

  **Root cause:** `PosUmkmDatabase` is a singleton constructed with a fixed DB name. There is no `store_id` partition in any entity table.

  **Fix — one Dexie database per store:**
  Replace the singleton `db` export with a `getDb(storeId: string): PosUmkmDatabase` factory. The factory opens an IndexedDB database named `pos_umkm_<storeId>` and caches the instance by `storeId`. On store switch, the factory returns the correct DB for the new active store. `DexieSheetRepository`, `SyncManager`, and `HydrationService` all receive the `db` instance via constructor injection so they automatically operate on the correct store-scoped database.

  Why per-DB instead of adding a `store_id` column to every entity table:
  - No schema migration needed — each new DB is created with the current version schema
  - No compound indexes required — all existing queries continue to work without a `store_id` filter clause
  - `_outbox` and `_syncMeta` are naturally scoped — entries in one store's DB cannot interfere with another store's sync
  - Clean isolation — Dexie's ACID transactions cannot span two stores even if a bug causes a mixed write

  **Store switch flow:**
  1. `authStore.setActiveStore(storeId, spreadsheetIds)` is called (already exists)
  2. `adapters/index.ts` calls `createDexieRepos(storeId)` which calls `getDb(storeId)` and re-creates all `DexieSheetRepository` instances for the new store
  3. `SyncManager` and `HydrationService` are re-created with the new `db` instance
  4. `AppShell`'s `useEffect` that watches `activeStoreId` re-triggers `hydrateAll()` for the new store

  **Old store databases are never deleted** — they remain in the browser as stale IndexedDB databases until the user clears browser storage or a future pruning task removes inactive stores (deferred post-MVP).

- **Deliverables:**
  - `src/lib/adapters/dexie/db.ts` updated:
    - Remove singleton `export const db = new PosUmkmDatabase()`
    - `PosUmkmDatabase` constructor accepts `storeId: string` and opens `pos_umkm_<storeId>`
    - `getDb(storeId: string): PosUmkmDatabase` factory with `Map<string, PosUmkmDatabase>` cache; creates a new instance if not cached
    - `clearDbCache()` helper exported for tests (resets the factory cache)
  - `src/lib/adapters/dexie/DexieSheetRepository.ts` updated:
    - Constructor signature: `constructor(db: PosUmkmDatabase, spreadsheetId: string, sheetName: string, getToken: () => string)`
    - Remove internal `import { db }` — use injected instance
  - `src/lib/adapters/dexie/SyncManager.ts` updated:
    - Constructor accepts `db: PosUmkmDatabase` instead of importing singleton
  - `src/lib/adapters/dexie/HydrationService.ts` updated:
    - Constructor accepts `db: PosUmkmDatabase` instead of importing singleton
  - `src/lib/adapters/index.ts` updated:
    - `createDexieRepos(storeId, spreadsheetIds)` calls `getDb(storeId)` and passes the instance to all Dexie constructors
    - `syncManager` and `hydrationService` singletons are re-created when `storeId` changes
  - `src/components/AppShell.tsx` updated:
    - `useEffect` watching `activeStoreId` re-initialises `syncManager` and calls `hydrateAll()` whenever the active store changes

- **Test cases (using `fake-indexeddb`):**
  - ✅ `getDb returns the same instance for the same storeId`
  - ✅ `getDb returns different instances for different storeIds`
  - ✅ `DexieSheetRepository reads only rows for the active store DB (no cross-store contamination)`
  - ✅ `switching storeId causes subsequent reads to return the new store's data`
  - ✅ `_outbox entries in store A are not drained when store B is active`
  - ✅ `_syncMeta hydration timestamps are per-store (fresh hydration for a new store)`
  - ❌ `getDb throws if storeId is empty string`
  - ❌ `DexieSheetRepository.getAll returns empty array when new store has never been hydrated`

---

### T058 — Fix Post-Hydration Stale Module State

- **Status:** ✅ done
- **Section:** Offline-First
- **Depends on:** T056
- **Test type:** unit
- **Architecture note:** Module pages (`CashierPage`, `CatalogPage`, etc.) call `loadCatalog()` / `loadInventory()` etc. in a `useEffect` on mount. These calls read from Dexie via `DexieSheetRepository.getAll()`. At mount time, hydration has not yet completed — Dexie tables are either empty (first load) or contain data from a previous session. `HydrationService.hydrateAll()` runs concurrently in a separate `AppShell` `useEffect`, completes asynchronously, and populates Dexie with fresh Sheets data. But because module effects already ran and set Zustand state, there is no signal to trigger a re-fetch. The UI shows empty/stale data until the user navigates away and back, which remounts the page and calls `loadCatalog()` again.

  **Root cause summary:**
  1. `loadCatalog()` is a one-shot pull (reads Dexie once, sets Zustand) — there is no push notification when Dexie changes
  2. `hydrateAll()` is fire-and-forget from `AppShell` — its completion is invisible to page components

  **Fix — hydration signal via Zustand:**
  Extend `syncStore` with a `lastHydratedAt: number | null` field. `HydrationService.hydrateAll()` calls `setSyncState({ lastHydratedAt: Date.now() })` when all tables have been processed. Page-level `useEffect`s that call `loadCatalog()` etc. add `lastHydratedAt` from `syncStore` to their dependency array. When hydration completes, `lastHydratedAt` changes → effects re-run → modules re-read from (now-populated) Dexie.

  Why this over `dexie-react-hooks` / `useLiveQuery`: the `useLiveQuery` approach requires replacing every Zustand-based module store with a reactive hook pattern — a large-scope refactor touching every page and module service. The signal approach achieves the same result for the login use case (one re-fetch per hydration cycle) with changes limited to `syncStore`, `HydrationService`, and the affected page components. `useLiveQuery` remains a future improvement (T060).

  **Scope of affected pages** (all pages that load data in a `useEffect` on mount):
  - `CashierPage` — `loadCatalog()`
  - `CatalogPage` — `loadCatalog()`
  - `InventoryPage` / `StockOpname` / `PurchaseOrders` — `loadInventory()`
  - `CustomersPage` — `loadCustomers()`
  - `ReportsPage` — `loadReports()`
  - `SettingsPage` — `loadSettings()`

- **Deliverables:**
  - `src/store/syncStore.ts` updated:
    - Add `lastHydratedAt: number | null` field (initial value `null`)
    - `setSyncState` already accepts a partial update — no signature change needed
  - `src/lib/adapters/dexie/HydrationService.ts` updated:
    - After `Promise.allSettled` resolves in `hydrateAll()`, call `useSyncStore.getState().setSyncState({ lastHydratedAt: Date.now() })`
  - All page components listed above updated:
    - Import `useSyncStore` and destructure `lastHydratedAt`
    - Add `lastHydratedAt` to the `useEffect` dependency array for the data-load effect
- **Test cases:**
  - ✅ `hydrateAll calls setSyncState with lastHydratedAt after completion`
  - ✅ `hydrateAll updates lastHydratedAt even when some tables fail (allSettled)`
  - ✅ `page re-calls loadCatalog when lastHydratedAt changes`
  - ❌ `page does not call loadCatalog twice on initial mount when lastHydratedAt is null`

---

### T059 — Fix `_syncMeta` Key Not Scoped by SpreadsheetId

- **Status:** ✅ done
- **Section:** Offline-First
- **Depends on:** T056
- **Test type:** unit
- **Architecture note:** `HydrationService.hydrateTable()` reads and writes `_syncMeta` using the key `${sheetName}_hydrated` (e.g. `Products_hydrated`). This key is not scoped to any particular spreadsheet. In a single-DB Dexie setup (current state before T057), a user who manages two stores (e.g. Store A with `masterSid=sid_A` and Store B with `masterSid=sid_B`) will see this sequence:

  1. Login → Store A activated → `hydrateAll(mainId, sid_A, monthId_A)` → `Products` hydrated → `_syncMeta` key `Products_hydrated` written with timestamp T1
  2. Switch to Store B → `hydrateAll(mainId, sid_B, monthId_B)` → hydration checks `_syncMeta.get('Products_hydrated')` → T1 is less than 5 minutes ago → **skip** → Store B's Products are never fetched → Dexie still has Store A's products

  The fix: include `spreadsheetId` in the `_syncMeta` key: `${spreadsheetId}_${sheetName}` (e.g. `sid_A_Products`, `sid_B_Products`). This allows independent freshness tracking per store per table.

  This is a stopgap fix that works within the single-DB design. T057 (per-store Dexie DB) will fully isolate `_syncMeta` once implemented; at that point, the key can revert to `${sheetName}` because each DB is already store-scoped. For now, this fix prevents data from the wrong store being silently served after a store switch.

  **Monthly sheet tables** (`Transactions`, `Transaction_Items`, `Refunds`) use `monthlySpreadsheetId` which changes every calendar month. A month-rollover also creates a new spreadsheetId, so scoping by `spreadsheetId` naturally forces a re-hydration for the new monthly sheet without any extra logic.

  **Side effect — stale `_syncMeta` entries accumulate:** old keys like `old_sid_Products` are never cleaned up. This is acceptable until T057 replaces the single DB with per-store DBs (at which point the entire `_syncMeta` table is per-store and stale entries are impossible).

- **Deliverables:**
  - `src/lib/adapters/dexie/HydrationService.ts` updated:
    - `hydrateTable()`: change `const metaKey = \`${sheetName}_hydrated\`` to `const metaKey = \`${spreadsheetId}_${sheetName}\``
    - `forceHydrate()`: pass `spreadsheetId` into the internal call so the correct key is cleared
- **Test cases:**
  - ✅ `hydrateTable writes _syncMeta key scoped to spreadsheetId`
  - ✅ `switching to a different spreadsheetId for the same sheetName triggers a fresh hydration`
  - ✅ `same spreadsheetId + sheetName within staleness window is still skipped`
  - ✅ `month rollover (new monthlySpreadsheetId) triggers re-hydration of Transactions`
  - ❌ `stale key from previous spreadsheetId does not block hydration for new spreadsheetId`

---

## Store Management

> Allows an owner to add new stores, edit existing ones, and remove stores. Removing a store the user **owns** soft-deletes it from the `Stores` sheet (data preserved, store becomes invisible to all members). Removing a store the user **does not own** removes only the user's own row from that store's `Members` sheet (peer-revoke access).

---

### T060 — Store Management Service

- **Status:** ✅ done
- **Section:** Store Management
- **Depends on:** T019, T056
- **Test type:** unit
- **Architecture note:** All store-management mutations go through the existing `ISheetRepository<T>` / Dexie adapter stack — no raw Sheets API calls from the service. `createStore` reuses the existing `SetupService.initMasterSheet()` helper to provision a new master spreadsheet (categories, products, members sheets) and then appends the resulting store row to the user's `Stores` tab on their main spreadsheet. `removeOwnedStore` performs a soft-delete (`deleted_at` timestamp) on the store's row in the `Stores` tab rather than a hard delete, so transaction history is preserved. `removeAccessToStore` locates the caller's own row in the target store's `Members` sheet (matched by Google user `email` from `useAuthStore`) and soft-deletes it; it never touches the `Stores` tab of a sheet the caller does not own. The service never alters another user's main spreadsheet.
- **Deliverables:**
  - `src/modules/settings/store-management.service.ts` (new)
    - `listStores()` → `IStore[]` — reads `Stores` tab from `mainSpreadsheetId`; excludes rows with `deleted_at` set
    - `createStore(name: string)` → `IStore` — provisions a new master spreadsheet via `SetupService.initMasterSheet()`; appends the new store row to the `Stores` tab; returns the created store
    - `updateStore(storeId: string, patch: Partial<Pick<IStore, 'store_name'>>)` → `void` — `batchUpdateCells` on the matching row in `Stores`
    - `removeOwnedStore(storeId: string)` → `void` — soft-deletes the store row in the user's `Stores` tab (`deleted_at = now`)
    - `removeAccessToStore(storeId: string)` → `void` — locates the caller's row in `${masterSpreadsheetId}/Members` by `email`; soft-deletes it
- **Test cases:**
  - ✅ `listStores returns all non-deleted stores`
  - ✅ `listStores excludes stores with deleted_at set`
  - ✅ `createStore appends a new row and returns the store with a uuid`
  - ✅ `updateStore calls batchUpdateCells with the patched fields`
  - ✅ `removeOwnedStore soft-deletes the matching row in Stores tab`
  - ✅ `removeAccessToStore soft-deletes caller's row in target store's Members tab`
  - ❌ `removeOwnedStore throws if storeId does not exist`
  - ❌ `removeAccessToStore throws if caller is not a member of the store`
  - ❌ `createStore propagates error when initMasterSheet fails`

---

### T061 — Store Management Page

- **Status:** ✅ done
- **Section:** Store Management
- **Depends on:** T060
- **Test type:** unit + e2e
- **Architecture note:** The page is mounted at `/settings/stores` and accessible from the Settings tabs. Ownership is determined by comparing `store.owner_email` (a field in the `Stores` tab) against the signed-in user's email from `useAuthStore`. Owned stores show an **Edit** action and a **Hapus** (delete) action; non-owned stores show only a **Keluar** (leave) action. Both destructive actions open a confirmation `Dialog` before proceeding to prevent accidental data loss. After a successful `createStore` or `removeOwnedStore`, the active store is re-selected to the first remaining store (if the deleted store was the active one); if no stores remain, the user is redirected to the setup wizard. `removeAccessToStore` always redirects to the setup wizard because the user no longer has access to any store in the list.
- **Deliverables:**
  - `src/pages/StoreManagementPage.tsx` (new)
    - Store list rendered as a `Table` (shadcn); each row shows store name, owner, and action buttons
    - **Tambah Toko** button (top-right) opens a `Dialog` with a store-name `Input` and a **Simpan** button; `data-testid="btn-add-store"`, `data-testid="input-store-name"`, `data-testid="btn-save-store"`
    - **Edit** action opens an edit `Dialog` pre-filled with current store name; `data-testid="btn-edit-store-{storeId}"`, `data-testid="btn-save-store-edit"`
    - **Hapus** action (owned stores) opens a confirmation `Dialog`; `data-testid="btn-delete-store-{storeId}"`, `data-testid="btn-confirm-delete-store"`
    - **Keluar** action (non-owned stores) opens a confirmation `Dialog`; `data-testid="btn-leave-store-{storeId}"`, `data-testid="btn-confirm-leave-store"`
    - Inline `Alert` for errors; `data-testid="alert-store-error"`
    - Loading state while async calls are in flight
  - `src/modules/settings/SettingsPage.tsx` updated — add **Toko** tab linking to `StoreManagementPage`; or integrate as a new `TabsTrigger` if Settings uses a tab layout
  - Route added to `src/router/index.tsx` at `/settings/stores`
- **Test cases (unit):**
  - ✅ `renders store list with names and correct action buttons per ownership`
  - ✅ `Add dialog submits createStore and refreshes list`
  - ✅ `Edit dialog pre-fills store name and submits updateStore`
  - ✅ `Delete confirmation calls removeOwnedStore and removes row from list`
  - ✅ `Leave confirmation calls removeAccessToStore`
  - ❌ `shows error Alert when createStore fails`
  - ❌ `shows error Alert when removeOwnedStore fails`
  - ❌ `does not show Delete button for non-owned stores`
  - ❌ `does not show Leave button for owned stores`
- **E2E spec:** `e2e/store-management.spec.ts`
  - `owner can add a new store`
  - `owner can edit store name`
  - `owner can delete owned store`
  - `member can leave a non-owned store`
  - `error is shown when store name is empty`

---

### T062 — Fix NavBar Store Picker After Add/Edit + Switch Button

- **Status:** ✅ done
- **Section:** Store Management
- **Depends on:** T061
- **Test type:** unit
- **Architecture note:** `useAuthStore.stores` is the source of truth for the NavBar store picker (`showStorePicker = stores.length >= 2`). `StoreManagementPage` maintained its own local `stores` state and only synced `authStore.stores` on delete — not on add or edit. This caused two bugs: (1) the NavBar store picker did not appear after a second store was added; (2) editing a store name did not update the NavBar's `<option>` labels. Fix: after every successful mutation (`createStore`, `updateStore`) call `useAuthStore.getState().setStores(updatedList, currentActiveStoreId)` so the NavBar re-renders with the correct list. Add an **Aktifkan** button per row (shown only for non-active owned stores) that calls `activateStore(store)` + `setStores(currentList, store.store_id)` so the owner can switch the active store directly from the management page without returning to the store picker.
- **Deliverables:**
  - `src/pages/StoreManagementPage.tsx` updated:
    - `handleAdd`: after successful `createStore`, call `useAuthStore.getState().setStores(updatedList, activeStoreId)` before clearing dialog
    - `handleEdit`: after successful `updateStore`, call `setStores(updatedList, activeStoreId)` with refreshed list
    - **Aktifkan** button per row: shown when `store.store_id !== activeStoreId`; calls `activateStore(store)` + `setStores(stores, store.store_id)`; `data-testid="btn-activate-store-{storeId}"`; not shown for the currently active store
- **Test cases:**
  - ✅ `authStore.stores is updated after createStore succeeds`
  - ✅ `authStore.stores is updated with new name after updateStore succeeds`
  - ✅ `Aktifkan button is shown for non-active stores`
  - ❌ `Aktifkan button is not shown for the currently active store`
  - ✅ `clicking Aktifkan calls activateStore and setStores with the selected store`

---

### T063 — Remove spreadsheetId & monthlySpreadsheetId from Zustand Persistence

- **Status:** ⬜ todo
- **Section:** Store Management
- **Depends on:** T062
- **Test type:** unit

**Problem**: `spreadsheetId` (master sheet ID) and `monthlySpreadsheetId` are persisted in Zustand / localStorage alongside `stores` and `activeStoreId`. This causes two classes of bugs:
1. On page refresh, the persisted `spreadsheetId` / `monthlySpreadsheetId` may belong to a different store than `activeStoreId` if a store switch was interrupted.
2. The `txSheet_YYYY-MM` localStorage cache key is not scoped per store, so switching stores can write the wrong monthly ID into the cache.

**Proposed approach**:
- Remove `spreadsheetId` and `monthlySpreadsheetId` from `partialize` in `authStore.ts` (stop persisting them).
- Add a derived getter `getActiveSpreadsheetId()` that computes `stores.find(s => s.store_id === activeStoreId)?.master_spreadsheet_id ?? null` instead of reading from Zustand state.
- Keep `monthlySpreadsheetId` in Zustand in-memory state (not persisted); on refresh, call `activateStore(activeStore)` in `AppShell` (or `AuthInitializer`) to re-derive it.
- Scope `txSheet_YYYY-MM` per store: key becomes `txSheet_<storeId>_YYYY-MM` so switching stores never overwrites another store's cached ID.
- Audit all callers of `spreadsheetId` and `monthlySpreadsheetId` from Zustand and replace with the derived getter or re-activate on refresh.

**Architecture note**: This is a correctness improvement. The root cause of T063 was exposed by a race condition fix in `activateStore` (T062 + cross-store contamination fix). Deriving `spreadsheetId` from `stores[activeStoreId]` is the single-source-of-truth pattern; it cannot go stale.

**Test cases**:
- ✅ `getActiveSpreadsheetId() returns master_spreadsheet_id of the active store`
- ✅ `getActiveSpreadsheetId() returns null when activeStoreId is null`
- ✅ `spreadsheetId is not written to localStorage after store switch`
- ✅ `monthlySpreadsheetId is not read from localStorage on refresh (re-derived via activateStore)`
- ✅ `txSheet key is scoped per store (txSheet_<storeId>_YYYY-MM)`
- ❌ `stale spreadsheetId in localStorage does not bleed into new store session`

---

### T064 — Navigate to /:storeId/cashier on NavBar Store Switch

- **Status:** ✅ done
- **Section:** Store Management
- **Depends on:** T062
- **Test type:** unit

**Problem (resolved)**: Route migration to `/:storeId` requires that switching stores updates the URL to include the new store's ID. Without this, the URL becomes stale and deep-linking breaks.

**Implemented fix**: `NavBar.handleStoreChange()` calls `navigate(`/${storeId}/cashier`)` after `activateStore()` and `setStoreSession()` complete. AppShell reads `useParams<{ storeId }>()` and calls `setActiveStoreId` whenever the URL `:storeId` differs from Zustand state, making the URL the authoritative source for the active store.

**Test cases**:
- ✅ `switching store via NavBar calls activateStore and setStoreSession`
- ✅ `switching store navigates to /:storeId/cashier for the new store`
- ❌ `selecting the already-active store does nothing`

---

## State Management

### T065 — Install and Configure React Query

- **Status:** ✅ done
- **Section:** State Management
- **Depends on:** T001
- **Test type:** none

**Goal**: Add `@tanstack/react-query` as the data-fetching and caching layer. All server/Dexie data reads (stores list, catalog, transactions, etc.) will move to React Query hooks. Zustand (`authStore`) retains session state only (`user`, `role`, `isAuthenticated`, `activeStoreId`, spreadsheet IDs).

**Steps**:
1. `npm install @tanstack/react-query`
2. Create `QueryClient` in `src/lib/queryClient.ts` with sensible defaults (`staleTime: 30_000`, `retry: 1`).
3. Wrap `<App />` with `<QueryClientProvider client={queryClient}>` in `main.tsx`.
4. Add `queryClient.clear()` call in `NavBar.handleSignOut` (after `clearAuth()`) so cache is wiped on logout.

**Architecture note**: React Query is the UI cache sitting above the service layer. Services call `getRepos()` (Dexie offline, Google Sheets online). React Query caches results and revalidates on demand. This decouples pages from manual cache-sync and eliminates the class of bugs caused by pages forgetting to call `setStores` / `setProducts` after mutations.

---

### T066 — Migrate Stores State to React Query

- **Status:** ✅ done
- **Section:** State Management
- **Depends on:** T065, T064
- **Test type:** unit

**Goal**: Remove `stores: StoreRecord[]` from `authStore`. All components that need the stores list read from React Query instead of Zustand. This eliminates the manual `setStores` sync that caused the NavBar refresh bugs (T062, T063).

**Changes**:

1. **`authStore`**: remove `stores`, `setStores`; rename to `setActiveStoreId(id)` (was part of `setStores`). Keep `activeStoreId`. Update `clearAuth` to clear `activeStoreId`.

2. **`src/hooks/useStores.ts`** (new):
   ```ts
   export function useStores() {
     return useQuery({ queryKey: ['stores'], queryFn: listStores, staleTime: 30_000 })
   }
   ```

3. **`NavBar`**: replace `stores` from `useAuthStore()` with `useStores().data ?? []`.

4. **`StorePickerPage`**: replace `localStores` + `resolveStores` with `useStores()`; after `findOrCreateMain()` succeeds, call `queryClient.setQueryData(['stores'], list)` to seed the cache; remove `setStores(list, null)` calls.

5. **`StoreManagementPage`**: replace `loadStores()` + local `stores` state with `useStores()`; replace all `useAuthStore.getState().setStores(...)` with `queryClient.invalidateQueries({ queryKey: ['stores'] })`; replace `handleActivate` mutation with `useMutation`.

6. **`AppShell`** / anywhere that reads `stores` from authStore: update to `useStores()`.

**Architecture note**: `activeStoreId` stays in `authStore` (it's session state, not fetched data). `stores` is fetched data — it belongs in React Query. After a mutation (add/rename/remove/leave store), `invalidateQueries(['stores'])` causes every subscriber (NavBar, StoreManagementPage, StorePickerPage) to automatically refetch and re-render. No manual sync required.

**Test cases**:
- ✅ `useStores returns store list from listStores service`
- ✅ `NavBar store picker shows when useStores returns 2+ stores`
- ✅ `addStore mutation invalidates ['stores'] query causing refetch`
- ✅ `updateStore mutation invalidates ['stores'] query`
- ✅ `removeStore mutation invalidates ['stores'] query`
- ✅ `logout clears React Query cache (stores not visible after re-login as different user)`
- ❌ `stores from previous user session not shown after cache clear`

---

### T067 — Migrate Catalog Data to React Query

- **Status:** ✅ done
- **Section:** State Management
- **Depends on:** T066
- **Test type:** unit

**Goal**: Replace `useCatalogStore` (Zustand) with React Query hooks for categories, products, and variants. Eliminates manual `loadCatalog()` calls and `lastHydratedAt` re-load triggers in `CatalogPage` and `CashierPage`.

**Changes**:

1. **`src/hooks/useCategories.ts`** — `useQuery(['categories', activeStoreId], fetchCategories)`
2. **`src/hooks/useProducts.ts`** — `useQuery(['products', activeStoreId], fetchProducts)`
3. **`src/hooks/useVariants.ts`** — `useQuery(['variants', activeStoreId], fetchVariants)`
4. **`CategoryList.tsx`** — replace `useCatalogStore()` with `useCategories()`; mutations call service + `invalidateQueries(['categories', activeStoreId])`
5. **`ProductList.tsx`** — replace `useCatalogStore()` with `useProducts()` + `useCategories()`; mutations call service + `invalidateQueries(['products', activeStoreId])`
6. **`VariantManager.tsx`** — replace `useCatalogStore()` with `useVariants()`; mutations call service + `invalidateQueries(['variants', activeStoreId])`
7. **`CatalogPage.tsx`** — remove `loadCatalog()` call; remove `lastHydratedAt` effect; loading state comes from `useProducts().isLoading`
8. **`CashierPage.tsx`** — replace `useCatalogStore()` with `useProducts()` + `useVariants()`; remove `loadCatalog()` and `lastHydratedAt` effect
9. **`useCatalog.ts`** — delete (no longer used)

**Architecture note**: Query keys include `activeStoreId` so switching stores auto-invalidates catalog cache. `invalidateQueries` after mutations triggers all subscribers to refetch simultaneously — no optimistic update bookkeeping needed.

**Test cases**:
- ✅ `CategoryList renders categories from useCategories hook`
- ✅ `addCategory mutation calls service and triggers refetch`
- ✅ `deleteCategory mutation calls service and triggers refetch`
- ✅ `ProductList renders products from useProducts hook`
- ✅ `CashierPage passes products/variants from React Query to ProductSearch`
- ❌ `CategoryList shows error when fetchCategories fails`

---

### T068 — Migrate Settings Data to React Query

- **Status:** ✅ done
- **Section:** State Management
- **Depends on:** T066
- **Test type:** unit

**Goal**: Replace manual `useState/useEffect/lastHydratedAt` patterns in `BusinessProfile`, `MemberManagement`, and `QRISConfig` with React Query hooks.

**Changes**:

1. **`src/hooks/useSettings.ts`** — `useQuery(['settings', activeStoreId], getSettings)`
2. **`src/hooks/useMembers.ts`** — `useQuery(['members', activeStoreId], listMembers)`
3. **`BusinessProfile.tsx`** — replace `useState/useEffect/lastHydratedAt` with `useSettings()`; on submit call `saveSettings` + `invalidateQueries(['settings', activeStoreId])`
4. **`MemberManagement.tsx`** — replace `useState/useEffect/lastHydratedAt` with `useMembers()`; `inviteMember`/`revokeMember` use `useMutation` + `invalidateQueries(['members', activeStoreId])`
5. **`QRISConfig.tsx`** — replace `useState/useEffect/lastHydratedAt` with `useQuery(['qris', activeStoreId], getQRISImage)`; save uses `useMutation`

**Test cases**:
- ✅ `BusinessProfile renders settings from useSettings hook`
- ✅ `save settings mutation calls service and invalidates settings query`
- ✅ `MemberManagement renders member list from useMembers hook`
- ✅ `invite member mutation calls service and refetches members`
- ✅ `revoke member mutation calls service and refetches members`
- ❌ `BusinessProfile shows error when getSettings fails`

---

### T069 — Migrate Inventory Data to React Query

- **Status:** ✅ done
- **Section:** State Management
- **Depends on:** T066
- **Test type:** unit

**Goal**: Replace manual `useState/useEffect/lastHydratedAt` in `StockOpname` and `PurchaseOrders` with React Query hooks.

**Changes**:

1. **`src/hooks/useStockOpname.ts`** — `useQuery(['stock-opname', activeStoreId], fetchStockOpnameData)`
2. **`src/hooks/usePurchaseOrders.ts`** — `useQuery(['purchase-orders', activeStoreId], fetchPurchaseOrders)`
3. **`StockOpname.tsx`** — replace manual load/state with `useStockOpname()`; after save, `invalidateQueries(['stock-opname', activeStoreId])`
4. **`PurchaseOrders.tsx`** — replace manual load/state with `usePurchaseOrders()` + `useProducts()`; mutations invalidate relevant queries

**Test cases**:
- ✅ `StockOpname renders rows from useStockOpname hook`
- ✅ `save opname invalidates stock-opname query triggering refetch`
- ✅ `PurchaseOrders renders orders from usePurchaseOrders hook`
- ❌ `StockOpname shows error when fetchStockOpnameData fails`

---

### T070 — Migrate Customers Data to React Query

- **Status:** ✅ done
- **Section:** State Management
- **Depends on:** T066
- **Test type:** unit

**Goal**: Replace manual `useState/useEffect/lastHydratedAt` in `CustomerSearch` with a React Query hook.

**Changes**:

1. **`src/hooks/useCustomers.ts`** — `useQuery(['customers', activeStoreId], fetchCustomers)`
2. **`CustomerSearch.tsx`** — replace `useState/useEffect/lastHydratedAt` with `useCustomers()`; component must be wrapped in `QueryClientProvider` by its parent (already done via `main.tsx`)

**Test cases**:
- ✅ `CustomerSearch renders customers from useCustomers hook`
- ✅ `filtering customers narrows list by name/phone`
- ❌ `CustomerSearch shows loading state while fetching`

---

### T071 — Migrate Reports to React Query; Remove lastHydratedAt

- **Status:** ✅ done
- **Section:** State Management
- **Depends on:** T066
- **Test type:** unit

**Goal**: Replace `DailySummary`'s manual load pattern with React Query (`useQuery` with `enabled: false` + manual `refetch()` on button press). Remove stale `lastHydratedAt` references from `SalesReport`, `GrossProfitReport`, and `CashReconciliation`.

**Changes**:

1. **`DailySummary.tsx`** — `useQuery(['daily-summary', activeStoreId, date], () => fetchDailySummary(date), { enabled: false })`; button calls `refetch()`; remove `lastHydratedAt` effect
2. **`SalesReport.tsx`** — remove `useSyncStore`/`lastHydratedAt` import if any (it had none); verify clean
3. **`GrossProfitReport.tsx`** — same check
4. **`CashReconciliation.tsx`** — same check

**Test cases**:
- ✅ `DailySummary fetches when button is clicked`
- ✅ `DailySummary refetches when date changes and button clicked again`
- ❌ `DailySummary shows error when fetchDailySummary fails`

---

### T072 — Invalidate React Query Cache After Hydration

- **Status:** ✅ done
- **Section:** State Management
- **Depends on:** T067, T068, T069, T070, T071
- **Test type:** unit

**Goal**: After `HydrationService.hydrateAll()` completes in `AppShell`, call `queryClient.invalidateQueries()` so all active React Query hooks refetch from freshly-populated IndexedDB. This replaces the `lastHydratedAt` pattern that each component previously had to subscribe to individually.

**Changes**:

1. **`AppShell.tsx`** — after `await hydrationService.hydrateAll(...)`, call `queryClient.invalidateQueries()` (no filter — refetch all active queries for the current store)
2. Remove all remaining `useSyncStore` / `lastHydratedAt` usage from component files (confirmed clean after T067–T071)

**Architecture note**: Instead of each component watching `lastHydratedAt` to trigger a re-load, a single invalidation at the AppShell level notifies React Query to refetch all active queries. Components no longer need to know about hydration at all.

**Test cases**:
- ✅ `AppShell calls queryClient.invalidateQueries after hydrateAll resolves`
- ✅ `components using useQuery refetch after invalidation (integration)`

---

## Section: Store Isolation Fixes

### T073 — Scope monthlySheetKey to storeId

- **Status:** ✅ done
- **Section:** Store Isolation Fixes
- **Depends on:** T072
- **Test type:** unit

**Goal**: `monthlySheetKey()` currently returns `txSheet_YYYY-MM` — the same localStorage key for every store. When two stores exist, activating Store 2 overwrites Store 1's monthly spreadsheet ID. On the next login `LoginPage` reads the wrong ID and transaction writes go to the wrong sheet.

**Changes**:

1. **`setup.service.ts`** — add `storeId` parameter to `monthlySheetKey(storeId, year, month)` → key becomes `txSheet_<storeId>_YYYY-MM`
2. Update all callers of `monthlySheetKey` (two write sites in `activateStore`, one in `ensureMonthlySheet`)
3. **`clearSetupStorage()`** — update to clear `txSheet_<storeId>_*` keys; also clear legacy `txSheet_YYYY-MM` keys for backward compat
4. **`LoginPage.tsx`** — update fast-path monthly ID restore to use store-scoped key (read `activeStoreId` from authStore)

**Architecture note**: Each store can have a different active monthly sheet. Sharing a single key caused last-writer-wins corruption when switching between stores.

**Test cases**:
- ✅ `monthlySheetKey returns txSheet_<storeId>_YYYY-MM`
- ✅ `activateStore stores monthlyId under store-scoped key`
- ✅ `activating store2 does not overwrite store1 monthly key`
- ❌ `monthlySheetKey without storeId is rejected by TypeScript`

---

### T074 — Prevent stale hydrateAll from invalidating wrong store cache

- **Status:** ✅ done
- **Section:** Store Isolation Fixes
- **Depends on:** T072
- **Test type:** unit

**Goal**: `hydrateAll()` is async (5–30 seconds). If the user switches stores before it completes, the old in-flight Promise will call `queryClient.invalidateQueries()` after the new store is already active — causing a spurious full cache invalidation at the wrong time, potentially triggering unnecessary refetches with wrong context.

**Changes**:

1. **`AppShell.tsx`** — add a generation counter ref (`hydrateGenRef`). Increment on every store switch. After `hydrateAll()` resolves, only call `invalidateQueries()` if the generation still matches.
2. Add scoped `invalidateQueries` predicate — only invalidate queries whose key[1] matches `activeStoreId` (avoids nuking unrelated caches such as `['stores']`).

**Architecture note**: This is a defensive guard. Without it, a slow hydration for Store A can trigger a cache-bust while the user is already viewing Store B, causing all of Store B's active queries to re-fetch unexpectedly.

**Test cases**:
- ✅ `invalidateQueries is NOT called if store switches before hydrateAll resolves`
- ✅ `invalidateQueries IS called when generation matches after hydrateAll`
- ✅ `invalidateQueries predicate scopes invalidation to activeStoreId`

---

### T075 — Clear dbCache on logout

- **Status:** ✅ done
- **Section:** Store Isolation Fixes
- **Depends on:** T073, T074
- **Test type:** unit

**Goal**: The module-level `dbCache` Map in `db.ts` accumulates one `PosUmkmDatabase` instance per visited store and never frees them. After logout, stale IndexedDB connections remain open. If a second user logs in on the same tab with a colliding `storeId` (unlikely with UUIDs, but possible in dev/test), they could access the previous user's cached DB.

**Changes**:

1. **`db.ts`** — export `clearDbCache()` (already exists); document it as the logout hook
2. **`authStore.ts`** — call `clearDbCache()` inside `clearAuth()` before the `set(...)` call
3. **`adapters/index.ts`** — after `clearDbCache()`, reset `syncManager` and `hydrationService` to their no-op defaults so stale references don't hold live DB connections

**Architecture note**: DB connections and their associated memory (metadata, event listeners) should be released when the user logs out. This also ensures a fresh login always hydrates from a clean slate rather than a potentially-stale cache.

**Test cases**:
- ✅ `clearAuth calls clearDbCache`
- ✅ `getDb returns fresh instance after clearDbCache`
- ✅ `syncManager is reset to no-op after clearDbCache on logout`

---

### T076 — Scope invalidateQueries predicate to activeStoreId

- **Status:** ✅ done
- **Section:** Store Isolation Fixes
- **Depends on:** T074
- **Test type:** unit

**Goal**: `queryClient.invalidateQueries()` with no filter nukes every query in the cache — including `['stores']`, `['daily-summary', storeId, date]` with `enabled:false`, and any future global queries. After hydration we only need to re-fetch the active store's data.

**Changes**:

1. **`AppShell.tsx`** — replace bare `queryClient.invalidateQueries()` with a predicate that matches `queryKey[1] === activeStoreId`
2. Queries whose key does not include `storeId` at position 1 (e.g. `['stores']`) are explicitly excluded — they have their own invalidation on mutation

**Architecture note**: The scoped predicate is safer and faster. It prevents cache-busting unrelated queries and avoids re-fetching `['stores']` on every hydration cycle.

**Test cases**:
- ✅ `invalidateQueries only targets keys matching activeStoreId`
- ✅ `['stores'] query is NOT invalidated by hydration`
- ✅ `['categories', activeStoreId] IS invalidated by hydration`

---

### T077 — Optimize batchUpsertByKey with indexed lookup

- **Status:** ✅ done
- **Section:** Store Isolation Fixes
- **Depends on:** T075
- **Test type:** unit

**Goal**: `DexieSheetRepository.batchUpsertByKey()` calls `toArray()` to load the full table into memory before processing entries. For large tables (Products with thousands of rows) this creates memory spikes and slow updates.

**Changes**:

1. **`DexieSheetRepository.ts`** — rewrite `batchUpsertByKey` to query each lookup individually using `this.db.table(sheetName).where(lookupColumn).equals(lookupValue).first()` instead of loading all rows
2. Wrap all individual queries in `Promise.all` for parallel execution
3. Keep the same outbox behavior (batch the resulting updates/appends)

**Architecture note**: Dexie indexes allow O(log n) lookups by indexed column. The `Settings` table is indexed on `key`; `Members` on `email`. Using `.where().equals()` avoids full table scans.

**Test cases**:
- ✅ `batchUpsertByKey updates existing row found by indexed lookup`
- ✅ `batchUpsertByKey inserts new row when lookupValue not found`
- ✅ `batchUpsertByKey does not call toArray()`
- ❌ `batchUpsertByKey with empty entries is a no-op`

---

## Testing Overhaul

### T078 — Remove VITE_ADAPTER / mock adapter layer

- **Status:** ✅ done
- **Section:** Testing Overhaul
- **Depends on:** T077
- **Test type:** none (cleanup)

**Goal**: Since the app is offline-first (Dexie is the read/write layer), the `MockSheetRepository` / `MockDataAdapter` / `MockAuthAdapter` adapter family is no longer needed for testing. All tests can use the real Dexie layer backed by `fake-indexeddb`.

**Changes**:
1. Delete `src/lib/adapters/MockSheetRepository.ts`
2. Delete `src/lib/adapters/mock/` directory (MockAuthAdapter, seed.ts)
3. Remove `MockDriveClient` from `src/lib/adapters/DriveClient.ts`
4. Remove `createMockRepos` and `createGoogleRepos` from `src/lib/adapters/repos.ts` (keep `Repos` interface only)
5. Remove `VITE_ADAPTER` conditional from `src/lib/adapters/index.ts` — always use `GoogleAuthAdapter`, `GoogleDriveClient`, `SyncManager`, `DexieSheetRepository`
6. Remove `IS_MOCK` from `src/components/AuthInitializer.tsx` (simplify to google-only flow)
7. Remove `VITE_ADAPTER !== 'google'` check from `src/components/SyncStatus.tsx`
8. Remove mock-mode comments from `src/modules/auth/LoginPage.tsx` and `AuthProvider.tsx`
9. Add `import 'fake-indexeddb/auto'` to `src/test-setup.ts` so jsdom unit tests work when `adapters/index.ts` constructs a Dexie instance

**Architecture note**: `VITE_ADAPTER=mock` was needed when tests hit real or mocked network APIs. Offline-first removes that requirement — IndexedDB (fake or real) is the boundary that needs seeding, not a network mock.

**Test cases**:
- ✅ All 352 existing unit tests pass after mock adapter removal
- ✅ `adapters/index.ts` imports succeed in jsdom test environment (fake-indexeddb)

---

### T079 — Integration test helper: renderWithDexie

- **Status:** ✅ done
- **Section:** Testing Overhaul
- **Depends on:** T078
- **Test type:** unit

**Goal**: Provide a reusable `renderWithDexie` helper that wraps a component in the full provider stack (QueryClientProvider + MemoryRouter + Zustand auth) with a real Dexie DB backed by `fake-indexeddb`. Tests seed tables directly and assert against real service → Dexie → React Query → UI behavior without mocking the service layer.

**Changes**:
1. Create `src/test-utils/dexie-test-utils.ts` with `renderWithDexie(ui, { storeId, user, seed, initialPath })` — seeds the Dexie DB, sets Zustand auth state, wraps in providers
2. Create `src/pages/CashierPage.integration.test.tsx` as proof-of-concept — seeds Products + Categories in Dexie, renders CashierPage, asserts products are shown and a transaction can be completed

**Architecture note**: `fake-indexeddb/auto` is a full in-process IndexedDB implementation compatible with Dexie. No network calls happen — reads come from Dexie, writes go to Dexie outbox (SyncManager not started). This tests the React Query → hook → service → DexieSheetRepository → UI path end-to-end without mocks.

**Test cases** (in CashierPage.integration.test.tsx):
- ✅ `products seeded in Dexie are shown in the product search panel`
- ✅ `clicking a product card adds it to the cart and updates the total`
- ✅ `completing a QRIS payment writes a transaction row to Dexie and shows receipt`
- ❌ `cart is empty when no products match the search query`

---

### T080 — E2E Playwright Dexie fixture

- **Status:** ✅ done
- **Section:** Testing Overhaul
- **Depends on:** T078
- **Test type:** e2e

**Goal**: Replace the `VITE_ADAPTER=mock` E2E setup (localStorage-backed MockDataAdapter) with a Dexie-backed setup. Auth is injected via localStorage (GoogleAuthAdapter.restoreSession() reads `gsi_*` keys), data is seeded into real IndexedDB via `window.__getDb`, and Google API calls are route-stubbed.

**Changes**:
1. Add `window.__getDb = getDb` exposure in `src/lib/adapters/dexie/db.ts` when `import.meta.env.VITE_E2E === 'true'`
2. Create `src/tests/e2e/helpers/route-stubs.ts` — `stubGoogleApis(page)` stubs all `googleapis.com` and `accounts.google.com` routes with `200 {}`
3. Create `src/tests/e2e/helpers/auth-dexie.ts` — `injectAuthState(page, storeConfig)` uses `page.addInitScript` to write `gsi_access_token`, `gsi_token_expiry`, user profile, and the Zustand `pos-umkm-auth` persist key into localStorage before page load; `signInAsDexie(page, storeConfig)` calls `injectAuthState` then `page.goto(BASE + '/cashier')` and waits for the product search input
4. Create `src/tests/e2e/helpers/dexie-seed.ts` — `seedDexie(page, storeId, tables)` calls `window.__getDb(storeId).TableName.bulkPut(rows)` via `page.evaluate()`; `reloadAndWait(page, testId)` reloads the page and waits for a given testId to be visible
5. Update `playwright.config.ts`: remove `VITE_ADAPTER: 'mock'`, add `VITE_E2E: 'true'`
6. Rewrite `src/tests/e2e/helpers/auth.ts` to be a thin re-export of the Dexie helpers (or delete and update imports)
7. Rewrite all five E2E spec files to use the new helpers — auth injection + Dexie seeding replaces localStorage mock seeding + mock sign-in click

**Architecture note**: `page.addInitScript()` runs before any page JS, so Zustand rehydrates with the injected auth state on first render. `window.__getDb` is set by `db.ts` during app initialization (guarded by `VITE_E2E`). Route stubs prevent real Google API calls in CI without network credentials.

**E2E spec files**:
- `src/tests/e2e/smoke.spec.ts` — trivial, no change needed
- `src/tests/e2e/cashier.flow.spec.ts` — replace `mock_Products`/`mock_Categories` seeding + `signInAsOwner` with `seedDexie` + `signInAsDexie`
- `src/tests/e2e/inventory.flow.spec.ts` — same pattern
- `src/tests/e2e/reports.flow.spec.ts` — same pattern
- `src/tests/e2e/members.flow.spec.ts` — same pattern
- `src/tests/e2e/store-management.spec.ts` — same pattern

### T081 — Fix remaining E2E test failures (36/36)

- **Status:** ✅ done
- **Section:** Testing Overhaul
- **Depends on:** T080
- **Test type:** e2e

**Goal**: Bring the full E2E suite from 32/36 to 36/36 by fixing three independent root causes.

**Root causes fixed**:

1. **Store management tests (3 failures) — locator ambiguity + Drive stub**
   - `getByText('Toko Utama')` resolved to 2 elements: the navbar store-switcher `<option>` AND the table `<td>`. Fixed by using `getByRole('cell', { name: '...' })` in all three assertions (add/edit/delete).
   - `page.route('**googleapis.com/drive/v3/files**')` returned `{ id: '...' }` for ALL Drive calls including GET search queries. `ensureDriveFolderUnder` calls `searchData.files.length` which threw `TypeError: Cannot read properties of undefined (reading 'length')`. Fixed by dispatching on `request.method()` and URL: GET+`?q=` → `{ files: [] }`; GET+`?fields=parents` → `{ parents: ['root'] }`; POST/PATCH → `{ id: 'new-folder-id' }`.
   - Similarly updated the `**googleapis.com/v4/spreadsheets**` stub to return `{ spreadsheetId: '...' }` only for `POST /v4/spreadsheets` (create) and `{}` for all other methods (batchUpdate, values.append, etc.)

2. **Reports "filter by date range" test (1 failure) — flaky test stabilised**
   - Root cause was a pre-existing Dexie-layer migration bug: `listStores()` was using `makeRepo` (Sheets API) instead of `getRepos().stores` (Dexie), and `HydrationService` was silently dropping all `Stores` rows because their `id` column was missing (fixed in sessions preceding T081). After those fixes the test became deterministic and passed consistently.

**Test files changed**:
- `src/tests/e2e/store-management.spec.ts` — Drive stub split by method; locators changed to `getByRole('cell', ...)`

---

### T082 — Refactor DexieSheetRepository → DexieRepository; introduce ILocalRepository

- **Status:** ✅ done
- **Section:** Architecture Cleanup
- **Depends on:** T081
- **Test type:** unit

**Goal**: Fix the semantic mismatch where `DexieSheetRepository` implements `ISheetRepository` — Dexie is a browser database, not a sheet. Introduce a clean `ILocalRepository<T>` interface that feature modules use, with method names that describe local data operations, not Google Sheets API calls. `ISheetRepository<T>` is narrowed to the sync layer only.

**Changes**:

1. **New `ILocalRepository<T>` interface** (inline in `repos.ts` or new `src/lib/adapters/ILocalRepository.ts`):
   ```ts
   interface ILocalRepository<T> {
     getAll(): Promise<T[]>
     batchInsert(rows): Promise<void>       // was batchAppend
     batchUpdate(updates): Promise<void>    // was batchUpdateCells
     batchUpsertBy(...): Promise<void>      // was batchUpsertByKey
     softDelete(id): Promise<void>
   }
   ```
   No `writeHeaders` — that is a remote/setup operation only.

2. **Rename `DexieSheetRepository` → `DexieRepository`**:
   - File: `dexie/DexieSheetRepository.ts` → `dexie/DexieRepository.ts`
   - `implements ILocalRepository<T>` (not `ISheetRepository<T>`)
   - Constructor: replace `spreadsheetId: string, sheetName: string` with `syncTarget: SyncTarget`
     where `SyncTarget = { spreadsheetId: string; sheetName: string }` (routing hint for outbox only)
   - Rename methods: `batchAppend` → `batchInsert`, `batchUpdateCells` → `batchUpdate`, `batchUpsertByKey` → `batchUpsertBy`

3. **Rename test file**: `DexieSheetRepository.test.ts` → `DexieRepository.test.ts`; update all method refs

4. **Update `repos.ts`**: change field types from `ISheetRepository<T>` → `ILocalRepository<T>`

5. **Update `adapters/index.ts`**:
   - Import `DexieRepository` (not `DexieSheetRepository`)
   - `dexie()` helper constructs `DexieRepository` with `{ spreadsheetId, sheetName }` as `syncTarget`
   - `localCachePut` helper uses `batchInsert` internally
   - `getMembersForStore` uses `batchInsert` internally

6. **Update all call sites** (feature service/component files) — mechanical rename:
   - `getRepos().*.batchAppend(...)` → `batchInsert`
   - `getRepos().*.batchUpdateCells(...)` → `batchUpdate`
   - `getRepos().*.batchUpsertByKey(...)` → `batchUpsertBy`
   - `softDelete` and `getAll` unchanged
   - **Note**: `makeRepo(...)` calls (`batchAppend`, `batchUpdateCells`, `writeHeaders`) are left unchanged — `makeRepo()` still returns `ISheetRepository<T>`

7. **`ISheetRepository<T>` stays unchanged** — keeps `batchAppend`, `batchUpdateCells`, `batchUpsertByKey`, `writeHeaders`. Used only by `SheetRepository`, `SyncManager`, `HydrationService`, and `makeRepo()`.

**Files affected**:
- `src/lib/adapters/dexie/DexieSheetRepository.ts` → renamed + refactored
- `src/lib/adapters/dexie/DexieSheetRepository.test.ts` → renamed + updated
- `src/lib/adapters/repos.ts`
- `src/lib/adapters/index.ts`
- `src/test-utils/dexie-test-utils.tsx`
- `src/modules/auth/setup.service.ts` (only `getRepos()` calls, not `makeRepo()` calls)
- `src/modules/auth/SetupWizard.tsx`
- `src/modules/cashier/cashier.service.ts`
- `src/modules/catalog/catalog.service.ts`
- `src/modules/catalog/csv.service.ts`
- `src/modules/customers/customers.service.ts`
- `src/modules/customers/refund.service.ts`
- `src/modules/inventory/inventory.service.ts`
- `src/modules/reports/reports.service.ts`
- `src/modules/settings/members.service.ts`
- `src/modules/settings/settings.service.ts`
- `src/modules/settings/store-management.service.ts`
- `src/modules/auth/pin.service.ts`

**Architecture note**: `DexieRepository` is not "a Sheet" — it is a browser IndexedDB table that syncs to a sheet. The `syncTarget` field names (`spreadsheetId`, `sheetName`) are routing metadata for the outbox, not identity claims. Feature modules never see them. The `ISheetRepository` interface with Sheets API naming (`batchAppend`, `writeHeaders`) is now fully isolated behind the sync boundary.

**Test cases**:
- ✅ `batchInsert writes rows to IndexedDB and enqueues outbox entry`
- ✅ `batchUpdate patches column on existing row and enqueues outbox entry`
- ✅ `batchUpsertBy inserts new row when key not found`
- ✅ `batchUpsertBy updates existing row when key found`
- ✅ `softDelete stamps deleted_at and enqueues outbox entry`
- ✅ `getAll filters soft-deleted rows`
- ❌ `batchUpdate silently skips rowId not found in IndexedDB`

---

## Appendix: Parallelization Map

The following tasks within each section have no mutual dependencies and can be worked on by different agents simultaneously:

| Section | Can run in parallel |
|---|---|
| Scaffold | T001 first, then T002–T009 + T048 + T049 + T050 all in parallel (T048/T049/T050 depend on T003) |
| Core Library | T010, T011, T012, T013 in parallel; then T045 (interface); then T046, T047 in parallel |
| Authentication | T014 first; then T015 → T016 → T017 → T018 → T019 → T020 (mostly sequential) |
| Catalog–Settings | All five sections can start once Authentication is done; they are independent of each other |
| Catalog | T021 first, then T022–T024 in parallel; T023 and T024 depend on T022 |
| Cashier | T025 first; then T026, T027, T028, T029, T031 in parallel; T030 depends on T027+T028; T032 depends on T027+T022+T016; T033 depends on T032 |
| Inventory | T034, T035 in parallel |
| Customers | T036 first, then T037 |
| Reports | T038 first; T039 depends on T038; T040 depends on T039; T041, T042 depend on T039 |
| Settings | T043 first; T044 depends on T043 |
| Offline-First | T051 first; then T052, T054 in parallel; T053 depends on T052; T055 depends on T053; T056 depends on T052+T053+T054+T055; T057 depends on T056; T058 and T059 depend on T056 (can run in parallel with each other and with T057) |
| Store Management | T060 first (service), then T061 (UI), then T062 (NavBar sync + switch button), then T063 (remove stale spreadsheet IDs from persistence); T064 (no /cashier redirect) can run in parallel with T063 |
| State Management | T065 first (install React Query), then T066 (migrate stores); then T067–T071 in parallel (all depend on T066); then T072 (depends on T067–T071) |
| Store Isolation Fixes | T073 and T074 in parallel (both depend on T072); T075 depends on T073+T074; T076 depends on T074; T077 depends on T075 |
| Testing Overhaul | T078 first (remove mock adapter); T079 and T080 in parallel (both depend on T078) |

---

*End of Document — POS UMKM TASKS.md*
