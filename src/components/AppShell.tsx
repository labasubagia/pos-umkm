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
 *   - Store map is loaded (from localStorage or via Drive traversal) before
 *     HydrationService.hydrateAll() runs, so it always has spreadsheet IDs.
 *   - HydrationService.hydrateAll() is called once after the store map is
 *     available to pre-populate IndexedDB from Google Sheets. After
 *     hydration completes, only React Query caches for the current store are
 *     invalidated (predicate: queryKey[1] === activeStoreId).
 *
 * Race condition guard (T074):
 *   A generation counter prevents a stale in-flight hydrateAll() from calling
 *   invalidateQueries() after the user has already switched to a different store.
 *   Only the most-recent hydration call is allowed to trigger invalidation.
 */

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Outlet, useParams } from "react-router-dom";
import {
  hydrationService,
  reinitDexieLayer,
  storeFolderService,
  syncManager,
} from "../lib/adapters";
import { useAuthStore } from "../store/authStore";
import { getActiveStoreMap, setActiveStoreMap } from "../store/storeMapStore";
import { BottomNav } from "./BottomNav";
import { NavBar } from "./NavBar";
import { SyncStatus } from "./SyncStatus";

export function AppShell() {
  const { activeStoreId, setActiveStoreId } = useAuthStore();
  const queryClient = useQueryClient();
  const { storeId: urlStoreId } = useParams<{ storeId: string }>();
  const [storeMapReady, setStoreMapReady] = useState(false);

  // URL is authoritative: sync :storeId from the URL into the Zustand store
  // so all hooks that read activeStoreId stay consistent with the browser URL.
  useEffect(() => {
    if (urlStoreId && urlStoreId !== activeStoreId) {
      setActiveStoreId(urlStoreId);
    }
  }, [urlStoreId, activeStoreId, setActiveStoreId]);

  // Track the last storeId for which we called reinitDexieLayer so we only
  // reinit when the active store actually changes (not on every monthly rollover).
  const lastInitStoreId = useRef<string | null>(null);

  // Generation counter: incremented on every effect run. Compared inside the
  // .then() callback — if the generation no longer matches, the hydration result
  // is for a store we've already left and must be discarded (T074).
  const hydrateGen = useRef(0);

  useEffect(() => {
    if (!activeStoreId) return;
    setStoreMapReady(false);

    // Reinit the per-store Dexie layer only when the active store changes.
    // This ensures hydrationService always targets the correct IndexedDB before
    // hydrateAll() is called.
    if (activeStoreId !== lastInitStoreId.current) {
      syncManager.triggerSync();
      reinitDexieLayer(activeStoreId);
      lastInitStoreId.current = activeStoreId;
    }

    const gen = ++hydrateGen.current;
    const storeIdAtLaunch = activeStoreId;

    // Ensure the store map is initialized and populated before rendering children.
    // On page refresh, getActiveStoreMap() auto-initializes from localStorage
    // but the sheets may be empty if no traversal happened in this session.
    // In that case, traverse the Drive folder to populate the map.
    void ensureStoreMapReady(storeIdAtLaunch)
      .then(() => {
        if (gen !== hydrateGen.current) return;
        setStoreMapReady(true);
        return hydrationService.hydrateAll();
      })
      .then(() => {
        if (gen !== hydrateGen.current) return;
        void queryClient.invalidateQueries({
          predicate: (query) =>
            Array.isArray(query.queryKey) &&
            query.queryKey[1] === storeIdAtLaunch,
        });
      });
  }, [activeStoreId, queryClient]);

  if (!storeMapReady) {
    return (
      <div
        className="min-h-screen flex flex-col bg-gray-50"
        data-testid="app-shell"
      >
        <NavBar syncStatusSlot={<SyncStatus />} />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Memuat data toko…</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col bg-gray-50"
      data-testid="app-shell"
    >
      <NavBar syncStatusSlot={<SyncStatus />} />
      <main
        className="flex-1 flex flex-col pb-16 md:pb-0"
        data-testid="main-content"
      >
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}

/**
 * Ensures the store map is initialized and has sheet data.
 * On first activation the map is populated by activateStore().
 * On page refresh the map is auto-initialized from localStorage by
 * getActiveStoreMap(), but sheets may be empty — this function traverses
 * the Drive folder to populate them.
 */
async function ensureStoreMapReady(storeId: string): Promise<void> {
  setActiveStoreMap(storeId);
  const storeMap = getActiveStoreMap().getState();

  // Already populated (e.g. from a recent activateStore call)
  if (
    Object.keys(storeMap.sheets).length > 0 ||
    storeMap.monthlySheets.length > 0
  )
    return;

  // Sheets empty — read the store folder ID from localStorage and traverse.
  const storeFolderId = localStorage.getItem("storeFolderId");
  if (!storeFolderId) {
    console.warn(
      "[AppShell] storeFolderId not found — cannot traverse Drive folder.",
    );
    return;
  }

  try {
    const result = await storeFolderService.traverse(storeFolderId);
    storeMap.setStoreMap(storeFolderId, result.sheets, result.monthlySheets);
  } catch (err) {
    console.warn("[AppShell] Failed to traverse store folder on refresh:", err);
  }
}
