# POS UMKM — AI Agent Task Document

> This document is the single source of truth for implementation tasks.
> It is designed to be executed by one or more AI coding agents working in parallel.

## How to Use This Document

- **Status values:** `todo` | `in-progress` | `done` | `blocked`
- **Parallelism:** Tasks within the same phase that share no `depends_on` overlap can be worked on simultaneously by different agents.
- **TDD rule:** Write the failing test(s) first, then implement, then refactor. Mark status `in-progress` before starting, `done` after all tests pass.
- **Architecture rule:** After completing each task, verify no module imports another module's internals. All data reads/writes go through `lib/adapters/` (the `DataAdapter` interface) — never call `lib/sheets/` or Google APIs directly from modules. `lib/sheets/` is used only inside `GoogleDataAdapter`.
- **Comments rule:** Every non-trivial function must have a JSDoc comment explaining *why* the approach was chosen, not just what it does.
- **E2E locator rule:** Every interactive element and key output element that an E2E test touches **must** have a `data-testid` attribute. E2E tests must use `page.getByTestId()` as the primary selector. `getByRole`, `getByText`, `getByPlaceholder`, and `.first()` / `.last()` are not permitted as primary locators in assertions or interactions — only for page-level navigation waits. See TRD §7.4 for the full rule and naming convention.

## Status Legend

| Symbol | Meaning |
|---|---|
| ⬜ | todo |
| 🔄 | in-progress |
| ✅ | done |
| 🚫 | blocked |

---

## Phase 0 — Project Scaffold

> No test cases required for scaffold tasks. Goal: a running, correctly configured dev environment.

---

### T001 — Initialize Vite + React + TypeScript Project

- **Status:** ✅ done
- **Phase:** 0 – Scaffold
- **Depends on:** (none)
- **Test type:** none
- **Architecture note:** Vite chosen over CRA because it is significantly faster (native ESM, no bundling in dev) and has first-class TypeScript support without ejection. The static output (`dist/`) is what gets deployed to GitHub Pages.
- **Deliverables:**
  - `package.json` with correct scripts: `dev`, `build`, `preview`, `test`, `test:e2e`
  - `tsconfig.json` with strict mode enabled
  - `vite.config.ts` with base path set for GitHub Pages deployment (`base: '/pos-umkm/'`)
  - `.gitignore` covering `node_modules`, `dist`, `.env*`
  - `README.md` with setup instructions

---

### T002 — Configure Tailwind CSS + shadcn/ui

- **Status:** ✅ done
- **Phase:** 0 – Scaffold
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
- **Phase:** 0 – Scaffold
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
- **Phase:** 0 – Scaffold
- **Depends on:** T001
- **Test type:** none
- **Architecture note:** Zustand chosen over Redux Toolkit because it has no boilerplate, no Provider wrapping needed, and stores are independently importable — which aligns with the modular architecture (each module owns its Zustand slice). Redux was considered but rejected for MVP due to verbosity.
- **Deliverables:**
  - `src/store/` directory with a placeholder `authStore.ts` demonstrating the pattern
  - Example: `useAuthStore` with `user`, `role`, `spreadsheetId` fields

---

### T005 — Set Up Vitest + Testing Library

- **Status:** ✅ done
- **Phase:** 0 – Scaffold
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
- **Phase:** 0 – Scaffold
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
- **Phase:** 0 – Scaffold
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
- **Phase:** 0 – Scaffold
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
- **Phase:** 0 – Scaffold
- **Depends on:** T001
- **Test type:** none
- **Architecture note:** The folder structure enforces the modular boundary at the filesystem level. Each module folder is self-contained. An ESLint rule (`import/no-internal-modules`) should be configured to prevent cross-module internal imports at lint time, catching violations before code review.
- **Deliverables:**
  - Create all module folders with `index.ts` barrel files:
    `src/modules/{auth,catalog,cashier,inventory,customers,reports,settings}/`
  - `src/lib/{sheets,formatters.ts,validators.ts,uuid.ts}`
  - `src/tests/e2e/` with spec file stubs
  - ESLint configured with `@typescript-eslint` + `import` plugin
  - `.eslintrc.ts` rule: warn on cross-module internal imports

---

## Phase 1 — Core Library

> Pure utility functions and the Sheets API client. No UI. All must have unit tests.

---

### T010 — Google Sheets API Client (`lib/sheets/`)

- **Status:** ✅ done
- **Phase:** 1 – Core Lib
- **Depends on:** T009
- **Test type:** unit (MSW mocks)
- **Architecture note:** Low-level HTTP transport for Google Sheets API v4. Used exclusively inside `GoogleDataAdapter` (T047). No module or service file calls this directly. Isolated here so: (1) retry/backoff logic lives in one place; (2) MSW mocking surface is minimal; (3) swapping to a different HTTP client later only touches this file.
- **Deliverables:**
  - `src/lib/sheets/sheets.client.ts`:
    - `sheetsGet(spreadsheetId, range, token)` → parsed row arrays
    - `sheetsAppend(spreadsheetId, range, rows, token)` → appended range response
    - `sheetsUpdate(spreadsheetId, range, values, token)` → updated range response
    - `sheetsBatchGet(spreadsheetId, ranges, token)` → multiple ranges in one API call
    - Automatic retry with exponential backoff on HTTP 429 (rate limit)
  - `src/lib/sheets/sheets.types.ts`: TypeScript types for all API shapes
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
- **Phase:** 1 – Core Lib
- **Depends on:** T009
- **Test type:** none (interface definitions only)
- **Architecture note:** Defining the interface before any implementation enforces the contract that both Mock and Google adapters must satisfy. All module service files import from `lib/adapters/` only — never from `lib/sheets/` directly. This is the single point where the data contract is specified. TypeScript's structural typing will catch any adapter that diverges from the interface at compile time.
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
- **Phase:** 1 – Core Lib
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
- **Phase:** 1 – Core Lib
- **Depends on:** T045, T010
- **Test type:** unit (MSW mocks)
- **Architecture note:** `GoogleDataAdapter` wraps `lib/sheets/sheets.client.ts` and translates the generic `DataAdapter` interface into concrete Sheets API calls. All Google-specific concerns live here: spreadsheetId management, tab naming conventions, row-to-object mapping, and header row handling. `GoogleAuthAdapter` wraps `@react-oauth/google`. By keeping all Google-specific code inside these two files, future migration to a different backend only requires replacing these adapters — zero changes to feature modules.
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
- **Phase:** 1 – Core Lib
- **Depends on:** T009
- **Test type:** unit
- **Architecture note:** `crypto.randomUUID()` is used because it is natively available in all supported browsers (Chrome 92+, Firefox 95+, Safari 15.4+). A thin wrapper is created so tests can mock it.
- **Test cases (`uuid.test.ts`):**
  - ✅ `generateId returns a valid UUID v4 format string`
  - ✅ `two calls return different values`

---

### T012 — IDR Formatter & Date Utilities (`lib/formatters.ts`)

- **Status:** ✅ done
- **Phase:** 1 – Core Lib
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
- **Phase:** 1 – Core Lib
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

## Phase 2 — Authentication

---

### T014 — Google Identity Services (GIS) Integration

- **Status:** ✅ done
- **Phase:** 2 – Auth
- **Depends on:** T045, T046
- **Test type:** unit
- **Architecture note:** `@react-oauth/google` is used as a thin React wrapper around GIS. The access token is stored in the Zustand `authStore` in memory only — never in `localStorage` or cookies. This prevents XSS token theft. Token refresh is triggered silently by GIS when the token nears expiry; the store is updated via the `onSuccess` callback.
- **Deliverables:**
  - `src/modules/auth/AuthProvider.tsx` — wraps app with `GoogleOAuthProvider`
  - `src/modules/auth/useAuth.ts` — Zustand store: `{ user, role, accessToken, spreadsheetId, isAuthenticated }`
  - `src/modules/auth/LoginPage.tsx` — "Sign in with Google" button
  - `src/modules/auth/ProtectedRoute.tsx` — redirects unauthenticated users to `/`
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
- **Phase:** 2 – Auth
- **Depends on:** T014, T046, T011
- **Test type:** unit
- **Architecture note:** The Drive API `files.create` call (to create the spreadsheet) uses the `drive.file` scope, which is only requested for the owner on first setup. Subsequent logins (and all member logins) only need the `spreadsheets` scope — narrower and less alarming in the OAuth consent screen. The `spreadsheetId` is saved to `localStorage` (not sensitive — it's a public file identifier, like a filename).
- **Deliverables:**
  - `src/modules/auth/setup.service.ts`:
    - `createMasterSpreadsheet(businessName, token)` → returns `spreadsheetId`
    - `initializeMasterSheets(spreadsheetId, token)` → creates all tab headers (Settings, Users, Categories, Products, Variants, Customers, Purchase_Orders, Purchase_Order_Items, Stock_Log, Audit_Log)
    - `saveSpreadsheetId(spreadsheetId)` → writes to `localStorage`
  - `src/modules/auth/SetupWizard.tsx` — onboarding form: business name, timezone, PPN toggle
- **Test cases (`setup.service.test.ts`):**
  - ✅ `createMasterSpreadsheet calls Drive API with correct body`
  - ✅ `createMasterSpreadsheet returns spreadsheetId from response`
  - ✅ `initializeMasterSheets creates all 10 required tabs`
  - ✅ `initializeMasterSheets writes frozen header row 1 on each tab`
  - ✅ `saveSpreadsheetId writes to localStorage key "masterSpreadsheetId"`
  - ❌ `createMasterSpreadsheet throws SetupError on Drive API failure`
  - ❌ `initializeMasterSheets throws if spreadsheetId is invalid`

---

### T016 — Monthly Transaction Spreadsheet Management

- **Status:** ✅ done
- **Phase:** 2 – Auth
- **Depends on:** T015, T046
- **Test type:** unit
- **Architecture note:** A new monthly spreadsheet is created on the first transaction of each new calendar month (lazy creation). This avoids needing a scheduled job (which would require a backend). The `spreadsheetId` for the current month is stored in `localStorage` keyed by `"txSheet_YYYY-MM"`. On app load, the auth flow checks if the current month's sheet exists; if not, it is created during the first transaction (not on login, to avoid unnecessary Drive API calls for owners who don't transact every day).
- **Deliverables:**
  - `src/modules/auth/setup.service.ts` (additions):
    - `getCurrentMonthSheetId(): string | null` — reads from `localStorage`
    - `createMonthlySheet(year, month, token, masterSpreadsheetId)` → `spreadsheetId`
    - `initializeMonthlySheets(spreadsheetId, token)` → creates Transactions, Transaction_Items, Refunds tabs
    - `shareSheetWithAllMembers(spreadsheetId, token, masterSpreadsheetId)` — reads Users tab, shares with each member
- **Test cases (`setup.service.test.ts` additions):**
  - ✅ `getCurrentMonthSheetId returns null when localStorage is empty`
  - ✅ `getCurrentMonthSheetId returns stored id for current month key`
  - ✅ `createMonthlySheet names spreadsheet "POS UMKM — Transactions — YYYY-MM"`
  - ✅ `initializeMonthlySheets creates Transactions, Transaction_Items, Refunds tabs`
  - ✅ `shareSheetWithAllMembers reads Users tab and calls Drive API share for each active member`
  - ❌ `createMonthlySheet throws on Drive API error`

---

### T017 — Member Invite Flow

- **Status:** ✅ done
- **Phase:** 2 – Auth
- **Depends on:** T015, T046, T012
- **Test type:** unit + e2e
- **Architecture note:** Inviting a member requires two actions: (1) share the Master Sheet via Drive API, (2) append a row to the `Users` tab. The Store Link is a URL containing the `spreadsheetId` encoded in a query param. The owner never needs to share a password — the link is the invite mechanism. The invited user must still authenticate with Google (they need to have a Google account).
- **Deliverables:**
  - `src/modules/settings/members.service.ts`:
    - `inviteMember(email, role, token, masterSpreadsheetId)` — shares sheet + appends to Users tab
    - `generateStoreLink(spreadsheetId): string` — returns `https://<domain>/join?sid=<spreadsheetId>`
    - `revokeMember(userId, token, masterSpreadsheetId)` — sets `deleted_at` in Users tab (soft delete); does not unshare Drive (must be done manually)
    - `listMembers(token, masterSpreadsheetId): User[]`
  - `src/modules/settings/MemberManagement.tsx` — UI for invite + list + revoke
- **Test cases (`members.service.test.ts`):**
  - ✅ `inviteMember appends correct row to Users tab with role and invited_at`
  - ✅ `inviteMember calls Drive API share with editor permission`
  - ✅ `generateStoreLink includes spreadsheetId as ?sid= query param`
  - ✅ `revokeMember sets deleted_at on correct Users row`
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
- **Phase:** 2 – Auth
- **Depends on:** T017, T014
- **Test type:** unit + e2e
- **Architecture note:** When a member opens a Store Link (`/join?sid=<id>`), the app extracts the `spreadsheetId` and stores it in `localStorage` before prompting Google Login. Members only request the `spreadsheets` scope (not `drive.file`) because they access a sheet shared with them — they don't need to create files. Their role is resolved by reading the `Users` tab and matching by email.
- **Deliverables:**
  - `src/modules/auth/JoinPage.tsx` — reads `?sid` param, stores it, shows Google Login
  - `src/modules/auth/auth.service.ts`:
    - `resolveUserRole(email, token, masterSpreadsheetId): Role` — reads Users tab
    - `isFirstTimeOwner(masterSpreadsheetId): boolean` — checks if Users tab is empty
- **Test cases (`auth.service.test.ts`):**
  - ✅ `resolveUserRole returns "cashier" for a known member email`
  - ✅ `resolveUserRole returns "owner" for the store owner email`
  - ✅ `isFirstTimeOwner returns true when Users tab has no rows`
  - ❌ `resolveUserRole throws UnauthorizedError if email not in Users tab`
  - ❌ `resolveUserRole throws if member has been revoked (deleted_at set)`
- **E2E spec:** `src/tests/e2e/members.flow.spec.ts`
  - `"member can join store via Store Link and is assigned correct role"`
  - `"cashier role cannot access /reports (redirected to /cashier)"`

---

### T019 — Role-Based Route Protection

- **Status:** ✅ done
- **Phase:** 2 – Auth
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
- **Phase:** 2 – Auth
- **Depends on:** T018, T012
- **Test type:** unit + e2e
- **Architecture note:** The PIN is hashed with bcrypt (via `bcryptjs`, a pure JS implementation — no native dependency required in browser) before being stored in the `Users` sheet. PIN validation happens entirely in the browser using `bcryptjs.compare()`. No network call is needed for unlock. The idle timer uses `setTimeout` reset on any user interaction event (`mousemove`, `keydown`, `touchstart`).
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

## Phase 3 — Product Catalog

> Phases 3–7 can be parallelized once Phase 2 is done. Each module is independent.

---

### T021 — Categories CRUD

- **Status:** ✅ done
- **Phase:** 3 – Catalog
- **Depends on:** T015, T046, T011, T012
- **Test type:** unit + e2e
- **Architecture note:** Categories are stored in the `Categories` tab of the Master Sheet. They are fetched once on app load and cached in a Zustand `catalogStore`. All writes go through `catalog.service.ts` → `lib/sheets/`. Soft deletes are used: setting `deleted_at` instead of removing the row, to preserve referential integrity (Products that reference a deleted category still display correctly).
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
- **Phase:** 3 – Catalog
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
- **Phase:** 3 – Catalog
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
- **Phase:** 3 – Catalog
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

## Phase 4 — Cashier

---

### T025 — Cart State Management

- **Status:** ✅ done
- **Phase:** 4 – Cashier
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
- **Phase:** 4 – Cashier
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
- **Phase:** 4 – Cashier
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
- **Phase:** 4 – Cashier
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
- **Phase:** 4 – Cashier
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
- **Phase:** 4 – Cashier
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
- **Phase:** 4 – Cashier
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
- **Phase:** 4 – Cashier
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
- **Phase:** 4 – Cashier
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

## Phase 5 — Inventory

---

### T034 — Stock Opname

- **Status:** ✅ done
- **Phase:** 5 – Inventory
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
- **Phase:** 5 – Inventory
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

## Phase 6 — Customers

---

### T036 — Customer Management

- **Status:** ⬜ todo
- **Phase:** 6 – Customers
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

- **Status:** ⬜ todo
- **Phase:** 6 – Customers
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

## Phase 7 — Reports

---

### T038 — Daily Sales Summary

- **Status:** ⬜ todo
- **Phase:** 7 – Reports
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

- **Status:** ⬜ todo
- **Phase:** 7 – Reports
- **Depends on:** T038
- **Test type:** unit + e2e
- **Architecture note:** For date ranges spanning multiple months, the service fetches each relevant Monthly Sheet sequentially (not in parallel, to stay within API rate limits). Results are merged and aggregated client-side. The UI allows filtering by cashier (user email), category, and payment method.
- **Deliverables:**
  - `src/modules/reports/reports.service.ts` (additions):
    - `fetchTransactionsForRange(startDate, endDate, token, localStorage): Transaction[]`
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

- **Status:** ⬜ todo
- **Phase:** 7 – Reports
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

- **Status:** ⬜ todo
- **Phase:** 7 – Reports
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

- **Status:** ⬜ todo
- **Phase:** 7 – Reports
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

## Phase 8 — Settings

---

### T043 — Business Profile & Tax Configuration

- **Status:** ✅ done
- **Phase:** 8 – Settings
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
- **Phase:** 8 – Settings
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

---

## Appendix: Parallelization Map

The following tasks within each phase have no mutual dependencies and can be worked on by different agents simultaneously:

| Can run in parallel | Tasks |
|---|---|
| Phase 0 | T001 first, then T002–T009 all in parallel |
| Phase 1 | T010, T011, T012, T013 in parallel; then T045 (interface); then T046, T047 in parallel |
| Phase 2 | T014 first; then T015 → T016 → T017 → T018 → T019 → T020 (mostly sequential) |
| Phase 3–7 | All phases can start once Phase 2 is done; phases are independent of each other |
| Within Phase 3 | T021 first, then T022–T024 in parallel; T023 and T024 depend on T022 |
| Within Phase 4 | T025 first; then T026, T027, T028, T029, T031 in parallel; T030 depends on T027+T028; T032 depends on T027+T022+T016; T033 depends on T032 |
| Within Phase 5 | T034, T035 in parallel |
| Within Phase 6 | T036 first, then T037 |
| Within Phase 7 | T038 first; T039 depends on T038; T040 depends on T039; T041, T042 depend on T039 |
| Within Phase 8 | T043 first; T044 depends on T043 |

---

*End of Document — POS UMKM TASKS.md*
