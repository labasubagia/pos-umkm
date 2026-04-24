/**
 * dexie-test-utils.tsx — Integration test helpers using real Dexie + fake-indexeddb.
 *
 * `renderWithDexie` wraps a component in the full provider stack
 * (QueryClientProvider + MemoryRouter + Zustand auth state) with a real Dexie
 * database backed by fake-indexeddb. Tests seed tables directly and assert
 * against the full React Query → service → DexieSheetRepository → UI path
 * without mocking the service layer.
 *
 * Only the Sheets sync boundary (SyncManager + HydrationService) is kept as a
 * no-op — it is mocked at the module level in tests that import this helper via:
 *   vi.mock('../lib/adapters', async (importOriginal) => { ... resetDexieLayer: vi.fn() })
 *
 * fake-indexeddb/auto must be imported before Dexie opens any database.
 * It is imported in src/test-setup.ts so it is always available.
 */
import type { ReactElement } from "react";
import { render, type RenderResult } from "@testing-library/react";
import { act } from "react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuthStore } from "../store/authStore";
import { useCartStore } from "../modules/cashier/useCart";
import { getDb, clearDbCache } from "../lib/adapters/dexie/db";
import type { PosUmkmDatabase } from "../lib/adapters/dexie/db";

export type { PosUmkmDatabase };

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TestUser {
  id?: string;
  email?: string;
  name?: string;
  role?: "owner" | "manager" | "cashier";
}

export interface RenderWithDexieOptions {
  /** Dexie DB key — each unique storeId gets its own isolated in-memory DB. */
  storeId?: string;
  /** Fake master spreadsheet ID passed into Zustand. */
  spreadsheetId?: string;
  /** Fake main spreadsheet ID. */
  mainSpreadsheetId?: string;
  /** Fake monthly spreadsheet ID. */
  monthlySpreadsheetId?: string;
  /** Auth state to inject into Zustand before render. */
  user?: TestUser;
  /** Async callback to pre-populate Dexie tables before the component mounts. */
  seed?: (db: PosUmkmDatabase) => Promise<void>;
  /** Initial router path. */
  initialPath?: string;
}

// ─── Main helper ──────────────────────────────────────────────────────────────

/**
 * Renders `ui` inside a full provider stack (QueryClient + MemoryRouter +
 * Zustand auth). Optionally seeds the Dexie DB before mounting.
 *
 * Returns the standard @testing-library/react RenderResult plus the Dexie
 * instance so tests can query the DB directly after mutations.
 *
 * Call `cleanupDexie(storeId)` in afterEach to reset state between tests.
 */
export async function renderWithDexie(
  ui: ReactElement,
  options: RenderWithDexieOptions = {},
): Promise<RenderResult & { db: PosUmkmDatabase; queryClient: QueryClient }> {
  const {
    storeId = "test-store",
    spreadsheetId = "test-master-id",
    mainSpreadsheetId = "test-main-id",
    monthlySpreadsheetId = "test-monthly-id",
    user = {},
    seed,
    initialPath = "/",
  } = options;

  const {
    id = "test-user-1",
    email = "owner@test.com",
    name = "Test Owner",
    role = "owner",
  } = user;

  // Get (or create) the Dexie instance for this storeId.
  const db = getDb(storeId);

  // Pre-populate tables before the component mounts.
  if (seed) await seed(db);

  // Seed Zustand auth state.
  act(() => {
    useAuthStore
      .getState()
      .setUser({ id, email, name, role }, role, "test-token");
    useAuthStore.getState().setActiveStoreId(storeId);
    useAuthStore.getState().setMainSpreadsheetId(mainSpreadsheetId);
    useAuthStore
      .getState()
      .setStoreSession(spreadsheetId, monthlySpreadsheetId, storeId);
  });

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  const result = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );

  return { ...result, db, queryClient };
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────

/**
 * Clears all tables in the test Dexie DB and removes it from the cache so the
 * next test gets a fresh database. Call in afterEach.
 */
export async function cleanupDexie(storeId = "test-store"): Promise<void> {
  const db = getDb(storeId);
  await Promise.all(db.tables.map((t) => t.clear()));
  clearDbCache();
  useAuthStore.getState().clearAuth();
  useCartStore.getState().resetCart();
}
