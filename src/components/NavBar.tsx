/**
 * NavBar — role-aware top navigation bar.
 *
 * Mobile (< md): shows only the logo and sign-out button.
 * md+: shows logo, role-filtered nav links, username, sign-out.
 *
 * Navigation on mobile is handled by BottomNav (see AppShell).
 */
import { NavLink, useNavigate } from 'react-router-dom'
import {
  ShoppingCart,
  Package,
  Archive,
  Users,
  BarChart2,
  Settings,
  LogOut,
} from 'lucide-react'
import { useAuth } from '../modules/auth/useAuth'
import { authAdapter } from '../lib/adapters'
import type { Role } from '../lib/adapters/types'
import { Button } from './ui/button'

const ROLE_RANK: Record<Role, number> = {
  cashier: 1,
  manager: 2,
  owner: 3,
}

export const NAV_ITEMS = [
  { to: '/cashier', label: 'Kasir', icon: ShoppingCart, minRole: 'cashier' as Role },
  { to: '/catalog', label: 'Katalog', icon: Package, minRole: 'manager' as Role },
  { to: '/inventory', label: 'Inventori', icon: Archive, minRole: 'manager' as Role },
  { to: '/customers', label: 'Pelanggan', icon: Users, minRole: 'manager' as Role },
  { to: '/reports', label: 'Laporan', icon: BarChart2, minRole: 'manager' as Role },
  { to: '/settings', label: 'Pengaturan', icon: Settings, minRole: 'owner' as Role },
]

export function NavBar() {
  const { user, role, clearAuth } = useAuth()
  const navigate = useNavigate()

  const visibleItems = NAV_ITEMS.filter(
    (item) => role && ROLE_RANK[role] >= ROLE_RANK[item.minRole],
  )

  async function handleSignOut() {
    await authAdapter.signOut()
    clearAuth()
    navigate('/', { replace: true })
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
