/**
 * T048 — NavBar unit tests
 *
 * Verifies role-filtered nav links, logo, username display,
 * sign-out behaviour, unauthenticated state, and store-switch behaviour.
 *
 * authAdapter.signOut is mocked so no real OAuth calls are made.
 * useNavigate is mocked because NavBar calls navigate('/') on sign-out.
 * activateStore (setup.service) is mocked for store-switch tests.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as useStoresModule from "../hooks/useStores";
import * as adapters from "../lib/adapters";
import type { Role } from "../lib/adapters/types";
import type { StoreRecord } from "../modules/auth/setup.service";
import { useAuthStore } from "../store/authStore";
import { NavBar } from "./NavBar";

vi.mock("../lib/adapters", () => ({
  authAdapter: {
    signOut: vi.fn().mockResolvedValue(undefined),
    signIn: vi.fn(),
    getCurrentUser: vi.fn(() => null),
    getAccessToken: vi.fn(() => null),
  },
  dataAdapter: {},
  resetDexieLayer: vi.fn(),
  syncManager: { triggerSync: vi.fn() },
}));

vi.mock("../modules/auth/setup.service", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../modules/auth/setup.service")>();
  return {
    ...actual,
    activateStore: vi.fn().mockImplementation((store) =>
      Promise.resolve({
        spreadsheetId: store.master_spreadsheet_id,
        monthlySpreadsheetId: null,
      }),
    ),
  };
});

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("../hooks/useStores", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../hooks/useStores")>();
  return {
    ...actual,
    useStores: vi.fn().mockReturnValue({ data: [], isLoading: false }),
  };
});

const store1: StoreRecord = {
  store_id: "store-1",
  store_name: "Toko 1",
  master_spreadsheet_id: "master-1",
  drive_folder_id: "folder-1",
  owner_email: "test@test.com",
  my_role: "owner",
  joined_at: "2026-01-01T00:00:00Z",
};
const store2: StoreRecord = {
  store_id: "store-2",
  store_name: "Toko 2",
  master_spreadsheet_id: "master-2",
  drive_folder_id: "folder-2",
  owner_email: "test@test.com",
  my_role: "owner",
  joined_at: "2026-02-01T00:00:00Z",
};

function setRole(role: Role, name = "Test User") {
  act(() => {
    useAuthStore
      .getState()
      .setUser({ id: "u1", email: "test@test.com", name, role }, role, "tok");
  });
}

let testQueryClient: QueryClient;

function renderNavBar(initialPath = "/cashier") {
  return render(
    <QueryClientProvider client={testQueryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <NavBar />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  testQueryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  useAuthStore.getState().clearAuth();
  vi.clearAllMocks();
  // Reset useStores mock to empty list by default
  vi.mocked(useStoresModule.useStores).mockReturnValue({
    data: [],
    isLoading: false,
  });
});

describe("NavBar", () => {
  it('renders logo text "POS UMKM"', () => {
    setRole("owner");
    renderNavBar();
    expect(screen.getByTestId("navbar-logo")).toHaveTextContent("POS UMKM");
  });

  it("owner sees all 6 nav links (Kasir, Katalog, Inventori, Pelanggan, Laporan, Pengaturan)", () => {
    setRole("owner");
    renderNavBar();
    expect(screen.getByTestId("navbar-nav").querySelectorAll("a")).toHaveLength(
      6,
    );
  });

  it("manager sees 5 nav links (not Pengaturan)", () => {
    setRole("manager");
    renderNavBar();
    expect(screen.getByTestId("navbar-nav").querySelectorAll("a")).toHaveLength(
      5,
    );
    expect(screen.queryByTestId("nav-settings")).toBeNull();
  });

  it("cashier sees only Kasir link", () => {
    setRole("cashier");
    renderNavBar();
    const links = screen.getByTestId("navbar-nav").querySelectorAll("a");
    expect(links).toHaveLength(1);
    expect(screen.getByTestId("nav-cashier")).toBeTruthy();
  });

  it('active route link has active styling (aria-current="page")', () => {
    setRole("owner");
    renderNavBar("/cashier");
    // React Router NavLink sets aria-current="page" on the active link
    expect(screen.getByTestId("nav-cashier")).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.queryByTestId("nav-catalog")).not.toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("renders username from auth store", () => {
    setRole("owner", "Budi Santoso");
    renderNavBar();
    expect(screen.getByTestId("navbar-username")).toHaveTextContent(
      "Budi Santoso",
    );
  });

  it("sign-out button calls authAdapter.signOut and clearAuth", async () => {
    const user = userEvent.setup();
    setRole("owner");
    renderNavBar();
    await user.click(screen.getByTestId("btn-logout"));
    expect(adapters.authAdapter.signOut).toHaveBeenCalledOnce();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
  });

  it("unauthenticated user sees no nav links and no username", () => {
    // No setRole — store starts cleared (no user)
    renderNavBar();
    expect(screen.getByTestId("navbar-nav").querySelectorAll("a")).toHaveLength(
      0,
    );
    expect(screen.queryByTestId("navbar-username")).toBeNull();
  });

  // ── T064: no /cashier redirect on store switch ────────────────────────────

  it("switching store calls activateStore and setActiveStoreId without navigating", async () => {
    const { activateStore } = await import("../modules/auth/setup.service");
    const user = userEvent.setup();
    setRole("owner");
    act(() => {
      useAuthStore.getState().setActiveStoreId(store1.store_id);
    });
    vi.mocked(useStoresModule.useStores).mockReturnValue({
      data: [store1, store2],
      isLoading: false,
    });
    renderNavBar("/reports");

    await user.selectOptions(screen.getByRole("combobox"), store2.store_id);

    await waitFor(() => expect(activateStore).toHaveBeenCalledWith(store2));
    expect(useAuthStore.getState().activeStoreId).toBe(store2.store_id);
    expect(mockNavigate).not.toHaveBeenCalledWith(
      "/cashier",
      expect.anything(),
    );
  });

  it("selecting the already-active store does nothing", async () => {
    const { activateStore } = await import("../modules/auth/setup.service");
    const user = userEvent.setup();
    setRole("owner");
    act(() => {
      useAuthStore.getState().setActiveStoreId(store1.store_id);
    });
    vi.mocked(useStoresModule.useStores).mockReturnValue({
      data: [store1, store2],
      isLoading: false,
    });
    renderNavBar();

    await user.selectOptions(screen.getByRole("combobox"), store1.store_id);

    expect(activateStore).not.toHaveBeenCalled();
  });
});
