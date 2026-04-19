/**
 * BottomNav — mobile bottom navigation bar.
 *
 * Visible only on small screens (< md = 768px); hidden on tablet/desktop
 * where the top NavBar provides navigation.
 *
 * Shows role-filtered nav items with icon + label. The active route is
 * highlighted. Uses the same ROLE_RANK and NAV_ITEMS list as NavBar so
 * both always stay in sync.
 *
 * data-testid: "bottom-nav-{route}" (distinct from NavBar's "nav-{route}"
 * to avoid duplicate testids in the DOM at desktop viewports where both
 * exist but BottomNav is hidden via display:none).
 */
import { NavLink } from 'react-router-dom'
import { useAuth } from '../modules/auth/useAuth'
import { NAV_ITEMS } from './NavBar'

const ROLE_RANK = { cashier: 1, manager: 2, owner: 3 } as const

export function BottomNav() {
  const { role } = useAuth()

  const visibleItems = NAV_ITEMS.filter(
    (item) => role && ROLE_RANK[role as keyof typeof ROLE_RANK] >= ROLE_RANK[item.minRole as keyof typeof ROLE_RANK],
  )

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t flex md:hidden z-40"
      data-testid="bottom-nav"
      aria-label="Navigasi utama"
    >
      {visibleItems.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          data-testid={`bottom-nav-${to.slice(1)}`}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors min-w-0"
        >
          {({ isActive }) => (
            <>
              <Icon
                className={`h-5 w-5 shrink-0 ${isActive ? 'text-blue-600' : 'text-gray-500'}`}
              />
              <span
                className={`truncate max-w-full px-0.5 ${isActive ? 'text-blue-600' : 'text-gray-500'}`}
              >
                {label}
              </span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
