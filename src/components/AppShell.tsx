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

import { useEffect, useRef, useState } from "react";
import { Outlet, useParams } from "react-router";
import { StoreRegistryService } from "@/api";
import {
  hydrationService,
  reinitDexieLayer,
  storeFolderService,
  syncManager,
} from "../api/adapters";
import { pendingActivations } from "../api/services/StoreActivationService";
import { useAuthStore } from "../store/authStore";
import { getStoreMapStore } from "../store/storeMapStore";
import { logger } from "../utils/logger";
import { BottomNav } from "./BottomNav";
import { NavBar } from "./NavBar";
import { SyncStatus } from "./SyncStatus";

export function AppShell() {
  const { activeStoreId, setActiveStoreId } = useAuthStore();
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

    // Wait for both the store map and the initial hydration before showing
    // page content. Hydration populates IndexedDB from Google Sheets so
    // components never render with stale/empty Dexie data.
    // The generation guard (T074) discards the result if the user switches
    // stores before this resolves.
    void ensureStoreMapReady(storeIdAtLaunch).then(async () => {
      if (gen !== hydrateGen.current) return;
      await hydrationService.hydrateAll();
      if (gen !== hydrateGen.current) return;
      setStoreMapReady(true);
    });
  }, [activeStoreId]);

  if (!storeMapReady) {
    return (
      <div
        className="min-h-screen flex flex-col bg-gray-50"
        data-testid="app-shell"
      >
        <NavBar syncStatusSlot={<SyncStatus />} />
        <div className="flex-1 flex items-center justify-center flex-col gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Memuat data toko…</p>
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
 * On first activation the map is populated by activateStore(). On page
 * refresh the keyed persisted store map is reopened for the URL-selected
 * store, but sheets may be empty — this function traverses the Drive folder
 * to populate them.
 */
async function ensureStoreMapReady(storeId: string): Promise<void> {
  // If activateStore() is still in-flight for this store (triggered by NavBar
  // or StoreManagementPage before navigate()), await it first so we don't
  // race with a concurrent Drive traversal and hydrate with an empty sheet map.
  const pending = pendingActivations.get(storeId);
  if (pending) {
    try {
      await pending;
    } catch {
      // activateStore failed — fall through to attempt our own traversal below
    }
    // Store map was populated by activateStore; nothing more to do.
    const storeMapAfterActivation = getStoreMapStore(storeId).getState();
    const afterCount = Object.keys(
      storeMapAfterActivation.monthlySheets,
    ).reduce(
      (acc, year) =>
        acc +
        Object.keys(storeMapAfterActivation.monthlySheets[Number(year)] ?? {})
          .length,
      0,
    );
    if (
      Object.keys(storeMapAfterActivation.sheets).length > 0 ||
      afterCount > 0
    )
      return;
  }

  const storeMap = getStoreMapStore(storeId).getState();

  // Sheets empty — use the active store map's persisted folder ID so refresh
  // cannot accidentally traverse a different store's folder.
  const storeFolderId =
    storeMap.storeFolderId ??
    (await StoreRegistryService.getStoreFolderId(storeId));
  if (!storeFolderId) {
    logger.warn(
      "[AppShell] storeFolderId not found in active store map — cannot traverse Drive folder.",
    );
    return;
  }

  try {
    const result = await storeFolderService.traverse(storeFolderId);
    storeMap.setStoreMap(storeFolderId, result.sheets, result.monthlySheets);
  } catch (err) {
    logger.warn("[AppShell] Failed to traverse store folder on refresh:", err);
  }
}
