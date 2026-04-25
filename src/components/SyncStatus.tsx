/**
 * SyncStatus.tsx — Offline sync status indicator.
 *
 * Shows:
 *   - A cloud-with-check icon and "Tersinkron" when everything is synced
 *   - A spinning sync icon and count badge when writes are pending/syncing
 *   - A cloud-off icon and error tooltip when the last sync failed
 *   - A cloud-off icon when the device is offline
 *
 * SyncStatus — shows the offline/syncing/synced status indicator in the NavBar.
 * Reads from useSyncStore — no props needed.
 */

import { CheckCircle, CloudOff, CloudUpload, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { syncManager } from "../lib/adapters";
import { formatDateTimeTZ } from "../lib/formatters";
import { cn } from "../lib/utils";
import { useSyncStore } from "../store/syncStore";

export function SyncStatus() {
  const { pendingCount, isSyncing, lastSyncedAt, lastError } = useSyncStore();
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const handleManualSync = () => {
    console.log("[SyncStatus] manual sync clicked", {
      pendingCount,
      isSyncing,
      lastError,
    });
    syncManager.triggerSync();
  };

  const hasPending = pendingCount > 0;

  if (!isOnline) {
    return (
      <button
        type="button"
        data-testid="sync-status-offline"
        onClick={handleManualSync}
        className="flex items-center text-muted-foreground"
        title="Offline — perubahan disimpan lokal"
      >
        <CloudOff className="h-5 w-5 text-orange-400" />
      </button>
    );
  }

  if (isSyncing) {
    return (
      <button
        type="button"
        data-testid="sync-status-syncing"
        onClick={handleManualSync}
        className="flex items-center text-muted-foreground"
        title="Menyinkronkan..."
      >
        <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
      </button>
    );
  }

  if (lastError && hasPending) {
    return (
      <button
        type="button"
        data-testid="sync-status-error"
        onClick={handleManualSync}
        className="flex items-center text-red-600 hover:text-red-700"
        title={`Gagal sinkronisasi: ${lastError} — klik untuk coba lagi`}
      >
        <CloudOff className="h-5 w-5" />
      </button>
    );
  }

  if (hasPending) {
    return (
      <button
        type="button"
        data-testid="sync-status-pending"
        onClick={handleManualSync}
        className={cn(
          "flex items-center text-muted-foreground",
          "hover:text-foreground transition-colors",
        )}
        title={`${pendingCount} perubahan menunggu sinkronisasi — klik untuk sinkronisasi sekarang`}
      >
        <CloudUpload className="h-5 w-5 text-blue-400" />
      </button>
    );
  }

  // All synced — still allow manual sync
  return (
    <button
      type="button"
      data-testid="sync-status-synced"
      onClick={handleManualSync}
      className="flex items-center text-muted-foreground"
      title={
        lastSyncedAt
          ? `Tersinkron: ${formatDateTimeTZ(lastSyncedAt)}`
          : "Tersinkron"
      }
    >
      <CheckCircle className="h-5 w-5 text-green-500" />
    </button>
  );
}
