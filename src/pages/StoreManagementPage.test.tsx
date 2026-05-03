/// <reference types="@testing-library/jest-dom" />

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
import type { StoreRecord } from "../api/adapters";
import { clearDbCache, getDb } from "../api/adapters/dexie/db";
import * as svc from "../modules/settings/store-management.service";
import { useAuthStore } from "../store/authStore";
import StoreManagementPage from "./StoreManagementPage";

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock(
  "../modules/settings/store-management.service",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("../modules/settings/store-management.service")
      >();
    return {
      ...actual, // keeps real listStores + StoreManagementError
      createStore: vi.fn(),
      updateStore: vi.fn(),
      removeOwnedStore: vi.fn(),
      removeAccessToStore: vi.fn(),
    };
  },
);

// Also mock the adapters module so getRepos() doesn't need a real Google token.
// DexieRepository reads from fake-indexeddb instead.
vi.mock("../api/adapters", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/adapters")>();
  return {
    ...actual,
    syncManager: { start: vi.fn(), stop: vi.fn(), triggerSync: vi.fn() },
  };
});

vi.mock("../api/services/MigrationService", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../api/services/MigrationService")>();
  return {
    ...actual,
  };
});

vi.mock("../api/services/StoreActivationService", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("../api/services/StoreActivationService")
    >();
  return {
    ...actual,
    StoreActivationService: {
      ...actual.StoreActivationService,
      activateStore: vi.fn().mockImplementation(() => Promise.resolve()),
    },
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
  drive_folder_id: "folder-owned",
  owner_email: OWNER_EMAIL,
  my_role: "owner",
  joined_at: "2026-01-01T00:00:00Z",
};

const joinedStore: StoreRecord = {
  store_id: "store-joined",
  store_name: "Toko Orang Lain",
  drive_folder_id: "folder-joined",
  owner_email: OTHER_EMAIL,
  my_role: "manager",
  joined_at: "2026-02-01T00:00:00Z",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Populate the Stores table in fake-indexeddb.
 * Stores are cross-store (global) — write to the __main__ DB, matching
 * the production path in createDexieRepos() and localCachePut("Stores",...). */
async function seedDexie(stores: StoreRecord[]) {
  const db = getDb("__main__");
  await db.Stores.clear();
  await db.Stores.bulkPut(stores.map((s) => ({ ...s, id: s.store_id })));
}

function seedOwner() {
  act(() => {
    useAuthStore
      .getState()
      .setUser(
        { id: "u1", email: OWNER_EMAIL, name: "Test Owner", role: "owner" },
        "owner",
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

beforeEach(async () => {
  // Clear Dexie for all storeIds tests might use.
  for (const id of [
    ownedStore.store_id,
    joinedStore.store_id,
    "another-store",
  ]) {
    await getDb(id).Stores.clear();
  }
  clearDbCache();
  useAuthStore.getState().clearAuth();
  vi.clearAllMocks();
  // Default: write functions succeed silently (each test overrides as needed).
  vi.mocked(svc.createStore).mockResolvedValue({} as StoreRecord);
  vi.mocked(svc.updateStore).mockResolvedValue(undefined);
  vi.mocked(svc.removeOwnedStore).mockResolvedValue(undefined);
  vi.mocked(svc.removeAccessToStore).mockResolvedValue(undefined);
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("StoreManagementPage", () => {
  it("renders store list with correct action buttons per ownership", async () => {
    await seedDexie([ownedStore, joinedStore]);
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
    await seedDexie([joinedStore]);
    seedOwner();
    renderPage();

    await waitFor(() => screen.getByText("Toko Orang Lain"));
    expect(
      screen.queryByTestId(`btn-delete-store-${joinedStore.store_id}`),
    ).toBeNull();
  });

  it("does not show Leave button for owned stores", async () => {
    await seedDexie([ownedStore]);
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
    await seedDexie([ownedStore]);
    vi.mocked(svc.createStore).mockImplementation(async () => {
      await getDb("__main__").Stores.put({
        ...newStore,
        id: newStore.store_id,
      });
      return newStore;
    });
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
    await seedDexie([ownedStore]);
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
    await seedDexie([ownedStore, joinedStore]);
    // Mock removeOwnedStore to also soft-delete from the __main__ Dexie store.
    vi.mocked(svc.removeOwnedStore).mockImplementation(async (storeId) => {
      await getDb("__main__").Stores.update(storeId, {
        deleted_at: "2026-01-01T00:00:00Z",
      });
    });
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
    await seedDexie([ownedStore, joinedStore]);
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
        joinedStore.store_id,
      );
    });
  });

  it("shows error Alert when createStore fails", async () => {
    const user = userEvent.setup();
    await seedDexie([ownedStore]);
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
    await seedDexie([ownedStore]);
    vi.mocked(svc.removeOwnedStore).mockRejectedValue(
      new Error("Network error"),
    );
    seedOwner();
    act(() => useAuthStore.getState().setActiveStoreId("another-store"));
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
    // With useLiveQuery, stores are read directly from Dexie on mount.
    // This test ensures both stores from Dexie are shown regardless of prior state.
    await seedDexie([ownedStore, joinedStore]);
    seedOwner();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Toko Sendiri")).toBeInTheDocument();
      expect(screen.getByText("Toko Orang Lain")).toBeInTheDocument();
    });
  });

  it("reflects new store in list after createStore (NavBar also auto-updates)", async () => {
    const user = userEvent.setup();
    const newStore: StoreRecord = {
      store_id: "store-new",
      store_name: "Toko Baru",
      drive_folder_id: "folder-new",
      owner_email: OWNER_EMAIL,
      my_role: "owner",
      joined_at: "2026-03-01T00:00:00Z",
    };
    await seedDexie([ownedStore]);
    // Mock createStore to write to __main__ Dexie so useLiveQuery auto-updates the list.
    vi.mocked(svc.createStore).mockImplementation(async () => {
      await getDb("__main__").Stores.put({
        ...newStore,
        id: newStore.store_id,
      });
      return newStore;
    });
    seedOwner();
    renderPage();

    await waitFor(() => screen.getByTestId("btn-add-store"));
    await user.click(screen.getByTestId("btn-add-store"));
    await user.type(screen.getByTestId("input-store-name"), "Toko Baru");
    await user.click(screen.getByTestId("btn-save-store"));

    await waitFor(() => {
      expect(svc.createStore).toHaveBeenCalledWith("Toko Baru");
    });
    // useLiveQuery automatically re-renders when Dexie is updated.
    await waitFor(() => screen.getByText("Toko Baru"));
  });

  it("reflects renamed store in list after updateStore (useLiveQuery auto-updates)", async () => {
    const user = userEvent.setup();
    await seedDexie([ownedStore, joinedStore]);
    // Mock updateStore to also update __main__ Dexie so useLiveQuery reflects the rename.
    vi.mocked(svc.updateStore).mockImplementation(async (storeId, changes) => {
      await getDb("__main__").Stores.update(storeId, changes);
    });
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

    // useLiveQuery automatically re-renders when Dexie is updated.
    await waitFor(() => screen.getByText("Toko Ganti Nama"));
  });

  it("shows Aktifkan button only for inactive stores", async () => {
    await seedDexie([ownedStore, joinedStore]);
    seedOwner(); // activeStoreId = ownedStore.store_id
    renderPage();

    await waitFor(() =>
      screen.getByTestId(`btn-activate-store-${joinedStore.store_id}`),
    );
    expect(
      screen.queryByTestId(`btn-activate-store-${ownedStore.store_id}`),
    ).toBeNull();
  });

  it("calls activateStore and navigates to new store when Aktifkan is clicked", async () => {
    const { StoreActivationService } = await import(
      "../api/services/StoreActivationService"
    );
    const activateStore = StoreActivationService.activateStore;
    const user = userEvent.setup();
    await seedDexie([ownedStore, joinedStore]);
    seedOwner();
    renderPage();

    await waitFor(() =>
      screen.getByTestId(`btn-activate-store-${joinedStore.store_id}`),
    );
    await user.click(
      screen.getByTestId(`btn-activate-store-${joinedStore.store_id}`),
    );

    // navigate is called first (before activateStore awaits), then activateStore runs.
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(
        `/${joinedStore.store_id}/cashier`,
      ),
    );
    await waitFor(() =>
      expect(activateStore).toHaveBeenCalledWith(joinedStore),
    );
  });

  it("shows error Alert when activateStore fails", async () => {
    const { StoreActivationService } = await import(
      "../api/services/StoreActivationService"
    );
    vi.mocked(StoreActivationService.activateStore).mockRejectedValueOnce(
      new Error("Activate failed"),
    );
    const user = userEvent.setup();
    await seedDexie([ownedStore, joinedStore]);
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
