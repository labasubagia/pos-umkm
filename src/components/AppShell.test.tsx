import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AppShell } from "./AppShell";
import { useAuthStore } from "../store/authStore";

const mocks = vi.hoisted(() => {
  const setStoreMapMock = vi.fn();

  return {
    traverseMock: vi.fn(),
    hydrateAllMock: vi.fn(),
    reinitDexieLayerMock: vi.fn(),
    triggerSyncMock: vi.fn(),
    setActiveStoreMapMock: vi.fn(),
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

vi.mock("../lib/adapters", () => ({
  hydrationService: { hydrateAll: mocks.hydrateAllMock },
  reinitDexieLayer: mocks.reinitDexieLayerMock,
  storeFolderService: { traverse: mocks.traverseMock },
  syncManager: { triggerSync: mocks.triggerSyncMock },
}));

vi.mock("../store/storeMapStore", () => ({
  getActiveStoreMap: () => ({ getState: () => mocks.storeMapState }),
  setActiveStoreMap: mocks.setActiveStoreMapMock,
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
      accessToken: "token",
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
    });

    await waitFor(() => {
      expect(mocks.traverseMock).toHaveBeenCalledWith("folder-from-store-map");
    });

    await waitFor(() => {
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
