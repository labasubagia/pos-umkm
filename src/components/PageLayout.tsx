/**
 * PageLayout — content container for standard authenticated pages.
 *
 * Applies consistent max-width, centering, and padding so individual pages
 * don't repeat these classes. CashierPage intentionally bypasses this layout
 * (it needs full-bleed flex to fill the viewport height).
 */
import { Outlet } from 'react-router-dom'

export function PageLayout() {
  return (
    <div className="mx-auto max-w-screen-xl w-full px-4 py-4 md:py-6">
      <Outlet />
    </div>
  )
}
