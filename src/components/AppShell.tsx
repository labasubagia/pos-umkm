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
 *     are available to pre-populate IndexedDB from Google Sheets. After
 *     hydration completes, only React Query caches for the current store are
 *     invalidated (predicate: queryKey[1] === activeStoreId).
 *
 * Race condition guard (T074):
 *   A generation counter prevents a stale in-flight hydrateAll() from calling
 *   invalidateQueries() after the user has already switched to a different store.
 *   Only the most-recent hydration call is allowed to trigger invalidation.
 */
import { useEffect, useRef } from 'react'
import { Outlet } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { NavBar } from './NavBar'
import { BottomNav } from './BottomNav'
import { SyncStatus } from './SyncStatus'
import { reinitDexieLayer, hydrationService, syncManager } from '../lib/adapters'
import { useAuthStore } from '../store/authStore'

export function AppShell() {
  const { spreadsheetId, mainSpreadsheetId, monthlySpreadsheetId, activeStoreId } = useAuthStore()
  const queryClient = useQueryClient()

  // Track the last storeId for which we called reinitDexieLayer so we only
  // reinit when the active store actually changes (not on every monthly rollover).
  const lastInitStoreId = useRef<string | null>(null)

  // Generation counter: incremented on every effect run. Compared inside the
  // .then() callback — if the generation no longer matches, the hydration result
  // is for a store we've already left and must be discarded (T074).
  const hydrateGen = useRef(0)

  useEffect(() => {
    if (!spreadsheetId || !mainSpreadsheetId || !activeStoreId) return

    // Reinit the per-store Dexie layer only when the active store changes.
    // This ensures hydrationService always targets the correct IndexedDB before
    // hydrateAll() is called.
    if (activeStoreId !== lastInitStoreId.current) {
      syncManager.triggerSync()
      reinitDexieLayer(activeStoreId)
      lastInitStoreId.current = activeStoreId
    }

    const gen = ++hydrateGen.current
    const storeIdAtLaunch = activeStoreId

    void hydrationService
      .hydrateAll(mainSpreadsheetId, spreadsheetId, monthlySpreadsheetId ?? '')
      .then(() => {
        // Discard result if the user switched stores before this hydration finished.
        if (gen !== hydrateGen.current) return
        // Scope invalidation to the current store only — avoids nuking
        // unrelated caches like ['stores'] or date-range reports (T076).
        void queryClient.invalidateQueries({
          predicate: (query) =>
            Array.isArray(query.queryKey) && query.queryKey[1] === storeIdAtLaunch,
        })
      })
  }, [spreadsheetId, mainSpreadsheetId, monthlySpreadsheetId, activeStoreId, queryClient])

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
