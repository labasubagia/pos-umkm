/**
 * syncStore.ts — Zustand store for offline sync status.
 *
 * Tracks:
 *   pendingCount    — number of outbox entries awaiting sync to Google Sheets
 *   isSyncing       — true while SyncManager is draining the outbox
 *   lastSyncedAt    — ISO 8601 UTC timestamp of the last successful drain completion
 *   lastError       — error message from the most recent failed sync attempt
 *   lastHydratedAt  — epoch ms timestamp set by HydrationService after hydrateAll()
 *                     resolves; page-level useEffects depend on this to re-fetch
 *                     module data after the IndexedDB cache is freshly populated
 *
 * This store is updated by SyncManager / HydrationService and read by
 * SyncStatus (UI) and page components. Not persisted — rehydrates from the
 * _outbox table on startup.
 */
import { create } from "zustand";

interface SyncState {
  pendingCount: number;
  isSyncing: boolean;
  lastSyncedAt: string | null;
  lastError: string | null;
  lastHydratedAt: number | null;

  setPendingCount: (count: number) => void;
  setIsSyncing: (v: boolean) => void;
  setLastSyncedAt: (ts: string) => void;
  setLastError: (msg: string | null) => void;
  setLastHydratedAt: (ts: number) => void;
}

export const useSyncStore = create<SyncState>()((set) => ({
  pendingCount: 0,
  isSyncing: false,
  lastSyncedAt: null,
  lastError: null,
  lastHydratedAt: null,

  setPendingCount: (count) => set({ pendingCount: count }),
  setIsSyncing: (v) => set({ isSyncing: v }),
  setLastSyncedAt: (ts) => set({ lastSyncedAt: ts }),
  setLastError: (msg) => set({ lastError: msg }),
  setLastHydratedAt: (ts) => set({ lastHydratedAt: ts }),
}));
