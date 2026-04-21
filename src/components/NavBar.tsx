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
import { type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { LogOut, Store } from 'lucide-react'
import { useAuth } from '../modules/auth/useAuth'
import { clearSetupStorage } from '../modules/auth/setup.service'
import { authAdapter, resetDexieLayer, syncManager } from '../lib/adapters'
import { activateStore } from '../modules/auth/setup.service'
import type { Role } from '../lib/adapters/types'
import { Button } from './ui/button'
import { NAV_ITEMS } from './nav.constants'
import { useStores } from '../hooks/useStores'
import { queryClient } from '../lib/queryClient'

const ROLE_RANK: Record<Role, number> = {
  cashier: 1,
  manager: 2,
  owner: 3,
}

interface NavBarProps {
  syncStatusSlot?: ReactNode
}

export function NavBar({ syncStatusSlot }: NavBarProps = {}) {
  const { user, role, activeStoreId, clearAuth, setStoreSession } = useAuth()
  const { data: stores = [] } = useStores()
  const navigate = useNavigate()

  const visibleItems = NAV_ITEMS.filter(
    (item) => role && ROLE_RANK[role] >= ROLE_RANK[item.minRole],
  )

  const showStorePicker = role === 'owner' && stores.length >= 2

  async function handleSignOut() {
    syncManager.triggerSync()
    await authAdapter.signOut()
    resetDexieLayer()  // Release IndexedDB connections and clear DB cache (T075)
    clearAuth()
    clearSetupStorage()
    queryClient.clear()
    navigate('/', { replace: true })
  }

  async function handleStoreChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const storeId = e.target.value
    const store = stores.find((s) => s.store_id === storeId)
    if (!store || store.store_id === activeStoreId) return
    try {
      const session = await activateStore(store)
      setStoreSession(session.spreadsheetId, session.monthlySpreadsheetId, storeId)
      // Stay on the current page — AppShell re-hydrates Dexie for the new store.
    } catch {
      // Silent — store picker reverts visually on next render
    }
  }

  return (
    <header
      className="shrink-0"
      data-testid="navbar"
    >
      <div className="bg-white border-b mx-auto max-w-6xl h-14 md:h-16 flex items-center px-4 gap-2">
        {/* Logo / app name */}
        <span
          className="font-bold text-blue-600 text-lg shrink-0"
          data-testid="navbar-logo"
        >
          POS UMKM
        </span>

        {/* Nav links — hidden on mobile, shown on md+ */}
        <nav className="hidden md:flex gap-1 flex-1 ml-2" data-testid="navbar-nav">
          {visibleItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              data-testid={`nav-${to.slice(1)}`}
            >
              {({ isActive }) => (
                <Button variant={isActive ? 'secondary' : 'ghost'} size="sm">
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
          <div className="flex items-center gap-1 shrink-0" data-testid="store-picker">
            <Store className="h-4 w-4 text-gray-500 hidden sm:block" />
            <select
              value={activeStoreId ?? ''}
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
              <LogOut className="h-4 w-4" />
              <span className="hidden md:inline">Keluar</span>
            </Button>
          </div>
        )}
      </div>
    </header>
  )
}
