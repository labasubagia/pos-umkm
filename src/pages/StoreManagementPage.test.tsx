/**
 * Unit tests for StoreManagementPage.
 *
 * store-management.service is fully mocked so no real adapter I/O occurs.
 * useAuthStore is pre-seeded with an owner user.
 * react-router-dom navigate is mocked so redirect assertions are safe.
 * activateStore (setup.service) is mocked to avoid real API calls.
 * QueryClientProvider is provided so useStores() / useMutation() work.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StoreRecord } from "../modules/auth/setup.service";
import * as svc from "../modules/settings/store-management.service";
import { useAuthStore } from "../store/authStore";
import StoreManagementPage from "./StoreManagementPage";

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("../modules/settings/store-management.service", () => ({
  listStores: vi.fn(),
  createStore: vi.fn(),
  updateStore: vi.fn(),
  removeOwnedStore: vi.fn(),
  removeAccessToStore: vi.fn(),
  StoreManagementError: class StoreManagementError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "StoreManagementError";
    }
  },
}));

vi.mock("../modules/auth/setup.service", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../modules/auth/setup.service")>();
  return {
    ...actual,
    activateStore: vi.fn().mockImplementation(() => Promise.resolve()),
  };
});

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const OWNER_EMAIL = "owner@test.com";
const OTHER_EMAIL = "other@test.com";

const ownedStore: StoreRecord = {
  store_id: "store-owned",
  store_name: "Toko Sendiri",
  master_spreadsheet_id: "master-owned",
  drive_folder_id: "folder-owned",
  owner_email: OWNER_EMAIL,
  my_role: "owner",
  joined_at: "2026-01-01T00:00:00Z",
};

const joinedStore: StoreRecord = {
  store_id: "store-joined",
  store_name: "Toko Orang Lain",
  master_spreadsheet_id: "master-joined",
  drive_folder_id: "folder-joined",
  owner_email: OTHER_EMAIL,
  my_role: "manager",
  joined_at: "2026-02-01T00:00:00Z",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function seedOwner() {
  act(() => {
    useAuthStore
      .getState()
      .setUser(
        { id: "u1", email: OWNER_EMAIL, name: "Test Owner", role: "owner" },
        "owner",
        "tok",
      );
    useAuthStore.getState().setActiveStoreId(ownedStore.store_id);
    useAuthStore.getState().setMainSpreadsheetId("main-id");
  });
}

function renderPage() {
  // Fresh QueryClient per test so cache doesn't bleed between tests.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <StoreManagementPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  useAuthStore.getState().clearAuth();
  vi.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("StoreManagementPage", () => {
  it("renders store list with correct action buttons per ownership", async () => {
    vi.mocked(svc.listStores).mockResolvedValue([ownedStore, joinedStore]);
    seedOwner();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Toko Sendiri")).toBeInTheDocument();
      expect(screen.getByText("Toko Orang Lain")).toBeInTheDocument();
    });

    // Owned store shows Edit + Hapus, no Keluar
    expect(
      screen.getByTestId(`btn-edit-store-${ownedStore.store_id}`),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(`btn-delete-store-${ownedStore.store_id}`),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId(`btn-leave-store-${ownedStore.store_id}`),
    ).toBeNull();

    // Non-owned store shows Keluar only, no Edit/Hapus
    expect(
      screen.queryByTestId(`btn-edit-store-${joinedStore.store_id}`),
    ).toBeNull();
    expect(
      screen.queryByTestId(`btn-delete-store-${joinedStore.store_id}`),
    ).toBeNull();
    expect(
      screen.getByTestId(`btn-leave-store-${joinedStore.store_id}`),
    ).toBeInTheDocument();
  });

  it("does not show Delete button for non-owned stores", async () => {
    vi.mocked(svc.listStores).mockResolvedValue([joinedStore]);
    seedOwner();
    renderPage();

    await waitFor(() => screen.getByText("Toko Orang Lain"));
    expect(
      screen.queryByTestId(`btn-delete-store-${joinedStore.store_id}`),
    ).toBeNull();
  });

  it("does not show Leave button for owned stores", async () => {
    vi.mocked(svc.listStores).mockResolvedValue([ownedStore]);
    seedOwner();
    renderPage();

    await waitFor(() => screen.getByText("Toko Sendiri"));
    expect(
      screen.queryByTestId(`btn-leave-store-${ownedStore.store_id}`),
    ).toBeNull();
  });

  it("Add dialog submits createStore and refreshes list", async () => {
    const user = userEvent.setup();
    const newStore: StoreRecord = {
      ...ownedStore,
      store_id: "store-new",
      store_name: "Toko Baru",
    };
    vi.mocked(svc.listStores)
      .mockResolvedValueOnce([ownedStore]) // initial load
      .mockResolvedValueOnce([ownedStore, newStore]); // after add
    vi.mocked(svc.createStore).mockResolvedValue(newStore);
    seedOwner();
    renderPage();

    await waitFor(() => screen.getByTestId("btn-add-store"));
    await user.click(screen.getByTestId("btn-add-store"));

    await user.type(screen.getByTestId("input-store-name"), "Toko Baru");
    await user.click(screen.getByTestId("btn-save-store"));

    await waitFor(() => {
      expect(svc.createStore).toHaveBeenCalledWith("Toko Baru");
    });
    await waitFor(() => screen.getByText("Toko Baru"));
  });

  it("Edit dialog pre-fills store name and submits updateStore", async () => {
    const user = userEvent.setup();
    vi.mocked(svc.listStores).mockResolvedValue([ownedStore]);
    vi.mocked(svc.updateStore).mockResolvedValue(undefined);
    seedOwner();
    renderPage();

    await waitFor(() =>
      screen.getByTestId(`btn-edit-store-${ownedStore.store_id}`),
    );
    await user.click(
      screen.getByTestId(`btn-edit-store-${ownedStore.store_id}`),
    );

    const input = screen.getByTestId("input-store-name-edit");
    expect(input).toHaveValue("Toko Sendiri");

    await user.clear(input);
    await user.type(input, "Toko Renamed");
    await user.click(screen.getByTestId("btn-save-store-edit"));

    await waitFor(() => {
      expect(svc.updateStore).toHaveBeenCalledWith(ownedStore.store_id, {
        store_name: "Toko Renamed",
      });
    });
  });

  it("Delete confirmation calls removeOwnedStore and removes row from list", async () => {
    const user = userEvent.setup();
    vi.mocked(svc.listStores)
      .mockResolvedValueOnce([ownedStore, joinedStore]) // initial
      .mockResolvedValueOnce([joinedStore]); // after delete
    vi.mocked(svc.removeOwnedStore).mockResolvedValue(undefined);
    seedOwner();
    act(() => useAuthStore.getState().setActiveStoreId(joinedStore.store_id));
    renderPage();

    await waitFor(() =>
      screen.getByTestId(`btn-delete-store-${ownedStore.store_id}`),
    );
    await user.click(
      screen.getByTestId(`btn-delete-store-${ownedStore.store_id}`),
    );

    await user.click(screen.getByTestId("btn-confirm-delete-store"));

    await waitFor(() => {
      expect(svc.removeOwnedStore).toHaveBeenCalledWith(ownedStore.store_id);
    });
    await waitFor(() => expect(screen.queryByText("Toko Sendiri")).toBeNull());
  });

  it("Leave confirmation calls removeAccessToStore", async () => {
    const user = userEvent.setup();
    vi.mocked(svc.listStores).mockResolvedValue([ownedStore, joinedStore]);
    vi.mocked(svc.removeAccessToStore).mockResolvedValue(undefined);
    seedOwner();
    renderPage();

    await waitFor(() =>
      screen.getByTestId(`btn-leave-store-${joinedStore.store_id}`),
    );
    await user.click(
      screen.getByTestId(`btn-leave-store-${joinedStore.store_id}`),
    );

    await user.click(screen.getByTestId("btn-confirm-leave-store"));

    await waitFor(() => {
      expect(svc.removeAccessToStore).toHaveBeenCalledWith(
        joinedStore.master_spreadsheet_id,
      );
    });
  });

  it("shows error Alert when createStore fails", async () => {
    const user = userEvent.setup();
    vi.mocked(svc.listStores).mockResolvedValue([ownedStore]);
    vi.mocked(svc.createStore).mockRejectedValue(
      new Error("Drive quota exceeded"),
    );
    seedOwner();
    renderPage();

    await waitFor(() => screen.getByTestId("btn-add-store"));
    await user.click(screen.getByTestId("btn-add-store"));
    await user.type(screen.getByTestId("input-store-name"), "Toko Error");
    await user.click(screen.getByTestId("btn-save-store"));

    await waitFor(() => screen.getByTestId("alert-store-error"));
    expect(screen.getByTestId("alert-store-error")).toHaveTextContent(
      "Drive quota exceeded",
    );
  });

  it("shows error Alert when removeOwnedStore fails", async () => {
    const user = userEvent.setup();
    vi.mocked(svc.listStores).mockResolvedValue([ownedStore]);
    vi.mocked(svc.removeOwnedStore).mockRejectedValue(
      new Error("Network error"),
    );
    seedOwner();
    act(() => useAuthStore.getState().setActiveStoreId(null));
    renderPage();

    await waitFor(() =>
      screen.getByTestId(`btn-delete-store-${ownedStore.store_id}`),
    );
    await user.click(
      screen.getByTestId(`btn-delete-store-${ownedStore.store_id}`),
    );
    await user.click(screen.getByTestId("btn-confirm-delete-store"));

    await waitFor(() => screen.getByTestId("alert-store-error"));
    expect(screen.getByTestId("alert-store-error")).toHaveTextContent(
      "Network error",
    );
  });

  // ── T062: React Query auto-fetch + Aktifkan button ─────────────────────────

  it("fetches fresh store list on mount (simulates stale localStorage refresh scenario)", async () => {
    // With React Query, stores are never in localStorage — listStores() is always called.
    // This test ensures both stores from the server are shown regardless of prior state.
    vi.mocked(svc.listStores).mockResolvedValue([ownedStore, joinedStore]);
    seedOwner();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Toko Sendiri")).toBeInTheDocument();
      expect(screen.getByText("Toko Orang Lain")).toBeInTheDocument();
    });
    expect(svc.listStores).toHaveBeenCalledTimes(1);
  });

  it("refetches store list after createStore so NavBar cache is invalidated", async () => {
    const user = userEvent.setup();
    const newStore: StoreRecord = {
      store_id: "store-new",
      store_name: "Toko Baru",
      master_spreadsheet_id: "master-new",
      drive_folder_id: "folder-new",
      owner_email: OWNER_EMAIL,
      my_role: "owner",
      joined_at: "2026-03-01T00:00:00Z",
    };
    vi.mocked(svc.listStores)
      .mockResolvedValueOnce([ownedStore])
      .mockResolvedValueOnce([ownedStore, newStore]);
    vi.mocked(svc.createStore).mockResolvedValue(undefined);
    seedOwner();
    renderPage();

    await waitFor(() => screen.getByTestId("btn-add-store"));
    await user.click(screen.getByTestId("btn-add-store"));
    await user.type(screen.getByTestId("input-store-name"), "Toko Baru");
    await user.click(screen.getByTestId("btn-save-store"));

    // After mutation, invalidateQueries triggers a refetch → listStores called twice
    await waitFor(() => expect(svc.listStores).toHaveBeenCalledTimes(2));
    await waitFor(() => screen.getByText("Toko Baru"));
  });

  it("refetches store list after updateStore so renamed store is visible", async () => {
    const user = userEvent.setup();
    const renamedStore = { ...ownedStore, store_name: "Toko Ganti Nama" };
    vi.mocked(svc.listStores)
      .mockResolvedValueOnce([ownedStore, joinedStore])
      .mockResolvedValueOnce([renamedStore, joinedStore]);
    vi.mocked(svc.updateStore).mockResolvedValue(undefined);
    seedOwner();
    renderPage();

    await waitFor(() =>
      screen.getByTestId(`btn-edit-store-${ownedStore.store_id}`),
    );
    await user.click(
      screen.getByTestId(`btn-edit-store-${ownedStore.store_id}`),
    );
    const input = screen.getByTestId("input-store-name-edit");
    await user.clear(input);
    await user.type(input, "Toko Ganti Nama");
    await user.click(screen.getByTestId("btn-save-store-edit"));

    // After mutation, invalidateQueries triggers a refetch
    await waitFor(() => expect(svc.listStores).toHaveBeenCalledTimes(2));
    await waitFor(() => screen.getByText("Toko Ganti Nama"));
  });

  it("shows Aktifkan button only for inactive stores", async () => {
    vi.mocked(svc.listStores).mockResolvedValue([ownedStore, joinedStore]);
    seedOwner(); // activeStoreId = ownedStore.store_id
    renderPage();

    await waitFor(() =>
      screen.getByTestId(`btn-activate-store-${joinedStore.store_id}`),
    );
    expect(
      screen.queryByTestId(`btn-activate-store-${ownedStore.store_id}`),
    ).toBeNull();
  });

  it("calls activateStore and syncs activeStoreId when Aktifkan is clicked", async () => {
    const { activateStore } = await import("../modules/auth/setup.service");
    const user = userEvent.setup();
    vi.mocked(svc.listStores).mockResolvedValue([ownedStore, joinedStore]);
    seedOwner();
    renderPage();

    await waitFor(() =>
      screen.getByTestId(`btn-activate-store-${joinedStore.store_id}`),
    );
    await user.click(
      screen.getByTestId(`btn-activate-store-${joinedStore.store_id}`),
    );

    await waitFor(() =>
      expect(activateStore).toHaveBeenCalledWith(joinedStore),
    );
    expect(useAuthStore.getState().activeStoreId).toBe(joinedStore.store_id);
  });

  it("shows error Alert when activateStore fails", async () => {
    const setupModule = await import("../modules/auth/setup.service");
    vi.mocked(setupModule.activateStore).mockRejectedValueOnce(
      new Error("Activate failed"),
    );
    const user = userEvent.setup();
    vi.mocked(svc.listStores).mockResolvedValue([ownedStore, joinedStore]);
    seedOwner();
    renderPage();

    await waitFor(() =>
      screen.getByTestId(`btn-activate-store-${joinedStore.store_id}`),
    );
    await user.click(
      screen.getByTestId(`btn-activate-store-${joinedStore.store_id}`),
    );

    await waitFor(() => screen.getByTestId("alert-store-error"));
    expect(screen.getByTestId("alert-store-error")).toHaveTextContent(
      "Activate failed",
    );
  });
});
