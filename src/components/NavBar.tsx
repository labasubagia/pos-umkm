/**
 * NavBar — role-aware top navigation bar.
 *
 * Mobile (< md): shows only the logo and sign-out button.
 * md+: shows logo, role-filtered nav links, store picker (owner, 2+ stores), username, sign-out.
 *
 * Navigation on mobile is handled by BottomNav (see AppShell).
 *
 * syncStatusSlot: optional ReactNode rendered between the store picker and the user info.
 * AppShell passes <SyncStatus /> here so the offline badge appears in the navbar.
 */

import { LogOut, Store } from "lucide-react";
import type { ReactNode } from "react";
import { NavLink, useLocation, useNavigate, useParams } from "react-router-dom";
import { useStores } from "../hooks/useStores";
import { authAdapter, resetDexieLayer, syncManager } from "../lib/adapters";
import type { Role } from "../lib/adapters/types";
import { queryClient } from "../lib/queryClient";
import {
  activateStore,
  clearSetupStorage,
} from "../modules/auth/setup.service";
import { useAuth } from "../modules/auth/useAuth";
import { NAV_ITEMS } from "./nav.constants";
import { Button } from "./ui/button";

const ROLE_RANK: Record<Role, number> = {
  cashier: 1,
  manager: 2,
  owner: 3,
};

interface NavBarProps {
  syncStatusSlot?: ReactNode;
}

export function NavBar({ syncStatusSlot }: NavBarProps = {}) {
  const { user, role, activeStoreId, clearAuth, setStoreSession } = useAuth();
  const { data: stores = [] } = useStores();
  const navigate = useNavigate();
  const location = useLocation();
  const { storeId } = useParams<{ storeId: string }>();

  const visibleItems = NAV_ITEMS.filter(
    (item) => role && ROLE_RANK[role] >= ROLE_RANK[item.minRole],
  );

  const showStorePicker = role === "owner" && stores.length >= 2;

  // Determine the active top-level section so we can show its sub-nav items.
  // The URL is the authoritative source; strip the /:storeId prefix to get the
  // relative path (e.g. "catalog/products") and match against NAV_ITEMS[].to.
  const storeBase = storeId ? `/${storeId}/` : "/";
  const relPath = location.pathname.startsWith(storeBase)
    ? location.pathname.slice(storeBase.length)
    : location.pathname.slice(1); // fallback: strip leading slash
  const activeNavItem = visibleItems.find(
    ({ to }) => relPath === to || relPath.startsWith(`${to}/`),
  );
  const activeSubItems = (activeNavItem?.children ?? []).filter(
    ({ minRole: itemMinRole }) =>
      role && ROLE_RANK[role] >= ROLE_RANK[itemMinRole],
  );

  async function handleSignOut() {
    syncManager.triggerSync();
    await authAdapter.signOut();
    resetDexieLayer(); // Release IndexedDB connections and clear DB cache (T075)
    clearAuth();
    clearSetupStorage();
    queryClient.clear();
    navigate("/", { replace: true });
  }

  async function handleStoreChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const storeId = e.target.value;
    const store = stores.find((s) => s.store_id === storeId);
    if (!store || store.store_id === activeStoreId) return;
    try {
      const session = await activateStore(store);
      setStoreSession(
        session.spreadsheetId,
        session.monthlySpreadsheetId,
        storeId,
      );
      // Navigate to the new store's cashier — updates the URL so :storeId matches.
      navigate(`/${storeId}/cashier`);
    } catch {
      // Silent — store picker reverts visually on next render
    }
  }

  return (
    <header className="shrink-0" data-testid="navbar">
      {/* Primary nav row */}
      <div className="bg-white border-b mx-auto max-w-6xl h-14 md:h-16 flex items-center px-4 gap-2">
        {/* Logo / app name */}
        <span
          className="font-bold text-blue-600 text-lg shrink-0"
          data-testid="navbar-logo"
        >
          POS UMKM
        </span>

        {/* Nav links — hidden on mobile, shown on md+ */}
        <nav
          className="hidden md:flex gap-1 flex-1 ml-2"
          data-testid="navbar-nav"
        >
          {visibleItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} data-testid={`nav-${to}`}>
              {({ isActive }) => (
                <Button variant={isActive ? "secondary" : "ghost"} size="sm">
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="hidden lg:inline">{label}</span>
                </Button>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Spacer so logout stays right-aligned on mobile */}
        <div className="flex-1 md:hidden" />

        {/* Store picker — owner with 2+ stores */}
        {showStorePicker && (
          <div
            className="flex items-center gap-1 shrink-0"
            data-testid="store-picker"
          >
            <Store className="h-4 w-4 text-gray-500 hidden sm:block" />
            <select
              value={activeStoreId ?? ""}
              onChange={(e) => void handleStoreChange(e)}
              className="text-sm border border-input rounded-md px-2 py-1 bg-background focus:outline-none focus:ring-2 focus:ring-ring max-w-[160px] truncate"
              data-testid="select-store"
              aria-label="Pilih toko"
            >
              {stores.map((store) => (
                <option key={store.store_id} value={store.store_id}>
                  {store.store_name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Sync status indicator (google adapter only) */}
        {syncStatusSlot}

        {/* User info + sign-out */}
        {user && (
          <div className="flex items-center gap-2 shrink-0">
            <span
              className="text-sm text-gray-600 hidden lg:inline"
              data-testid="navbar-username"
            >
              {user?.name ?? user?.email}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              data-testid="btn-logout"
              aria-label="Keluar"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        )}
      </div>

      {/* Sub-nav row — shown when the active section has sub-items */}
      {activeSubItems.length > 0 && (
        <div className="bg-white border-b" data-testid="subnav">
          <div className="mx-auto max-w-6xl px-4 flex overflow-x-auto">
            {activeSubItems.map(({ to, label, testId }) => (
              <NavLink
                key={to}
                to={to}
                end
                data-testid={testId}
                className="whitespace-nowrap"
              >
                {({ isActive }) => (
                  <span
                    className={`block px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                      isActive
                        ? "border-blue-600 text-blue-600"
                        : "border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300"
                    }`}
                  >
                    {label}
                  </span>
                )}
              </NavLink>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
