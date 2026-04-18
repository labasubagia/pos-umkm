/**
 * AppShell — authenticated page layout.
 *
 * Renders the NavBar on top and the current route's page content below via
 * React Router's <Outlet />. Used as a layout route in router.tsx so all
 * protected pages automatically get the navigation without repeating the
 * NavBar import in every page component.
 *
 * The outer div is min-h-screen flex-col so the main area fills remaining
 * viewport height, which each page can further divide as needed (e.g.
 * CashierPage uses h-[calc(100vh-4rem)] to fill exactly below the 4rem bar).
 */
import { Outlet } from 'react-router-dom'
import { NavBar } from './NavBar'

export function AppShell() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50" data-testid="app-shell">
      <NavBar />
      <main className="flex-1 flex flex-col" data-testid="main-content">
        <Outlet />
      </main>
    </div>
  )
}
