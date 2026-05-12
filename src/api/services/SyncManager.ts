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
 *   - Via wake() — called by DexieRepository.onAfterWrite; multiple calls in the
 *     same microtask queue are coalesced into a single drain start
 *   - When the browser comes back online (window 'online' event)
 *   - Periodically every POLL_INTERVAL_MS
 *   - Explicitly by triggerSync() (manual / diagnostic)
 *
 * SyncManager holds a reference to getToken() and uses it to instantiate
 * SheetRepository on the fly for each outbox entry — this avoids storing
 * any stale spreadsheetId references and matches the existing auth pattern.
 */

import { useAuthStore } from "../../store/authStore";
import { getCurrentStoreMapStore } from "../../store/storeMapStore";
import { useSyncStore } from "../../store/syncStore";
import { logger } from "../../utils/logger";
import type {
  Database,
  OutboxEntry,
  OutboxOperation,
} from "../adapters/dexie/db";
import { SheetRepository } from "../adapters/google/SheetRepository";
import { ALL_TAB_HEADERS } from "../adapters/zod-schemas";

const MAX_RETRIES = 5;
const POLL_INTERVAL_MS = 30_000;
const RATE_LIMIT_BACKOFF_MS = 60_000;

// Will be set by adapters/index.ts to avoid circular dependency
let syncMonitorRef: { updateCount: () => Promise<void> } | null = null;

export function setSyncMonitorRef(ref: {
  updateCount: () => Promise<void>;
}): void {
  syncMonitorRef = ref;
}

function getSyncMainSpreadsheetId(): string | null {
  return (
    useAuthStore.getState().mainSpreadsheetId ??
    localStorage.getItem("mainSpreadsheetId")
  );
}

export class SyncManager {
  private isSyncing = false;
  private readonly getToken: () => string;
  private readonly storeDb: Database;
  private readonly mainDb: Database;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private rateLimitTimer: ReturnType<typeof setTimeout> | null = null;
  private rateLimited = false;
  private wakeScheduled = false;

  constructor(getToken: () => string, storeDb: Database, mainDb: Database) {
    this.getToken = getToken;
    this.storeDb = storeDb;
    this.mainDb = mainDb;
  }

  /**
   * Start listening for connectivity changes and begin periodic polling.
   * Safe to call multiple times — guard prevents duplicate listeners.
   */
  start(): void {
    if (typeof window === "undefined") return;
    window.addEventListener("online", this.handleOnline);
    if (!this.pollTimer) {
      this.pollTimer = setInterval(
        () => void this.triggerSync(),
        POLL_INTERVAL_MS,
      );
    }
    void this.resetStaleSyncingEntries();
  }

  stop(): void {
    if (typeof window !== "undefined") {
      window.removeEventListener("online", this.handleOnline);
    }
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.rateLimitTimer) {
      clearTimeout(this.rateLimitTimer);
      this.rateLimitTimer = null;
    }
  }

  /** Public entry point. No-op if offline, already syncing, rate-limited, or no token. */
  async triggerSync(): Promise<void> {
    logger.info("[SyncManager] triggerSync called", {
      online: navigator.onLine,
      isSyncing: this.isSyncing,
      rateLimited: this.rateLimited,
    });

    if (!navigator.onLine || this.isSyncing || this.rateLimited) {
      logger.info(
        "[SyncManager] triggerSync skipped: offline/isSyncing/rateLimited",
        {
          online: navigator.onLine,
          isSyncing: this.isSyncing,
          rateLimited: this.rateLimited,
        },
      );
      return;
    }

    const token = this.getToken();
    if (!token) {
      logger.info("[SyncManager] triggerSync skipped: no access token");
      return;
    }

    logger.info("[SyncManager] triggerSync proceeding (token present)");
    try {
      await this.drain();
    } catch (err) {
      logger.error("[SyncManager] Unexpected drain error", {
        error: err,
        storeDbName: this.storeDb.name,
        mainDbName: this.mainDb.name,
      });
    }
  }

  /**
   * Idempotent, cheap entry point called after every IndexedDB write.
   * Multiple calls within the same microtask queue are coalesced — only one
   * drain is started per JS turn, even when commitTransaction fires three writes
   * back-to-back. Safe to call many times; no-op when a drain is already running.
   */
  wake(): void {
    if (this.isSyncing || this.wakeScheduled || this.rateLimited) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    if (!this.getToken()) return;
    this.wakeScheduled = true;
    queueMicrotask(() => {
      this.wakeScheduled = false;
      void this.triggerSync();
    });
  }

  /**
   * Resets all failed outbox entries back to pending so they can be retried.
   * Call after a successful token refresh to unblock entries that failed due
   * to an expired token.
   */
  async resetFailedEntries(): Promise<void> {
    await this.storeDb._outbox
      .where("status")
      .equals("failed")
      .modify({ status: "pending", retries: 0, errorMessage: undefined });
    await this.mainDb._outbox
      .where("status")
      .equals("failed")
      .modify({ status: "pending", retries: 0, errorMessage: undefined });
    this.wake();
  }

  // ─── Internal ──────────────────────────────────────────────────────────────

  private handleOnline = (): void => {
    this.rateLimited = false;
    void this.triggerSync();
  };

  public async drain(): Promise<void> {
    // Navigation on logout should use a simple location replace so this
    // module doesn't rely on React hooks (which must be called only inside
    // components). We'll use window.location.replace('/') when available.
    this.isSyncing = true;
    useSyncStore.getState().setIsSyncing(true);

    logger.info("[SyncManager] drain started");
    try {
      // Keep draining until the outbox is empty (both DBs) or an intentional
      // early-exit condition (rate-limit / auth failure) is reached.
      // Process per-store DB first, then main DB.
      const attemptedIds = new Set<number>();

      drainLoop: while (true) {
        // Read from store DB first
        const storePending = await this.storeDb._outbox
          .where("status")
          .anyOf(["pending", "failed"])
          .and(
            (entry) =>
              entry.retries < MAX_RETRIES && !attemptedIds.has(entry.id ?? -1),
          )
          .sortBy("id");

        // Then read from main DB
        const mainPending = await this.mainDb._outbox
          .where("status")
          .anyOf(["pending", "failed"])
          .and(
            (entry) =>
              entry.retries < MAX_RETRIES && !attemptedIds.has(entry.id ?? -1),
          )
          .sortBy("id");

        // Combine and sort by ID across both DBs
        const allPending = [...storePending, ...mainPending].sort(
          (a, b) => (a.id ?? -1) - (b.id ?? -1),
        );

        if (allPending.length === 0) break;

        logger.info(
          "[SyncManager] drain processing batch",
          allPending.map((p) => ({
            id: p.id,
            mutationId: p.mutationId,
            tableName: p.tableName,
          })),
        );

        for (const entry of allPending) {
          if (entry.id == null) {
            logger.warn(
              "[SyncManager] skipping outbox entry with no id",
              entry,
            );
            continue;
          }
          const id = entry.id;
          attemptedIds.add(id);

          // Determine which DB this entry came from based on tableName
          // "Stores" table lives in mainDb, everything else in storeDb
          const entryDb =
            entry.tableName === "Stores" ? this.mainDb : this.storeDb;

          // Mark as syncing so the UI shows progress
          await entryDb._outbox.update(id, { status: "syncing" });

          try {
            logger.info("[SyncManager] processing outbox entry", {
              id,
              mutationId: entry.mutationId,
              tableName: entry.tableName,
              op: entry.operation.op,
            });
            await this.applyToSheets(entry);
            await entryDb._outbox.delete(id);
            useSyncStore.getState().setLastError(null);
            logger.info("[SyncManager] successfully processed entry", { id });
          } catch (err) {
            const isRateLimit = isRateLimitError(err);
            const errStr = String(err);
            await entryDb._outbox.update(id, {
              status: "failed",
              retries: entry.retries + 1,
              errorMessage: errStr,
            });
            useSyncStore.getState().setLastError(errStr);

            // Auto-logout on Sheets API 401/UNAUTHENTICATED error. Before
            // logging the user out, attempt a silent token refresh (GIS) which
            // may succeed when the token is expired but the user still has a
            // valid session. Use dynamic import to avoid circular deps.
            if (errStr.includes("401") || errStr.includes("UNAUTHENTICATED")) {
              logger.warn(
                "[SyncManager] 401/UNAUTHENTICATED from Sheets API — attempting silent refresh before logout",
                { entryId: id, mutationId: entry.mutationId },
              );
              try {
                const { authAdapter } = await import("../adapters/index");
                // Use a typed view of the adapter so we avoid `any` while
                // still safely probing for optional methods.
                const maybeAuth = authAdapter as unknown as {
                  silentRefresh?: () => Promise<boolean>;
                  getAccessToken?: () => string | null;
                };
                const silentRefresh = maybeAuth.silentRefresh;
                if (typeof silentRefresh === "function") {
                  const ok = await silentRefresh.call(authAdapter);
                  logger.info("[SyncManager] silentRefresh result:", ok);
                  if (ok) {
                    // Pull the refreshed token (if the adapter provides it)
                    const refreshedToken = maybeAuth.getAccessToken?.();
                    if (!refreshedToken) {
                      logger.warn(
                        "[SyncManager] silentRefresh succeeded but no token available",
                      );
                    }
                    // Reset all failed entries to pending so they're retried
                    // with the new token, then restart the drain loop — the next
                    // iteration picks them up without waiting for the next poll.
                    await this.resetFailedEntries();
                    continue drainLoop;
                  }
                }
              } catch (refreshErr) {
                logger.warn(
                  "[SyncManager] silentRefresh attempt threw an error",
                  refreshErr,
                );
              }

              // Silent refresh didn't succeed — sign the user out to force reauth.
              try {
                const { authAdapter } = await import("../adapters/index");
                const { clearSessionState } = await import(
                  "../../modules/auth/session.service"
                );
                await authAdapter.signOut?.();
                await clearSessionState();
              } catch (signOutErr) {
                logger.warn("[SyncManager] signOut failed:", signOutErr);
              }
              if (typeof window !== "undefined") window.location.replace("/");
              // Stop further processing
              break drainLoop;
            }

            if (isRateLimit) {
              // Stop draining and backoff — other entries will retry after cooldown
              this.activateRateLimit();
              break drainLoop;
            }

            // Non-rate-limit errors: log and continue with next entry
            logger.error("[SyncManager]", entry, err);
          }
        }
        // The for-loop completed normally — loop back and re-read the outbox
        // in case new entries were written while this batch was being processed.
      }

      useSyncStore.getState().setLastSyncedAt(new Date().toISOString());
      logger.info("[SyncManager] drain completed");
    } finally {
      this.isSyncing = false;
      useSyncStore.getState().setIsSyncing(false);
      await this.refreshPendingCount();
    }
  }

  /**
   * Replays a single outbox entry against the corresponding SheetRepository.
   * Resolves spreadsheetId from store map, creating the repo on the fly so we
   * always use the current, correct sheet even after monthly sheet rollovers.
   */
  private async applyToSheets(entry: OutboxEntry): Promise<void> {
    const spreadsheetId = this.resolveSpreadsheetId(entry.tableName);
    const repo = new SheetRepository(
      spreadsheetId,
      entry.tableName,
      this.getToken,
      ALL_TAB_HEADERS[entry.tableName],
    );
    logger.info("[SyncManager] applyToSheets repo created", {
      spreadsheetId: repo.spreadsheetId,
      sheetName: repo.sheetName,
    });
    logger.info("[SyncManager] applyToSheets operation", entry.operation);

    const op: OutboxOperation = entry.operation;
    switch (op.op) {
      case "batchInsert":
        await repo.batchInsert(op.items);
        break;
      case "batchUpdate":
        await repo.batchUpdate(op.items);
        break;
      case "softDelete":
        await repo.softDelete(op.id);
        break;
      default: {
        const _exhaustive: never = op;
        throw new Error(
          `SyncManager: unknown op ${JSON.stringify(_exhaustive)}`,
        );
      }
    }
  }

  /**
   * Resolves the spreadsheetId for the given sheetName.
   * Tries non-monthly sheets first, then current month's monthly sheets,
   * falls back to the entry's spreadsheetId.
   */
  private resolveSpreadsheetId(sheetName: string): string {
    if (sheetName === "Stores") {
      const mainSpreadsheetId = getSyncMainSpreadsheetId();
      if (mainSpreadsheetId) return mainSpreadsheetId;
    }

    try {
      const storeMap = getCurrentStoreMapStore().getState();
      const meta = storeMap.getSheetMeta(sheetName);
      if (meta?.spreadsheet_id) return meta.spreadsheet_id;
      const monthSheets = storeMap.getCurrentMonthSheets();
      if (monthSheets?.[sheetName]?.spreadsheet_id) {
        return monthSheets[sheetName].spreadsheet_id;
      }
    } catch {
      logger.debug(
        "[SyncManager] store map not yet initialized, using fallback spreadsheetId",
      );
    }

    return "";
  }

  private activateRateLimit(): void {
    this.rateLimited = true;
    this.rateLimitTimer = setTimeout(() => {
      this.rateLimited = false;
      void this.triggerSync();
    }, RATE_LIMIT_BACKOFF_MS);
  }

  private async resetStaleSyncingEntries(): Promise<void> {
    try {
      await this.storeDb._outbox
        .where("status")
        .equals("syncing")
        .modify({ status: "pending" });
    } catch (err) {
      logger.warn(
        "[SyncManager] failed to reset stale 'syncing' entries (store DB)",
        { error: err, storeDbName: this.storeDb.name },
      );
    }

    try {
      await this.mainDb._outbox
        .where("status")
        .equals("syncing")
        .modify({ status: "pending" });
    } catch (err) {
      logger.warn(
        "[SyncManager] failed to reset stale 'syncing' entries (main DB)",
        { error: err, mainDbName: this.mainDb.name },
      );
    }
  }

  private async refreshPendingCount(): Promise<void> {
    // SyncMonitor updates the authoritative pending count after drain completes.
    if (!syncMonitorRef) return;

    try {
      await syncMonitorRef.updateCount();
    } catch (err) {
      logger.warn("[SyncManager] failed to refresh pending count", {
        error: err,
        storeDbName: this.storeDb.name,
        mainDbName: this.mainDb.name,
      });
    }
  }
}

function isRateLimitError(err: unknown): boolean {
  if (err instanceof Error) {
    return (
      err.message.includes("429") ||
      err.message.toLowerCase().includes("rate limit")
    );
  }
  return false;
}
