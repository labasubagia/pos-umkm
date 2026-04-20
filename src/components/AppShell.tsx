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
import { useEffect, useRef } from 'react'
import { Outlet } from 'react-router-dom'
import { NavBar } from './NavBar'
import { BottomNav } from './BottomNav'
import { SyncStatus } from './SyncStatus'
import { reinitDexieLayer, hydrationService } from '../lib/adapters'
import { useAuthStore } from '../store/authStore'

export function AppShell() {
  const { spreadsheetId, mainSpreadsheetId, monthlySpreadsheetId, activeStoreId } = useAuthStore()

  // Track the last storeId for which we called reinitDexieLayer so we only
  // reinit when the active store actually changes (not on every monthly rollover).
  const lastInitStoreId = useRef<string | null>(null)

  useEffect(() => {
    if (!spreadsheetId || !mainSpreadsheetId || !activeStoreId) return

    // Reinit the per-store Dexie layer only when the active store changes.
    // This ensures hydrationService always targets the correct IndexedDB before
    // hydrateAll() is called.
    if (activeStoreId !== lastInitStoreId.current) {
      reinitDexieLayer(activeStoreId)
      lastInitStoreId.current = activeStoreId
    }

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
