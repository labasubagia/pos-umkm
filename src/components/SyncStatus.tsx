/**
 * SyncStatus.tsx — Offline sync status indicator.
 *
 * Shows:
 *   - A cloud-with-check icon and "Tersinkron" when everything is synced
 *   - A spinning sync icon and count badge when writes are pending/syncing
 *   - A cloud-off icon and error tooltip when the last sync failed
 *   - A cloud-off icon when the device is offline
 *
 * Only rendered when VITE_ADAPTER=google (Dexie offline-first mode).
 * Reads from useSyncStore — no props needed.
 */
import { useEffect, useState } from 'react'
import { CloudOff, CloudUpload, CheckCircle, Loader2 } from 'lucide-react'
import { useSyncStore } from '../store/syncStore'
import { syncManager } from '../lib/adapters'
import { cn } from '../lib/utils'

export function SyncStatus() {
  const { pendingCount, isSyncing, lastSyncedAt, lastError } = useSyncStore()
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const onOnline = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  const handleManualSync = () => {
    syncManager.triggerSync()
  }

  const hasPending = pendingCount > 0

  if (!isOnline) {
    return (
      <div
        data-testid="sync-status-offline"
        className="flex items-center gap-1.5 text-xs text-muted-foreground"
        title="Offline — perubahan disimpan lokal"
      >
        <CloudOff className="h-4 w-4 text-orange-400" />
        <span className="hidden sm:inline">Offline</span>
        {hasPending && (
          <span
            data-testid="sync-pending-count"
            className="rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-medium text-orange-700"
          >
            {pendingCount}
          </span>
        )}
      </div>
    )
  }

  if (isSyncing) {
    return (
      <div
        data-testid="sync-status-syncing"
        className="flex items-center gap-1.5 text-xs text-muted-foreground"
        title="Menyinkronkan..."
      >
        <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
        <span className="hidden sm:inline">Sinkronisasi...</span>
      </div>
    )
  }

  if (lastError && hasPending) {
    return (
      <button
        data-testid="sync-status-error"
        onClick={handleManualSync}
        className="flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700"
        title={`Gagal sinkronisasi: ${lastError} — klik untuk coba lagi`}
      >
        <CloudOff className="h-4 w-4" />
        <span className="hidden sm:inline">Gagal</span>
        <span
          data-testid="sync-pending-count"
          className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700"
        >
          {pendingCount}
        </span>
      </button>
    )
  }

  if (hasPending) {
    return (
      <button
        data-testid="sync-status-pending"
        onClick={handleManualSync}
        className={cn(
          'flex items-center gap-1.5 text-xs text-muted-foreground',
          'hover:text-foreground transition-colors',
        )}
        title={`${pendingCount} perubahan menunggu sinkronisasi — klik untuk sinkronisasi sekarang`}
      >
        <CloudUpload className="h-4 w-4 text-blue-400" />
        <span
          data-testid="sync-pending-count"
          className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700"
        >
          {pendingCount}
        </span>
      </button>
    )
  }

  // All synced
  return (
    <div
      data-testid="sync-status-synced"
      className="flex items-center gap-1.5 text-xs text-muted-foreground"
      title={lastSyncedAt ? `Tersinkron: ${new Date(lastSyncedAt).toLocaleTimeString('id-ID')}` : 'Tersinkron'}
    >
      <CheckCircle className="h-4 w-4 text-green-500" />
      <span className="hidden sm:inline">Tersinkron</span>
    </div>
  )
}
