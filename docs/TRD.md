# Technical Requirements Document (TRD)
# POS UMKM — Point of Sale for Indonesian Small Businesses

| Field       | Detail                            |
|-------------|-----------------------------------|
| Version     | 2.12                              |
| Status      | Draft                             |
| Date        | April 2026                        |
| Related     | docs/PRD.md (Product Requirements)     |

---

## Table of Contents

1. [Platform & Architecture](#1-platform--architecture)
2. [Frontend](#2-frontend)
3. [Authentication — Google Login](#3-authentication--google-login)
4. [Data Layer — Google Sheets](#4-data-layer--google-sheets)
5. [Entity Relationship Diagram](#5-entity-relationship-diagram)
6. [Data Security](#6-data-security)
7. [Testing Strategy](#7-testing-strategy)
8. [Browser & Device Compatibility](#8-browser--device-compatibility)
9. [Peripheral Integration](#9-peripheral-integration)
10. [Hosting & Infrastructure](#10-hosting--infrastructure)
11. [Data Capacity & API Quotas](#11-data-capacity--api-quotas)
12. [Offline Mode](#12-offline-mode)
13. [Glossary](#13-glossary)

---

## 1. Platform & Architecture

### 1.1 Application Type

POS UMKM MVP is a **static Single-Page Application (SPA)** — a purely client-side web app with no custom backend server. All business logic runs in the browser. Data is stored in the owner's Google Drive via Google Sheets.

**Why this approach:**
- Zero server hosting costs — the app is 100% free to run
- Each business owner's data lives in their own Google account — no shared infrastructure
- Google handles data storage, replication, and availability

### 1.2 High-Level Architecture

```
┌──────────────────────────────────────────────────────┐
│                  User's Browser                       │
│                                                       │
│   ┌─────────────────────────────────────────────┐    │
│   │          React SPA (static files)            │    │
│   │  ┌─────────────┐   ┌─────────────────────┐  │    │
│   │  │  Google GIS  │   │  Sheets API v4      │  │    │
│   │  │  (Auth SDK)  │   │  + Drive API v3     │  │    │
│   │  └──────┬───────┘   └──────────┬──────────┘  │    │
│   └─────────┼──────────────────────┼─────────────┘    │
└─────────────┼──────────────────────┼──────────────────┘
              │ OAuth 2.0            │ HTTPS + OAuth token
 ┌────────────▼──────────────────────▼──────────────────┐
 │                   Google Cloud                        │
 │   ┌──────────────────┐   ┌──────────────────────┐    │
 │   │  Google Identity  │   │  Google Drive        │    │
 │   │  Services (auth)  │   │  (owner's account)   │    │
 │   └──────────────────┘   │  apps/pos_umkm/       │    │
 │                           │  ├── main [sheet]     │    │
 │                           │  └── stores/          │    │
 │                           │      └── <store_id>/  │    │
 │                           │          ├── master   │    │
 │                           │          └── trans-   │    │
 │                           │              actions/ │    │
 │                           └──────────────────────┘    │
 └───────────────────────────────────────────────────────┘

Static files hosted on: GitHub Pages / Netlify / Vercel (free tier)
```

### 1.3 Data Ownership & Sharing

Each business owner's data lives in **their own Google Drive** organized under `apps/pos_umkm/` (see §4.2). The owner can own multiple stores (branches), each with its own folder and spreadsheets. Staff members are invited by sharing the entire store folder — all files inside (master sheet, current and future monthly sheets) become accessible immediately. The app never stores user data on its own servers.

### 1.4 MVP Constraints

| Constraint | Detail |
|---|---|
| Online required for first load | On the very first load (fresh browser, no IndexedDB data) the app must be online to hydrate from Google Sheets |
| Online required to sync writes | Writes queued in the outbox are replayed to Google Sheets as soon as connectivity is restored; data is not permanently lost but is not shared with other devices until then |
| Single cashier recommended | No atomic writes to Google Sheets; concurrent multi-device writes risk stock count discrepancies (acceptable for single-cashier UMKM — see §12.5) |
| Google account required | Every user (owner, family members, cashiers) must have a Google account |
| API rate limits | Throughput capped by Google Sheets API quotas (see §11); offline-first reduces read quota usage significantly |

---

## 2. Frontend

### 2.1 Tech Stack

| Component | Technology |
|---|---|
| Framework | React 18 (with TypeScript) |
| Build tool | Vite |
| Routing | React Router v6 |
| State management | Zustand (session state only: auth, activeStoreId, spreadsheet IDs) |
| Data fetching & caching | `@tanstack/react-query` — all server/Dexie data reads go through `useQuery` hooks in `src/hooks/`; mutations call service + `invalidateQueries` |
| UI components | Tailwind CSS + shadcn/ui (Button, Input, Label, Select, Dialog, Card, Badge, Table, Tabs, Alert, Separator, ScrollArea, Textarea, Checkbox) |
| Auth adapter (dev) | `MockAuthAdapter` — instant sign-in, no OAuth (dev only) |
| Auth adapter (prod) | `@react-oauth/google` (Google Identity Services) |
| Local data store | `DexieRepository` — IndexedDB-first reads, outbox-queued writes to Google Sheets |
| Offline storage | `dexie` (IndexedDB wrapper) — all entity tables + `_outbox` + `_syncMeta` |
| i18n | `react-i18next` |
| Unit testing | Vitest + `@testing-library/react` |
| E2E testing | Playwright |
| Linting & formatting | Biome |
| Hosting | GitHub Pages (via GitHub Actions) or Netlify/Vercel free tier |

### 2.2 Offline-First via Dexie.js (IndexedDB)

The production data layer uses **Dexie.js** as a local-first IndexedDB cache in front of Google Sheets. All reads are served instantly from IndexedDB. Writes go to IndexedDB first (immediately visible in the UI) then are queued in an `_outbox` table and replayed to Google Sheets in the background when online.

This means the app works fully offline after the initial data hydration. There are no service workers or PWA manifests — offline capability comes entirely from the data layer, not the network layer. The app shell (HTML/JS/CSS) itself still requires a network request to load on a fresh browser (unless cached by the browser's standard HTTP cache).

See §12 for the full offline-first architecture.

### 2.3 Responsive Breakpoints

| Breakpoint | Range | Primary Use |
|---|---|---|
| Mobile | 360px – 767px | Owner management, light cashiering |
| Tablet | 768px – 1023px | Primary cashiering terminal |
| Desktop | 1024px+ | Full management, reports |

### 2.4 Localization

- i18n: `react-i18next` with `id-ID` (Bahasa Indonesia) as default, `en-US` secondary
- Currency: `Rp` prefix, no decimals, `Intl.NumberFormat('id-ID')` (e.g., Rp 15.000)
- All monetary values stored in sheets as plain integers (IDR, no decimals) to avoid floating-point issues
- Date format: `DD/MM/YYYY` via `date-fns` with `id` locale
- Timestamps: ISO 8601 strings written to sheets; displayed in selected business timezone (WIB/WITA/WIT)

### 2.5 Module Structure

The codebase is organized into **feature modules**. Each module is self-contained: it owns its UI components, business logic, data access calls, and unit tests. Modules communicate only through well-defined interfaces (hooks or Zustand stores), not by importing each other's internals.

```
src/
├── modules/
│   ├── auth/            # Google login, token management, member invite
│   │   ├── AuthProvider.tsx
│   │   ├── useAuth.ts
│   │   ├── googleSheets.auth.ts
│   │   └── auth.test.ts
│   ├── catalog/         # Products, variants, categories
│   │   ├── ProductList.tsx
│   │   ├── ProductForm.tsx
│   │   ├── useCatalog.ts
│   │   ├── catalog.service.ts   # Sheets API calls
│   │   └── catalog.test.ts
│   ├── cashier/         # POS screen, cart, payment, receipt
│   │   ├── CashierScreen.tsx
│   │   ├── Cart.tsx
│   │   ├── PaymentModal.tsx
│   │   ├── useCart.ts
│   │   ├── cashier.service.ts
│   │   └── cashier.test.ts
│   ├── inventory/       # Stock opname, stock adjustments, purchase orders
│   │   ├── StockOpname.tsx
│   │   ├── PurchaseOrders.tsx
│   │   ├── useInventory.ts
│   │   ├── inventory.service.ts
│   │   └── inventory.test.ts
│   ├── customers/       # Customer management
│   │   ├── CustomerList.tsx
│   │   ├── useCustomers.ts
│   │   ├── customers.service.ts
│   │   └── customers.test.ts
│   ├── reports/         # Sales reports, reconciliation
│   │   ├── DailySummary.tsx
│   │   ├── SalesReport.tsx
│   │   ├── useReports.ts
│   │   ├── reports.service.ts
│   │   └── reports.test.ts
│   └── settings/        # Business config, member management
│       ├── BusinessProfile.tsx
│       ├── MemberManagement.tsx
│       ├── useSettings.ts
│       ├── settings.service.ts
│       └── settings.test.ts
├── lib/
│   ├── adapters/        # Data access + auth layer
│   │   ├── types.ts             # AuthAdapter interface + shared types (AdapterError, User, Role)
│   │   ├── repos.ts             # Repos type map (logical name → ILocalRepository)
│   │   ├── schema.ts            # ALL_TAB_HEADERS — column header registry
│   │   ├── index.ts             # Exports active repos, syncManager, hydrationService
│   │   ├── google/
│   │   │   ├── SheetRepository.ts       # ISheetRepository → Google Sheets API calls
│   │   │   ├── GoogleAuthAdapter.ts     # Wraps @react-oauth/google (GIS)
│   │   │   └── sheets/                  # Low-level Google Sheets API HTTP client
│   │   │       ├── sheets.client.ts
│   │   │       └── sheets.client.test.ts
│   │   └── dexie/               # Offline-first layer (browser IndexedDB)
│   │       ├── db.ts            # Dexie DB class — all entity tables + _outbox + _syncMeta
│   │       ├── DexieRepository.ts       # ILocalRepository backed by IndexedDB + outbox
│   │       ├── SyncManager.ts           # Drains _outbox to Sheets; rate-limit backoff
│   │       ├── HydrationService.ts      # Pulls Sheets → IndexedDB on login
│   │       ├── DexieRepository.test.ts
│   │       └── SyncManager.test.ts
│   ├── formatters.ts    # IDR, date, number formatting utilities
│   ├── validators.ts    # Input validation rules
│   └── uuid.ts          # UUID v4 generator
├── components/          # Shared, reusable UI components
│   ├── NavBar.tsx       # Role-aware top navigation bar (desktop; links hidden on mobile, shown on md+)
│   ├── BottomNav.tsx    # Role-aware bottom navigation bar (mobile only; md:hidden)
│   ├── AppShell.tsx     # Authenticated page layout: NavBar + Outlet + BottomNav; starts SyncManager
│   ├── SyncStatus.tsx   # NavBar sync badge: offline/pending/syncing/error/synced states
│   └── ui/              # shadcn/ui primitives (Button, Modal, etc.)
├── hooks/               # Shared React hooks — all React Query data hooks live here
│   │                    # (useStores, useCategories, useProducts, useVariants,
│   │                    #  useCustomers, useMembers, useSettings, useStockOpname,
│   │                    #  usePurchaseOrders — each includes activeStoreId in queryKey)
├── store/               # Zustand global stores — session state only
│   ├── authStore.ts     # Auth state: user, activeStoreId, spreadsheet IDs, sign-out
│   └── syncStore.ts     # Sync state: pendingCount, isSyncing, lastSyncedAt, lastError
└── tests/
    └── e2e/             # Playwright end-to-end tests
        ├── setup.flow.spec.ts
        ├── cashier.flow.spec.ts
        ├── inventory.flow.spec.ts
        ├── reports.flow.spec.ts
        └── members.flow.spec.ts
```

**Key rules:**
- `lib/adapters/` is the only data and auth abstraction layer. Module service files call `ILocalRepository<T>` via `getRepos()` — never `lib/adapters/google/sheets/` or Google APIs directly from modules. `lib/adapters/google/sheets/` is used only inside `SheetRepository`, `SyncManager`, and `HydrationService`.
- `lib/adapters/google/sheets/` is the low-level HTTP transport for the Google Sheets API, used exclusively by `SheetRepository`.
- No module imports from another module's internals. Shared state goes through **React Query hooks** (`src/hooks/`) for server/Dexie data, or **Zustand** (`src/store/`) for session state.
- All React Query hooks include `activeStoreId` as part of the query key so switching stores automatically invalidates and refetches cached data.
- After `HydrationService.hydrateAll()` completes in `AppShell`, `queryClient.invalidateQueries()` is called to refetch all active queries from freshly-populated IndexedDB.
- Pure functions (formatters, validators, calculations) live in `lib/` and are unit-testable without DOM or API.

### 2.6 Application Layout — AppShell, NavBar & BottomNav

Authenticated pages share a common layout provided by `AppShell`, which is mounted as a **React Router v6 layout route** in `src/router.tsx`. This avoids repeating nav markup in every page component.

```
router.tsx
└── <ProtectedRoute>
    └── <AppShell>               ← layout route at path "/:storeId"
        ├── <NavBar />           ← top bar; rendered on all screen sizes
        ├── <main pb-16 md:pb-0> ← page-specific content via <Outlet />
        └── <BottomNav />        ← fixed bottom; only visible below md (md:hidden)
```

**AppShell (`src/components/AppShell.tsx`):** Renders `<NavBar />` at the top, `<Outlet />` in a `flex-1 flex-col` main area (with `pb-16 md:pb-0` to clear the BottomNav on mobile), and `<BottomNav />` fixed at the bottom.

**NavBar (`src/components/NavBar.tsx`):** A `h-14 md:h-16` top navigation bar.

| Area | Content |
|---|---|
| Left | Logo / app name ("POS UMKM") |
| Centre | Role-filtered nav links — **hidden on mobile** (`hidden md:flex`), shown on md+ |
| Right | Sign-out button (always visible); username shown on lg+ |

**BottomNav (`src/components/BottomNav.tsx`):** A fixed `h-16` bottom bar, `md:hidden`. Renders the same role-filtered nav items as NavBar (icon + label), with active-route highlight. Uses `data-testid="bottom-nav-{route}"` (distinct from NavBar's `nav-{route}`) to avoid duplicate testids in the DOM at desktop viewport where both exist but BottomNav is `display:none`.

Navigation links are filtered at render time using the same `ROLE_RANK` hierarchy as `RoleRoute`.

All routes are nested under the `/:storeId` path segment (e.g. `/pos-umkm/<storeId>/cashier`). The Vite `base` is `/pos-umkm/` and the React Router `basename` is also `/pos-umkm`, so the browser URL for a route like `cashier` in store `abc` is `/pos-umkm/abc/cashier`.

| Route | Full URL example | Label | Min role | Icon |
|---|---|---|---|---|
| `cashier` | `/pos-umkm/:storeId/cashier` | Kasir | cashier | ShoppingCart |
| `catalog` | `/pos-umkm/:storeId/catalog` → redirects to `catalog/products` | Katalog | manager | Package |
| `catalog/products` | `/pos-umkm/:storeId/catalog/products` | Katalog (Produk tab) | manager | Package |
| `catalog/categories` | `/pos-umkm/:storeId/catalog/categories` | Katalog (Kategori tab) | manager | Package |
| `inventory` | `/pos-umkm/:storeId/inventory` | Inventori | manager | Archive |
| `customers` | `/pos-umkm/:storeId/customers` | Pelanggan | manager | Users |
| `reports` | `/pos-umkm/:storeId/reports` | Laporan | manager | BarChart2 |
| `settings` | `/pos-umkm/:storeId/settings` | Pengaturan | owner | Settings |

`NavBar` and `BottomNav` both use **relative `to`** values (no leading `/`) so links resolve within the current `/:storeId` parent. The active-route highlight for `catalog` uses React Router's default prefix matching — it remains highlighted on `catalog/products` and `catalog/categories`.

`AppShell` reads `useParams<{ storeId: string }>()` and calls `setActiveStoreId` whenever the URL `:storeId` differs from the Zustand store — the URL is the **authoritative source** for the active store.

Public routes (`/`, `/login`, `/join`) and the onboarding routes (`/setup`, `/stores`) are **outside** the `/:storeId` layout route and do not show any navigation.

**Mobile-first CashierPage layout:**

On mobile (< md) the cashier screen is a single full-height column. Two toggle tabs at the top switch between the **Produk** view (ProductSearch grid) and the **Keranjang** view (cart, totals, pay button). A live item count badge on the Keranjang tab shows how many items are in the cart.

On md+ the two panels are shown side-by-side: product search on the left (flex-1) and the cart panel fixed at `w-80` on the right.

The `CashierPage` outer container uses `flex flex-1 overflow-hidden flex-col md:flex-row` so it fills the remaining viewport height without a hard-coded `h-[calc(100vh-4rem)]`. `ProductSearch` uses `flex-1 min-h-0 overflow-y-auto` on the product grid to enable proper scrolling in a flex column — without `min-h-0` the flex child defaults to `min-height: auto` which prevents overflow.

**`data-testid` attributes** (E2E locators):

| Element | `data-testid` |
|---|---|
| `<header>` wrapper | `navbar` |
| App logo span | `navbar-logo` |
| `<nav>` element | `navbar-nav` |
| Each NavBar link | `nav-{route}` e.g. `nav-cashier` |
| Username display | `navbar-username` |
| Sign-out button | `btn-logout` |
| `<AppShell>` root | `app-shell` |
| `<main>` content area | `main-content` |
| BottomNav container | `bottom-nav` |
| Each BottomNav link | `bottom-nav-{route}` e.g. `bottom-nav-cashier` |
| Mobile Produk tab | `btn-tab-products` |
| Mobile Keranjang tab | `btn-tab-cart` |

### 2.7 Data Layer Architecture

The production data path has three distinct subsystems — each with a clear, single responsibility:

```
GDrive (DriveClient)
  └─ Provisions store folders + spreadsheets (setup only; always-online)

IndexedDB / Dexie (DexieRepository)
  └─ Browser-local read/write; source of truth for all feature module reads
  └─ Every write also enqueues an OutboxEntry for background sync

Google Sheets API (SheetRepository + SyncManager + HydrationService)
  └─ Remote persistence; written to only by SyncManager (drains outbox)
  └─ Read by HydrationService on login to populate IndexedDB
```

**Two separate repository interfaces keep these concerns explicit:**

```
ILocalRepository<T>          — used by feature modules via getRepos()
  getAll()                   — read from IndexedDB
  batchInsert(rows)          — write to IndexedDB + enqueue outbox
  batchUpdate(updates)       — patch specific columns + enqueue outbox
  batchUpsertBy(...)         — upsert by lookup key + enqueue outbox
  softDelete(id)             — stamp deleted_at + enqueue outbox

ISheetRepository<T>          — used by sync layer only
  getAll()                   — read from Google Sheets API
  batchAppend(rows)          — append rows to Sheets
  batchUpdateCells(updates)  — update cells in Sheets
  batchUpsertByKey(...)      — upsert in Sheets
  softDelete(id)             — stamp deleted_at in Sheets
  writeHeaders(headers)      — write column header row (setup only)
```

**`DexieRepository<T>`** implements `ILocalRepository<T>`. Its constructor takes a `syncTarget: SyncTarget` (`{ spreadsheetId, sheetName }`) — a routing hint stored in each `OutboxEntry` so `SyncManager` knows which remote Sheet to replay the mutation against. `DexieRepository` is not "a Sheet" — it is a browser IndexedDB table that happens to sync to one.

**`SheetRepository<T>`** implements `ISheetRepository<T>`. Used by `SyncManager` (to drain the outbox) and by `makeRepo()` in setup code (where the device is guaranteed online). Never called directly by feature module service files.

**`GoogleAuthAdapter`** — wraps `@react-oauth/google`. Stores access token in memory. Implements `AuthAdapter`.

**Key rule:** `getRepos()` returns `Repos` (typed as `ILocalRepository<T>` per field). `makeRepo()` returns `ISheetRepository<T>`. Feature modules only ever call `getRepos()`.

---

## 3. Authentication — Google Login

> **Note on auth:** `MockAuthAdapter` is available for development (instant sign-in, no OAuth popup). In production, `GoogleAuthAdapter` (GIS) is used. Skip to §3.2 for the production auth flow.

### 3.1 Production Auth Flow (GoogleAuthAdapter)

1. User clicks "Sign in with Google" on the landing page
2. Google Identity Services (GIS) opens a Google OAuth consent popup
3. User grants scopes (see §3.2)
4. GIS returns an **access token** (valid for 1 hour)
5. The app stores the access token **in memory only** (never localStorage, never a cookie)
6. All `SheetRepository` calls include `Authorization: Bearer <token>` header
7. When the token expires, GIS silently refreshes it (`prompt: 'none'`) as long as the browser session is active
8. After successful auth, `LoginPage` checks for a cached `masterSpreadsheetId` in `localStorage`:
   - **Fast path (returning user):** `masterSpreadsheetId` and `activeStoreId` found → restores adapter routing → navigates to `/<storeId>/cashier`
   - **Slow path (new session):** no cached ID → navigates to `/stores` (StorePickerPage)

### 3.2 Google OAuth Scopes

| Scope | Who needs it | Purpose |
|---|---|---|
| `openid` | All users | Identify the user |
| `profile` | All users | Display name and photo in the UI |
| `email` | All users | Identify the account |
| `https://www.googleapis.com/auth/spreadsheets` | All users | Read and write spreadsheet data |
| `https://www.googleapis.com/auth/drive` | Owner only | Create folder structure, share folders with members, create spreadsheets |

> **Members** only need the `spreadsheets` scope — they access spreadsheets shared via the store folder. The `drive` scope is requested only for the owner at first-time setup (and when inviting members or creating new branches). The app detects whether the user is an owner or member based on the `Members` record in the master sheet.

### 3.3 First-Time Setup (Owner) and Post-Login Store Resolution

Every login (first-time and returning) goes through `/stores` (StorePickerPage) unless `masterSpreadsheetId` is already in `localStorage`. StorePickerPage calls `findOrCreateMain()` which:

1. Checks `localStorage` for a cached `mainSpreadsheetId`
2. If not found: calls Drive API to create `apps/pos_umkm/main` spreadsheet with a `Stores` tab, saves ID to `localStorage`
3. Returns the list of stores from `main.Stores`

**Based on store count:**
- **0 stores (first-time owner):** navigates to `/setup` (SetupWizard)
- **1 store:** auto-activates the store and navigates to `/<storeId>/cashier`
- **2+ stores:** shows a store picker UI; user selects a branch or adds a new one

**When navigating to /setup (SetupWizard):**

1. Collects business name, timezone, and PPN toggle from the owner
2. Generates a UUID as the store's permanent `store_id`
3. Creates `apps/pos_umkm/stores/<store_id>/` folder (Drive scope required)
4. Creates `master` spreadsheet inside `apps/pos_umkm/stores/<store_id>/`
5. Initializes all master sheet tabs with frozen header rows (see §4.3); writes `store_id` to `Settings` tab
6. Creates the current month's transaction spreadsheet inside `transactions/<year>/`
7. Adds a row to `main.Stores` with the new store's details
8. Saves `masterSpreadsheetId`, `activeStoreId`, and `mainSpreadsheetId` to `localStorage`
9. Saves the owner's profile in the `Members` sheet with role `owner`

**Multiple branches:** From the Settings screen, the owner can add branches. Each branch goes through steps 2–9 above. The owner's `main.Stores` tab accumulates one row per branch.

### 3.4 Family & Member Access

**Use case:** A family-owned warung where the father (Pak Santoso) is the owner. His wife and children help manage the store and need access to the same data.

**Flow:**
1. **Owner invites a member:**
   - Owner opens Settings → Manage Members → enters member's email and role
   - App calls Drive API to **share the entire `stores/<store_id>/` folder** with the email as an **editor**
   - This grants access to all existing files (master sheet, all monthly sheets) and all future files created inside the folder — no re-sharing required when new monthly sheets are added
   - App appends a row to the `Members` sheet: `{id, email, name, role: "cashier", invited_at}`
   - App displays a **Store Link** — a URL containing the `masterSpreadsheetId` (e.g., `https://pos-umkm.app/join?sid=<masterSpreadsheetId>`)

2. **Member joins:**
   - Member opens the Store Link in their browser
   - App stores `masterSpreadsheetId` in `localStorage`
   - Member clicks "Sign in with Google" — only requests the `spreadsheets` scope (no `drive` needed)
   - App reads `Members` tab to find their email, loads role and permissions
   - App reads `Settings` tab to get `store_id`, `store_name`, and `drive_folder_id`
   - App creates (or reads) the member's own `main` spreadsheet in their Drive and adds a `Stores` row with the store details
   - Member can now read/write the shared spreadsheets with their assigned role

3. **Monthly sheet access:**
   - Because the entire `stores/<store_id>/` folder is shared, any new monthly sheet created inside it is **automatically accessible** to all invited members — zero extra sharing API calls
   - The owner or manager creates the new monthly sheet; cashiers cannot (they lack the `drive` scope)
   - The recommended workflow: the app pre-creates next month's sheet during the last week of the current month when an owner/manager session is active

4. **Store switching (multi-branch owner):**
   - The owner's `main.Stores` tab lists all branches they own or manage
   - Active store is tracked in `localStorage` (`activeStoreId`)
   - Switching branches updates `localStorage` and reloads master data from the selected branch's spreadsheets
   - A member who works at multiple stores has multiple rows in their own `main.Stores` tab, one per store

5. **Role enforcement:**
   - Role is read from the `Members` sheet on login and stored in React state
   - UI hides or disables features based on role (e.g., cashier cannot view reports or change prices)
   - This is UI-level enforcement only (no server-side enforcement, as there is no backend); this is acceptable for a family trust model

| Role | Permissions |
|---|---|
| `owner` | Full access: all features, member management, settings, branch creation |
| `manager` | Reports, inventory, cashier — no member management, no branch creation |
| `cashier` | Cashier screen only — no reports, no settings |

### 3.5 POS Terminal Lock

- After configurable idle period (default 5 minutes), the app displays a lock screen requiring a PIN
- The PIN is a 4–6 digit code set per user, stored as a bcrypt hash in the `Users` sheet
- PIN validation runs entirely in the browser — no network call required

---

## 4. Data Layer — Google Sheets

> **Data schema note:** The column names, data types, and conventions in this section define the Google Sheets schema that `HydrationService` reads from and `SyncManager` writes to. `DexieRepository` stores objects with identical field names in IndexedDB.

### 4.1 Three-Spreadsheet Model

Data is split across three types of Google Spreadsheet:

| Spreadsheet | Location in Drive | Contents |
|---|---|---|
| **Main** | `apps/pos_umkm/main` | Owner's personal store registry; never shared with members |
| **Master** | `apps/pos_umkm/stores/<store_id>/master` | All reference/master data for one store; permanent |
| **Monthly** | `apps/pos_umkm/stores/<store_id>/transactions/<year>/transaction_<year>-<month>` | Transactions for a single calendar month |

The **Main** spreadsheet is private to each user's Google account. It tracks which stores the user belongs to and which store is the active context. A new Monthly spreadsheet is automatically created on the first transaction of each new month (by an owner or manager session). Because the entire `stores/<store_id>/` folder is shared with members, new monthly sheets are accessible to them immediately without additional Drive API calls.

### 4.2 Drive Folder Structure

```
My Drive (owner's Google account)
└── apps/
    └── pos_umkm/
        ├── main  [spreadsheet — private, never shared]
        │   └── Stores tab
        │       columns: store_id, store_name, master_spreadsheet_id,
        │                drive_folder_id, owner_email, my_role, joined_at
        │
        └── stores/
            └── <store_id>/               ← folder shared with all members
                ├── master  [spreadsheet]
                │   ├── Settings          ← includes store_id (UUID), store_name, etc.
                │   ├── Members           ← staff list with roles and bcrypt PINs
                │   ├── Categories, Products, Variants
                │   ├── Customers
                │   ├── Purchase_Orders, Purchase_Order_Items
                │   ├── Stock_Log, Audit_Log
                │   └── Monthly_Sheets    ← registry: year_month → spreadsheet_id
                │
                └── transactions/
                    └── <year>/
                        └── transaction_<year>-<month>  [spreadsheet]
                            ├── Transactions
                            ├── Transaction_Items
                            └── Refunds
```

**Active store context** is stored in `localStorage` (`activeStoreId`, `masterSpreadsheetId`, `mainSpreadsheetId`). On app load the app reads from localStorage for fast startup; the `main.Stores` tab is the source of truth for the full store list.

| localStorage key | Value | Set by |
|---|---|---|
| `mainSpreadsheetId` | ID of the owner's `main` spreadsheet | `findOrCreateMain()` |
| `masterSpreadsheetId` | ID of the active store's master spreadsheet | `activateStore()` / `runStoreSetup()` |
| `activeStoreId` | UUID of the active store | `createMasterSpreadsheet()` / `activateStore()` |
| `txSheet_<year>-<mm>` | ID of the monthly spreadsheet for that month | `runStoreSetup()` / `activateStore()` |

**`Monthly_Sheets` registry tab** — the master sheet keeps a tab listing all monthly spreadsheet IDs. This allows any user (including members who don't have Drive folder listing access) to discover the correct monthly spreadsheet ID for any month without a Drive API call.

| Column | Detail |
|---|---|
| `year_month` | e.g., `2026-04` |
| `spreadsheet_id` | Google-assigned ID of the monthly spreadsheet |
| `created_at` | ISO 8601 UTC timestamp |

### 4.3 Master Spreadsheet — Sheet Tabs

| Tab Name | Purpose |
|---|---|
| `Settings` | Business profile, tax rate, receipt footer, timezone, PIN salt, `store_id` (UUID) |
| `Members` | All staff (owner, managers, cashiers) with roles and bcrypt-hashed PINs |
| `Categories` | Product category list |
| `Products` | Product catalog — SKU, price, cost, stock, min_stock, category |
| `Variants` | Product variants (size, color) linked to Products |
| `Customers` | Customer name and phone number |
| `Purchase_Orders` | Incoming stock records (linked to Products) |
| `Purchase_Order_Items` | Line items for each purchase order |
| `Stock_Log` | Append-only stock adjustment history |
| `Audit_Log` | Append-only log of sensitive actions (price changes, refunds, member changes) |
| `Monthly_Sheets` | Registry of all monthly transaction spreadsheet IDs (year_month → spreadsheet_id) |

### 4.4 Monthly Transaction Spreadsheet — Sheet Tabs

| Tab Name | Purpose |
|---|---|
| `Transactions` | One row per completed transaction |
| `Transaction_Items` | One row per line item, linked to a transaction by `transaction_id` |
| `Refunds` | Refund records linked to original transactions |

### 4.5 Row Format Conventions

- **Row 1:** Frozen header row. Never modified after initialization.
- **Row 2+:** Data rows, appended only. No sorting or reordering.
- **Primary keys:** Client-generated UUID v4 in column A.
- **Timestamps:** ISO 8601 UTC strings (e.g., `2026-04-18T05:30:00Z`).
- **Soft deletes:** A `deleted_at` column; the app filters rows where this is non-empty.
- **Monetary values:** Plain integers in IDR (no decimals). `Rp 15.000` → stored as `15000`.
- **References:** Foreign keys are stored as UUID strings (not sheet row numbers, which can shift).

### 4.6 Example: Products Tab

| A: id | B: sku | C: name | D: category_id | E: price | F: cost_price | G: stock | H: min_stock | I: has_variants | J: image_url | K: deleted_at |
|---|---|---|---|---|---|---|---|---|---|---|
| uuid | SKU001 | Indomie Goreng | uuid-cat | 3500 | 2500 | 48 | 10 | FALSE | | |

### 4.7 Example: Transactions Tab (Monthly Sheet)

| A: id | B: created_at | C: cashier_id | D: customer_id | E: subtotal | F: discount | G: tax | H: total | I: payment_method | J: cash_received | K: change | L: notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| uuid | 2026-04-18T… | user-uuid | uuid or empty | 15000 | 0 | 1650 | 16650 | CASH | 20000 | 3350 | |

### 4.8 Reading Data

- **Master data (products, categories, customers):** Fetched once on app load; cached in Zustand store; refreshed when the user navigates to the catalog.
- **Product search:** Performed client-side against the Zustand store (no API call per keystroke).
- **Active store context:** Read from `localStorage` on startup (`activeStoreId`, `masterSpreadsheetId`). The `main.Stores` tab is the source of truth for multi-branch store lists.
- **Monthly sheet lookup:** The app reads `Monthly_Sheets` tab in the master sheet to resolve `year_month → spreadsheetId` — no Drive folder listing needed.
- **Reports:** Fetch the relevant Monthly spreadsheet's `Transactions` and `Transaction_Items` tabs in full; aggregate in JavaScript. For multi-month reports, fetch each monthly spreadsheet sequentially.

### 4.9 Writing Data

- New records: `values.append` to add a row to the appropriate tab.
- Stock updates: `values.get` to read the current stock row, compute new value, then `values.update` on that specific cell.
- Settings: `values.update` on specific named cells in the `Settings` tab.

> **Stock update race condition:** Read → compute → write is not atomic. For single-cashier (or family-trust) use this is acceptable. Owners should run periodic stock opname to reconcile discrepancies.

### 4.10 API Calls Per Transaction

A typical transaction (3 distinct products):
1. `values.append` → `Transactions` tab (1 call)
2. `values.append` → `Transaction_Items` tab, all items batched (1 call)
3. `values.get` + `values.update` per product stock cell (2 calls × 3 products = 6 calls)

Total: **~8 API calls per transaction** in the worst case.

---

## 5. Entity Relationship Diagram

The following diagram shows the logical relationships between data entities. Each entity maps to a tab in either the Master or Monthly spreadsheet (noted in brackets).

```mermaid
erDiagram
    Stores {
        uuid   store_id PK
        string store_name
        string master_spreadsheet_id
        string drive_folder_id
        string owner_email
        string my_role
        string joined_at
    }

    Monthly_Sheets {
        string year_month PK
        string spreadsheet_id
        string created_at
    }

    Settings {
        uuid   store_id PK
        string business_name
        string timezone
        int    tax_rate
        string receipt_footer
    }

    Members {
        uuid   id PK
        string email
        string name
        string role
        string pin_hash
        string invited_at
        string deleted_at
    }

    Categories {
        uuid   id PK
        string name
        string deleted_at
    }

    Products {
        uuid    id PK
        string  sku
        string  name
        uuid    category_id FK
        int     price
        int     cost_price
        int     stock
        int     min_stock
        boolean has_variants
        string  image_url
        string  deleted_at
    }

    Variants {
        uuid   id PK
        uuid   product_id FK
        string option_name
        string option_value
        int    price
        int    stock
        string deleted_at
    }

    Customers {
        uuid   id PK
        string name
        string phone
        string email
        string deleted_at
    }

    Purchase_Orders {
        uuid   id PK
        string supplier_name
        string ordered_at
        string received_at
        string status
    }

    Purchase_Order_Items {
        uuid id PK
        uuid purchase_order_id FK
        uuid product_id FK
        int  quantity
        int  unit_cost
    }

    Stock_Log {
        uuid   id PK
        uuid   product_id FK
        uuid   user_id FK
        int    qty_before
        int    qty_after
        string reason
        string created_at
    }

    Audit_Log {
        uuid   id PK
        uuid   user_id FK
        string action
        string entity
        string entity_id
        string detail
        string created_at
    }

    Transactions {
        uuid   id PK
        string created_at
        uuid   cashier_id FK
        uuid   customer_id FK
        int    subtotal
        int    discount
        int    tax
        int    total
        string payment_method
        int    cash_received
        int    change
        string notes
    }

    Transaction_Items {
        uuid   id PK
        uuid   transaction_id FK
        uuid   product_id FK
        uuid   variant_id FK
        string product_name
        int    qty
        int    unit_price
        int    subtotal
    }

    Refunds {
        uuid   id PK
        uuid   transaction_id FK
        uuid   cashier_id FK
        string created_at
        string reason
        int    refund_amount
    }

    Categories      ||--o{ Products           : "categorizes"
    Products        ||--o{ Variants            : "has"
    Products        ||--o{ Transaction_Items   : "sold in"
    Products        ||--o{ Stock_Log           : "tracked in"
    Products        ||--o{ Purchase_Order_Items: "ordered in"
    Purchase_Orders ||--o{ Purchase_Order_Items: "contains"
    Variants        ||--o{ Transaction_Items   : "used in"
    Transactions    ||--o{ Transaction_Items   : "contains"
    Transactions    ||--o{ Refunds             : "may have"
    Customers       ||--o{ Transactions        : "makes"
    Members         ||--o{ Transactions        : "processes"
    Members         ||--o{ Stock_Log           : "logs"
    Members         ||--o{ Audit_Log           : "creates"
```

**Spreadsheet mapping:**
- **Main sheet** (`apps/pos_umkm/main`): Stores
- **Master sheet** (`stores/<store_id>/master`): Settings, Members, Categories, Products, Variants, Customers, Purchase_Orders, Purchase_Order_Items, Stock_Log, Audit_Log, Monthly_Sheets
- **Monthly sheets** (`stores/<store_id>/transactions/<year>/transaction_<year>-<month>`): Transactions, Transaction_Items, Refunds

---

## 6. Data Security

| Layer | Detail |
|---|---|
| Transport | HTTPS enforced by static host (Netlify/GitHub Pages) and Google APIs |
| Auth token | OAuth access token in memory only; never written to localStorage or cookies |
| Data storage | User data in owner's Google Drive; Google handles encryption at rest |
| App secrets | No server-side secrets; Google OAuth client ID is public (registered to the app domain) |
| OAuth scope | `drive` (owner — folder creation and sharing) + `spreadsheets` (all users); members need `spreadsheets` only |
| PIN storage | PIN stored as bcrypt hash in `Members` sheet; raw PIN never stored or transmitted |
| Audit log | Sensitive actions (price edits, stock adjustments, refunds, member changes) appended to `Audit_Log` tab |
| Member access | Data sharing via Google Drive folder sharing (`stores/<store_id>/`); each member authenticates with their own Google account |
| Data residency | Data stored on Google's globally distributed servers. Known MVP trade-off vs. UU No. 27/2022; revisit for production |

---

## 7. Testing Strategy

### 7.1 Approach: Test-Driven Development (TDD)

All feature development follows the TDD cycle:

1. **Red** — write a failing test that describes the desired behavior
2. **Green** — write the minimal code to make the test pass
3. **Refactor** — clean up without breaking the test

Tests are written before or alongside production code. PRs without tests for new behavior are not merged.

### 7.2 Test Layers

| Layer | Tool | Scope |
|---|---|---|
| Unit | Vitest + `@testing-library/react` | Pure functions, service functions, React hooks, individual components |
| Integration | Vitest + MSW (Mock Service Worker) | Module-level flows with mocked Sheets API responses |
| End-to-End (E2E) | Playwright | Full business flows in a real browser against a test Google account |

### 7.3 Unit & Integration Tests

**Location:** Co-located with source files (e.g., `catalog.service.test.ts` next to `catalog.service.ts`)

**Coverage targets:**
- All pure functions in `lib/` must have 100% branch coverage
- All `.service.ts` files (Sheets API interactions) must be tested with mocked HTTP responses
- All React hooks must be tested with `renderHook`

**Test naming convention:**
```
describe('calculateTotal', () => {
  it('applies percentage discount before tax', () => { ... })
  it('rounds to nearest 100 IDR', () => { ... })
  it('returns 0 tax when PPN is disabled', () => { ... })
})
```

**Mocking Sheets API:** Use `msw` to intercept `fetch` calls to `sheets.googleapis.com`. Each service test provides a fixture of sheet rows as the mock response. No real Google account needed for unit/integration tests.

### 7.4 End-to-End Tests (Playwright)

**Location:** `src/tests/e2e/`

**Test account:** A dedicated Google test account with a pre-seeded test spreadsheet. Credentials stored in environment variables, never committed to the repository.

**Playwright configuration:**
- Browsers: Chromium (primary), Firefox, WebKit
- Viewport: Tablet (768×1024) as primary (matches cashier terminal use case)
- Base URL: `http://localhost:5173` for local; deployed URL for CI

**Locator rule — `data-testid` required:**
All interactive elements and key output elements in production components **must** carry a `data-testid` attribute. E2E tests **must** locate elements using `page.getByTestId()` as the primary selector. Text-based locators (`getByText`, `getByRole` with name, `getByPlaceholder`) are only permitted for:
- Page-level URL assertions (`expect(page).toHaveURL(...)`)
- Waiting for page transitions (`page.waitForURL(...)`)
- Elements that have no production component (e.g., the `<body>` element)

`getByRole`, `getByPlaceholder`, `.filter({ hasText })`, and `.first()` / `.last()` are **not allowed** as the primary locator in assertions or interactions. Every element that an E2E test interacts with or asserts on must be identified by its `data-testid`.

**`data-testid` naming convention:**
- Buttons: `btn-<action>` (e.g., `btn-pay`, `btn-invite-member`, `btn-method-cash`)
- Inputs: `input-<field>` (e.g., `input-cash`, `input-discount-value`)
- Output/display elements: `<semantic-name>` (e.g., `change-amount`, `receipt-preview`)
- Per-item elements in lists: `<element>-<id>` (e.g., `product-card-e2e-prod-1`, `btn-retrieve-cart-0`)

**Business flows covered:**

| Spec file | Flow |
|---|---|
| `setup.flow.spec.ts` | First-time login, business profile setup, initial product creation |
| `cashier.flow.spec.ts` | Add items to cart → apply discount → cash payment → print receipt |
| `cashier.flow.spec.ts` | Add items → QRIS payment (manual confirm) → WhatsApp receipt share |
| `cashier.flow.spec.ts` | Multi-item cart → split payment (part cash, part QRIS) |
| `cashier.flow.spec.ts` | Hold transaction → start new → retrieve held transaction |
| `inventory.flow.spec.ts` | Add product → complete sale → verify stock decremented |
| `inventory.flow.spec.ts` | Stock opname — enter physical count, verify discrepancy logged |
| `inventory.flow.spec.ts` | Create purchase order → receive stock → verify stock incremented |
| `reports.flow.spec.ts` | View daily sales summary → verify transaction appears |
| `reports.flow.spec.ts` | Filter report by date range → export to PDF |
| `reports.flow.spec.ts` | End-of-day cash reconciliation — enter closing balance |
| `members.flow.spec.ts` | Owner invites member via email → member joins via Store Link |
| `members.flow.spec.ts` | Cashier role cannot access reports page (redirected) |
| `members.flow.spec.ts` | POS terminal auto-locks after idle → cashier unlocks with PIN |

**Example test structure:**
```typescript
// cashier.flow.spec.ts
test('complete a cash transaction', async ({ page }) => {
  await page.goto('/')
  await signInAsTestCashier(page)

  await page.getByTestId('product-search-input').fill('Indomie')
  await page.getByTestId('product-card-prod-indomie').click()
  await expect(page.getByTestId('btn-pay')).toContainText('3.500')

  await page.getByTestId('btn-pay').click()
  await page.getByTestId('btn-method-cash').click()
  await page.getByTestId('input-cash').fill('5000')
  await expect(page.getByTestId('change-amount')).toHaveText('Rp 1.500')

  await page.getByTestId('btn-cash-confirm').click()
  await expect(page.getByTestId('receipt-success')).toBeVisible()
})
```

### 7.5 CI Integration

Tests run automatically on every pull request via GitHub Actions:

```yaml
# .github/workflows/test.yml
jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - run: npm ci
      - run: npm run test        # Vitest

  e2e:
    runs-on: ubuntu-latest
    steps:
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run build && npx serve dist &
      - run: npx playwright test
    env:
      GOOGLE_TEST_EMAIL: ${{ secrets.GOOGLE_TEST_EMAIL }}
      GOOGLE_TEST_SPREADSHEET_ID: ${{ secrets.GOOGLE_TEST_SPREADSHEET_ID }}
```

---

## 8. Browser & Device Compatibility

### 8.1 Supported Browsers

| Browser | Minimum Version | Notes |
|---|---|---|
| Chrome (Android/Desktop) | 90+ | Primary target |
| Samsung Internet | 14+ | Common on low-cost Android |
| Safari (iOS/macOS) | 14+ | Google Sign-In popup may require user gesture |
| Firefox (Desktop) | 90+ | Secondary desktop support |
| Edge (Desktop) | 90+ | Chromium-based |

> **Not supported:** Internet Explorer; browsers without ES2020 support.

### 8.2 Required Browser APIs

| API | Usage |
|---|---|
| Fetch API | Google Sheets / Drive API calls |
| Web Crypto | Client-side bcrypt for PIN hashing |
| localStorage | Store `spreadsheetId` (non-sensitive) |
| Popup windows | Google OAuth consent (must not be blocked) |
| `window.print()` | Receipt printing (post-MVP priority; basic support in MVP) |
| MediaDevices (camera) | Barcode scanning (post-MVP) |

---

## 9. Peripheral Integration

> **Not a priority for MVP.** Peripheral integration (thermal printer, barcode scanner) is deferred to post-MVP. The cashier screen in MVP uses manual product search only.

**Post-MVP plan:**

| Peripheral | Post-MVP Approach |
|---|---|
| Thermal printer (58mm / 80mm) | `window.print()` with CSS `@media print` + `@page` size rules |
| Thermal printer (advanced) | Web Bluetooth API with ESC/POS commands |
| Barcode scanner (USB) | USB HID — no driver needed; detected via rapid keypress pattern in search input |
| Barcode scanner (camera) | `@zxing/browser` library via `MediaDevices` API |

---

## 10. Hosting & Infrastructure

### 10.1 Static Hosting Options (All Free)

| Provider | Free Tier | Notes |
|---|---|---|
| **GitHub Pages** | Unlimited for public repos | Deploy via GitHub Actions; custom domain supported |
| **Netlify** | 100GB bandwidth/month | Drag-and-drop or CI/CD; automatic HTTPS |
| **Vercel** | 100GB bandwidth/month | Git-connected deploy; excellent for React/Vite |

Recommended: **GitHub Pages** for maximum transparency and zero vendor lock-in.

### 10.2 Google Cloud Console Setup (One-Time)

The app requires a Google Cloud project with:
- **OAuth 2.0 Client ID** (Web application type) — client ID is public, registered to the app domain
- **Google Sheets API** enabled
- **Google Drive API** enabled
- Authorized JavaScript origins and redirect URIs set to the hosting domain

No ongoing Google Cloud cost at expected API usage levels.

### 10.3 Deployment Pipeline

```
GitHub repo
  └── Pull Request → GitHub Actions: unit tests + Playwright E2E
  └── Merge to main → GitHub Actions: vite build → deploy to GitHub Pages
```

---

## 11. Data Capacity & API Quotas

### 11.1 Google Sheets Limits

| Limit | Value |
|---|---|
| Cells per spreadsheet | 10,000,000 |
| Sheets (tabs) per spreadsheet | 200 |
| Max single API response | 10MB |

Monthly transaction sheets stay small by design. A shop doing 100 transactions/day × 5 items = ~500 rows in `Transaction_Items` per day = ~15,000 rows per month — well within limits.

### 11.2 Google Sheets API Quotas (Free Tier)

| Quota | Limit | Impact |
|---|---|---|
| Read requests / minute / project | 300 | Shared across all users of the app |
| Write requests / minute / project | 300 | ~5 concurrent cashiers safely across all users |
| Read requests / minute / user | 60 | Per Google account |
| Write requests / minute / user | 60 | ~7–10 transactions/minute per cashier |

**Practical throughput:** ~8 API calls per transaction → max ~7 transactions/minute per cashier. A typical UMKM cashier handles 1 transaction every 2–5 minutes, well within limits.

### 11.3 Free Tier Limits (App-Enforced)

No backend to enforce hard limits. The app displays a warning banner when the thresholds from PRD (100 products, 500 transactions/month) are reached but does not block usage.

---

## 12. Offline Mode

The production data path uses **Dexie.js** (IndexedDB) as a local-first cache in front of Google Sheets. After the initial data hydration, the app reads entirely from IndexedDB and works fully offline. Writes are queued in an outbox and replayed to Google Sheets when the device is back online.

### 12.1 Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  Module Service (e.g., catalog.service.ts)                        │
│  Calls ILocalRepository methods via getRepos() — never aware of   │
│  online/offline state or Google Sheets API                         │
└──────────────────────────┬───────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│  DexieRepository (src/lib/adapters/dexie/)                        │
│                                                                    │
│  Reads ──────────────────────────────────► IndexedDB (instant)   │
│                                                                    │
│  Writes ─────► IndexedDB (ACID txn) ──┐                          │
│                                        └──► _outbox (serialized)  │
└──────────────────────────────────────────────┬───────────────────┘
                                               │ background
                                               ▼
┌──────────────────────────────────────────────────────────────────┐
│  SyncManager                                                       │
│  • Polls every 30 s + fires on browser 'online' event            │
│  • Drains _outbox FIFO → SheetRepository → Google Sheets API     │
│  • HTTP 429 → pauses 60 s then retries                           │
│  • MAX_RETRIES = 5; permanently skips entries after that         │
│  • Updates syncStore (pendingCount, isSyncing, lastSyncedAt)     │
└──────────────────────────────────────────────────────────────────┘
```

### 12.2 Data Hydration

`HydrationService.hydrateAll(mainId, masterId, monthlyId)` is called by `AppShell` after the auth store has all three spreadsheet IDs. It:

1. Fetches all 15 entity tables from Google Sheets in parallel (`Promise.allSettled`)
2. Writes each table's rows into the corresponding IndexedDB table via `db.table(name).bulkPut()`
3. Records a `_syncMeta` timestamp per table; skips tables hydrated within the last 5 minutes
4. Skips tables with pending outbox entries to avoid overwriting unsynced local writes

On subsequent logins the skip condition (5-minute freshness window) means hydration only re-fetches stale tables, significantly reducing Sheets API read quota usage.

### 12.3 Outbox Pattern

Every `DexieRepository` write method (`batchInsert`, `batchUpdate`, `batchUpsertBy`, `softDelete`) runs a Dexie ACID transaction that:
1. Writes the record(s) to the entity table in IndexedDB (immediately visible to all reads)
2. Appends a serialized `OutboxEntry` to `_outbox` describing the Sheets API call to make

The `OutboxEntry` schema:

| Field | Type | Description |
|---|---|---|
| `id` | auto-increment | FIFO ordering key |
| `spreadsheetId` | string | Target spreadsheet (master or monthly) |
| `sheetName` | string | Target tab (e.g. `Products`, `Transactions`) |
| `operation` | string | `append` \| `batchAppend` \| `batchUpdateCells` \| `softDelete` |
| `payload` | string | JSON-serialized arguments for the Sheets API call |
| `retries` | number | Number of failed sync attempts (max 5) |
| `createdAt` | string | ISO 8601 timestamp |

`batchUpsertByKey` (used by Settings service) is decomposed at write time: Dexie is queried locally to distinguish updates from inserts, then `batchUpdateCells` and `batchAppend` outbox entries are created individually — avoiding the need to serialize the `makeNewRow` callback function.

### 12.4 Sync Status UI

`SyncStatus` is a NavBar component (slot passed via `syncStatusSlot` prop) that shows the current sync state using `syncStore` (Zustand):

| State | Indicator | Bahasa Indonesia label |
|---|---|---|
| Offline | 🔴 dot | "Offline" |
| Syncing | ⟳ spinner | "Menyinkronkan…" |
| Error + pending | ⚠ icon + count badge | "Gagal, ketuk untuk coba lagi" |
| Pending (not error) | �� icon + count badge | "{n} perubahan menunggu" |
| Synced | ✓ green dot | "Tersinkronisasi" |

Tapping the error or pending indicator calls `syncManager.triggerSync()` to force an immediate drain attempt.

### 12.5 Known Trade-offs

| Trade-off | Detail |
|---|---|
| Absolute stock writes | The outbox stores absolute stock values (not deltas). If two devices write the same product's stock offline simultaneously, the last-synced value wins. This is acceptable for single-cashier UMKM (the primary target persona). |
| Monthly sheet rollover | When `monthlySpreadsheetId` changes at month start, old transaction rows remain in IndexedDB indefinitely. A pruning strategy for long-running installations is deferred. |
| No app-shell offline cache | The HTML/JS/CSS bundle is not cached by a service worker. After a hard refresh on a device without network, the app shell will fail to load. IndexedDB data is preserved but inaccessible. |
| First-load requires network | A completely fresh browser (empty IndexedDB) must be online for `HydrationService` to populate the local cache. |


---

## 13. Glossary

| Term | Definition |
|---|---|
| **SPA** | Single-Page Application — all UI rendering happens in the browser; the server only serves static files |
| **GIS** | Google Identity Services — Google's OAuth 2.0 SDK for web authentication |
| **OAuth 2.0** | Authorization framework; the app gets a token to act on behalf of the user without seeing their password |
| **Access Token** | Short-lived credential (1 hour) from Google after login; used in all Sheets API calls |
| **Google Sheets API v4** | Google's REST API for reading and writing spreadsheet data |
| **`drive` scope** | OAuth scope granting full Google Drive access; required by the owner to create folders and share them with members |
| **`values.append`** | Sheets API method to add rows — used for all new record writes |
| **`values.update`** | Sheets API method to overwrite specific cells — used for stock decrements and settings changes |
| **spreadsheetId** | Unique identifier for a Google Sheets file; found in the file's URL |
| **Store Link** | A URL containing the `masterSpreadsheetId` that the owner shares with members to join the store (`/join?sid=<id>`) |
| **Main Sheet** | The private `apps/pos_umkm/main` spreadsheet in each user's Drive; tracks which stores they belong to (`Stores` tab) |
| **Master Sheet** | The permanent Google Spreadsheet inside `stores/<store_id>/` containing all reference data (products, members, settings) |
| **Monthly Sheet** | A Google Spreadsheet created per calendar month inside `transactions/<year>/` containing only that month's transactions |
| **Monthly_Sheets tab** | A tab in the Master Sheet that acts as a registry mapping `year_month → spreadsheetId` for fast monthly sheet lookup |
| **store_id** | A UUID generated on store creation, written to `Settings.store_id`; used as the folder name and stable store identifier |
| **UUID v4** | Universally Unique Identifier v4 — randomly generated primary key for all records |
| **Soft delete** | Marking a record deleted via `deleted_at` timestamp instead of removing the row |
| **bcrypt** | Password hashing algorithm used to store cashier PINs in the `Members` tab |
| **TDD** | Test-Driven Development — write a failing test first, then write code to make it pass |
| **Vitest** | Fast unit test runner compatible with Vite; used for unit and integration tests |
| **MSW** | Mock Service Worker — intercepts `fetch` calls in tests to mock API responses |
| **Playwright** | End-to-end browser testing framework; used for full business flow tests |
| **ESC/POS** | Printer command language used by thermal receipt printers (post-MVP) |
| **HID** | Human Interface Device — USB device class; barcode scanners appear as keyboards (post-MVP) |
| **Vite** | Fast frontend build tool for React/TypeScript projects |
| **GitHub Actions** | CI/CD platform built into GitHub; runs tests and deploys to GitHub Pages |
| **IndexedDB** | Browser-native key-value object store; persists data across sessions; used by Dexie.js as the physical storage layer |
| **Dexie.js** | Minimal IndexedDB wrapper (npm: `dexie`) providing typed tables, ACID transactions, and a fluent query API; used as the offline-first local cache |
| **Outbox pattern** | A write-through queueing technique: writes are applied locally first, then queued in an `_outbox` table for asynchronous replay to the remote system (Google Sheets) |
| **SyncManager** | Background service (`src/lib/adapters/dexie/SyncManager.ts`) that drains the `_outbox` to Google Sheets; handles rate limiting, retries, and updates `syncStore` |
| **HydrationService** | Service (`src/lib/adapters/dexie/HydrationService.ts`) that pulls all Google Sheets data into IndexedDB on login; skips recently-hydrated and outbox-pending tables |
| **syncStore** | Zustand store (`src/store/syncStore.ts`) tracking `pendingCount`, `isSyncing`, `lastSyncedAt`, and `lastError` for the sync status UI |
| **IDR integers** | Monetary values stored as plain integers in IDR (no decimals) to avoid floating-point errors |

---

*End of Document — POS UMKM TRD v2.7*
