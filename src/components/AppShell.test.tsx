import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

// ─── Suppress cascading async act() warnings ─────────────────────────────────
// AppShell's bootstrap effect chain (URL sync → setActiveStoreId → traversal →
// hydrateAll → setStoreMapReady) fires chained Promise callbacks that update
// React state outside act(). Tests use waitFor() and all assertions pass.
const _originalError = console.error.bind(console);
beforeAll(() => {
  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    const msg = typeof args[0] === "string" ? args[0] : "";
    if (msg.includes("not wrapped in act")) return;
    _originalError(...args);
  });
});
afterAll(() => vi.restoreAllMocks());

import { useAuthStore } from "../store/authStore";
import { AppShell } from "./AppShell";

const mocks = vi.hoisted(() => {
  const setStoreMapMock = vi.fn();

  return {
    traverseMock: vi.fn(),
    hydrateAllMock: vi.fn(),
    reinitDexieLayerMock: vi.fn(),
    triggerSyncMock: vi.fn(),
    getStoreMapStoreMock: vi.fn(),
    setStoreMapMock,
    storeMapState: {
      storeFolderId: null as string | null,
      sheets: {} as Record<string, unknown>,
      monthlySheets: [] as unknown[],
      lastTraversedAt: null as number | null,
      setStoreMap: setStoreMapMock,
      getSheetMeta: vi.fn(),
      getCurrentMonthSheets: vi.fn(),
      clearStoreMap: vi.fn(),
    },
  };
});

vi.mock("../api/services/MigrationService", () => ({
  MigrationService: {},
}));

vi.mock("../api/services/StoreActivationService", () => ({
  StoreActivationService: {},
  pendingActivations: new Map(),
  STORE_MAP_TTL_MS: 5 * 60 * 1000,
}));

vi.mock("../api/adapters", () => ({
  hydrationService: { hydrateAll: mocks.hydrateAllMock },
  reinitDexieLayer: mocks.reinitDexieLayerMock,
  storeFolderService: { traverse: mocks.traverseMock },
  syncManager: { triggerSync: mocks.triggerSyncMock },
}));

vi.mock("../store/storeMapStore", () => ({
  getStoreMapStore: mocks.getStoreMapStoreMock,
}));

vi.mock("./NavBar", () => ({
  NavBar: () => <div data-testid="nav-bar" />,
}));

vi.mock("./BottomNav", () => ({
  BottomNav: () => <div data-testid="bottom-nav" />,
}));

vi.mock("./SyncStatus", () => ({
  SyncStatus: () => <div data-testid="sync-status" />,
}));

describe("AppShell", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mocks.getStoreMapStoreMock.mockReturnValue({
      getState: () => mocks.storeMapState,
    });
    mocks.storeMapState.storeFolderId = "folder-from-store-map";
    mocks.storeMapState.sheets = {};
    mocks.storeMapState.monthlySheets = [];
    mocks.storeMapState.lastTraversedAt = null;
    mocks.storeMapState.getCurrentMonthSheets.mockReturnValue(undefined);
    mocks.traverseMock.mockResolvedValue({
      sheets: {
        Products: {
          spreadsheet_id: "master-sheet-id",
          spreadsheet_name: "master",
          folder_path: "",
          sheet_name: "Products",
          sheet_id: 1,
          headers: ["id", "name"],
        },
      },
      monthlySheets: [],
    });
    mocks.hydrateAllMock.mockResolvedValue(undefined);

    useAuthStore.getState().clearAuth();
    useAuthStore.setState({
      user: {
        id: "owner-1",
        email: "owner@test.com",
        name: "Owner",
        role: "owner",
      },
      role: "owner",
      isAuthenticated: true,
      activeStoreId: null,
      mainSpreadsheetId: "main-id",
    });
  });

  afterEach(() => {
    useAuthStore.getState().clearAuth();
  });

  it("refresh bootstrap uses the active store map folder id instead of the global localStorage key", async () => {
    localStorage.setItem("storeFolderId", "wrong-global-folder");

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    await act(async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={["/store-a/cashier"]}>
            <Routes>
              <Route path="/:storeId" element={<AppShell />}>
                <Route
                  path="cashier"
                  element={<div data-testid="page-content" />}
                />
              </Route>
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>,
      );
      // Flush the traverseMock Promise resolution so the resulting AppShell
      // state updates (setStoreMap) fire inside this act block rather than
      // outside it, avoiding "not wrapped in act" warnings.
      await new Promise((r) => setTimeout(r, 0));
    });

    await waitFor(() => {
      expect(mocks.traverseMock).toHaveBeenCalledWith("folder-from-store-map");
      expect(screen.getByTestId("page-content")).toBeTruthy();
    });

    expect(mocks.traverseMock).not.toHaveBeenCalledWith("wrong-global-folder");
    expect(mocks.setStoreMapMock).toHaveBeenCalledWith(
      "folder-from-store-map",
      expect.any(Object),
      expect.any(Array),
    );
  });
});
