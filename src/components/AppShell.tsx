/**
 * AppShell — authenticated page layout.
 *
 * Renders NavBar on top and the current route's page content via <Outlet />.
 * On mobile (< md) a fixed BottomNav is rendered at the bottom; the main
 * area gets pb-16 (=4rem) to prevent content from being hidden behind it.
 * On md+ the BottomNav is display:none and the padding is removed.
 *
 * Also mounts the offline-first sync layer:
 *   - SyncManager.start() is called once to begin draining the outbox and
 *     listening for connectivity changes.
 *   - HydrationService.hydrateAll() is called once after the spreadsheet IDs
 *     are available to pre-populate IndexedDB from Google Sheets.
 */
import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { NavBar } from './NavBar'
import { BottomNav } from './BottomNav'
import { SyncStatus } from './SyncStatus'
import { reinitDexieLayer, hydrationService } from '../lib/adapters'
import { useAuthStore } from '../store/authStore'

export function AppShell() {
  const { spreadsheetId, mainSpreadsheetId, monthlySpreadsheetId, activeStoreId } = useAuthStore()

  // Re-initialize the per-store Dexie layer when the active store changes.
  // reinitDexieLayer stops the old SyncManager, creates a new one backed by
  // the store's own IndexedDB, and starts it.
  useEffect(() => {
    if (!activeStoreId) return
    reinitDexieLayer(activeStoreId)
  }, [activeStoreId])

  useEffect(() => {
    // Trigger hydration once all three spreadsheet IDs are resolved.
    // Safe to call multiple times — HydrationService skips recently-hydrated tables.
    if (!spreadsheetId || !mainSpreadsheetId) return
    void hydrationService.hydrateAll(
      mainSpreadsheetId,
      spreadsheetId,
      monthlySpreadsheetId ?? '',
    )
  }, [spreadsheetId, mainSpreadsheetId, monthlySpreadsheetId, activeStoreId])

  return (
    <div className="min-h-screen flex flex-col bg-gray-50" data-testid="app-shell">
      <NavBar syncStatusSlot={<SyncStatus />} />
      <main
        className="flex-1 flex flex-col pb-16 md:pb-0"
        data-testid="main-content"
      >
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
