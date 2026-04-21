/**
 * SyncManager.ts — Drains the _outbox to Google Sheets.
 *
 * Responsibilities:
 *   1. Process pending outbox entries in FIFO order (by auto-increment id)
 *   2. Replay each queued mutation against the corresponding SheetRepository
 *   3. On success: delete the outbox entry
 *   4. On HTTP 429 (rate limit): stop the drain loop; schedule retry after backoff
 *   5. On other error: mark entry as 'failed', increment retries, continue
 *   6. After 5 failures: stop retrying (manual intervention required)
 *
 * Sync is triggered:
 *   - Explicitly by triggerSync() called via DexieRepository.onAfterWrite
 *   - When the browser comes back online (window 'online' event)
 *   - Periodically every POLL_INTERVAL_MS
 *
 * SyncManager holds a reference to getToken() and uses it to instantiate
 * SheetRepository on the fly for each outbox entry — this avoids storing
 * any stale spreadsheetId references and matches the existing auth pattern.
 */
import { SheetRepository } from '../SheetRepository'
import type { PosUmkmDatabase } from './db'
import type { OutboxEntry, OutboxOperation } from './db'
import { ALL_TAB_HEADERS } from '../../schema'
import { useSyncStore } from '../../../store/syncStore'

const MAX_RETRIES = 5
const POLL_INTERVAL_MS = 30_000
const RATE_LIMIT_BACKOFF_MS = 60_000

export class SyncManager {
  private isSyncing = false
  private readonly getToken: () => string
  private readonly db: PosUmkmDatabase
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private rateLimitTimer: ReturnType<typeof setTimeout> | null = null
  private rateLimited = false

  constructor(getToken: () => string, db: PosUmkmDatabase) {
    this.getToken = getToken
    this.db = db
  }

  /**
   * Start listening for connectivity changes and begin periodic polling.
   * Safe to call multiple times — guard prevents duplicate listeners.
   */
  start(): void {
    if (typeof window === 'undefined') return
    window.addEventListener('online', this.handleOnline)
    if (!this.pollTimer) {
      this.pollTimer = setInterval(() => this.triggerSync(), POLL_INTERVAL_MS)
    }
    // Attempt an immediate drain on startup
    this.triggerSync()
    // Refresh pending count so UI is correct after page reload
    this.refreshPendingCount()
  }

  stop(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline)
    }
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
    if (this.rateLimitTimer) {
      clearTimeout(this.rateLimitTimer)
      this.rateLimitTimer = null
    }
  }

  /** Public entry point. No-op if offline, already syncing, rate-limited, or no token. */
  triggerSync(): void {
    if (!navigator.onLine || this.isSyncing || this.rateLimited) return
    if (!this.getToken()) return
    this.drain().catch((err) => {
      console.error('[SyncManager] Unexpected drain error:', err)
    })
  }

  /**
   * Resets all failed outbox entries back to pending so they can be retried.
   * Call after a successful token refresh to unblock entries that failed due
   * to an expired token.
   */
  async resetFailedEntries(): Promise<void> {
    await this.db._outbox
      .where('status').equals('failed')
      .modify({ status: 'pending', retries: 0, errorMessage: undefined })
    this.triggerSync()
  }

  // ─── Internal ──────────────────────────────────────────────────────────────

  private handleOnline = (): void => {
    this.rateLimited = false
    this.triggerSync()
  }

  private async drain(): Promise<void> {
    this.isSyncing = true
    useSyncStore.getState().setIsSyncing(true)

    try {
      const pending = await this.db._outbox
        .where('status').anyOf(['pending', 'failed'])
        .and((entry) => entry.retries < MAX_RETRIES)
        .sortBy('id')

      for (const entry of pending) {
        // Mark as syncing so the UI shows progress
        await this.db._outbox.update(entry.id!, { status: 'syncing' })

        try {
          await this.applyToSheets(entry)
          await this.db._outbox.delete(entry.id!)
          useSyncStore.getState().setLastError(null)
        } catch (err) {
          const isRateLimit = isRateLimitError(err)
          await this.db._outbox.update(entry.id!, {
            status: 'failed',
            retries: entry.retries + 1,
            errorMessage: String(err),
          })
          useSyncStore.getState().setLastError(String(err))

          if (isRateLimit) {
            // Stop draining and backoff — other entries will retry after cooldown
            this.activateRateLimit()
            break
          }
          // Non-rate-limit errors: continue with next entry
        }
      }

      useSyncStore.getState().setLastSyncedAt(new Date().toISOString())
    } finally {
      this.isSyncing = false
      useSyncStore.getState().setIsSyncing(false)
      this.refreshPendingCount()
    }
  }

  /**
   * Replays a single outbox entry against the corresponding SheetRepository.
   * Creates the repo on the fly using the entry's spreadsheetId so we always
   * use the current, correct sheet even after monthly sheet rollovers.
   */
  private async applyToSheets(entry: OutboxEntry): Promise<void> {
    const repo = new SheetRepository(
      entry.spreadsheetId,
      entry.sheetName,
      this.getToken,
      ALL_TAB_HEADERS[entry.sheetName],
    )

    const op: OutboxOperation = entry.operation
    switch (op.op) {
      case 'append':
        await repo.batchAppend(op.rows)
        break
      case 'batchUpdateCells':
        await repo.batchUpdateCells(op.updates)
        break
      case 'softDelete':
        await repo.softDelete(op.rowId)
        break
      default: {
        const _exhaustive: never = op
        throw new Error(`SyncManager: unknown op ${JSON.stringify(_exhaustive)}`)
      }
    }
  }

  private activateRateLimit(): void {
    this.rateLimited = true
    this.rateLimitTimer = setTimeout(() => {
      this.rateLimited = false
      this.triggerSync()
    }, RATE_LIMIT_BACKOFF_MS)
  }

  private refreshPendingCount(): void {
    this.db._outbox.where('status').anyOf(['pending', 'failed']).count().then((count) => {
      useSyncStore.getState().setPendingCount(count)
    }).catch(() => {/* non-critical */})
  }
}

function isRateLimitError(err: unknown): boolean {
  if (err instanceof Error) {
    return err.message.includes('429') || err.message.toLowerCase().includes('rate limit')
  }
  return false
}
