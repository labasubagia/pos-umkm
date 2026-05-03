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

import { useAuthStore } from "../../store/authStore";
import { getCurrentStoreMapStore } from "../../store/storeMapStore";
import { useSyncStore } from "../../store/syncStore";
import { logger } from "../../utils/logger";
import type {
  Database,
  OutboxEntry,
  OutboxOperation,
} from "../adapters/dexie/db";
import { getDb } from "../adapters/dexie/db";
import { SheetRepository } from "../adapters/google/SheetRepository";
import { ALL_TAB_HEADERS } from "../adapters/zod-schemas";

const MAX_RETRIES = 5;
const POLL_INTERVAL_MS = 30_000;
const RATE_LIMIT_BACKOFF_MS = 60_000;

export class SyncManager {
  private isSyncing = false;
  private readonly getToken: () => string;
  private readonly db: Database;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private rateLimitTimer: ReturnType<typeof setTimeout> | null = null;
  private rateLimited = false;

  constructor(getToken: () => string, db: Database) {
    this.getToken = getToken;
    this.db = db;
  }

  /**
   * Start listening for connectivity changes and begin periodic polling.
   * Safe to call multiple times — guard prevents duplicate listeners.
   */
  start(): void {
    if (typeof window === "undefined") return;
    window.addEventListener("online", this.handleOnline);
    if (!this.pollTimer) {
      this.pollTimer = setInterval(() => this.triggerSync(), POLL_INTERVAL_MS);
    }
    // Reset any stale 'syncing' entries left by abrupt shutdowns,
    // then attempt an immediate drain on startup and refresh pending count.
    // Prefer the currently-active store DB when available; fall back to
    // the instance-bound DB. This avoids showing a zero pending count
    // when outbox entries are stored in a different DB instance.
    try {
      const activeStoreId = useAuthStore.getState().activeStoreId ?? "__init__";
      const startupDb = getDb(activeStoreId);
      startupDb._outbox
        .where("status")
        .equals("syncing")
        .modify({ status: "pending" })
        .catch((err) => {
          logger.warn(
            "[SyncManager] failed to reset stale 'syncing' entries (startupDb)",
            err,
          );
        })
        .then(() => {
          this.triggerSync();
          this.refreshPendingCount();
        });
    } catch {
      // Fallback to the instance-bound DB if anything goes wrong
      this.db._outbox
        .where("status")
        .equals("syncing")
        .modify({ status: "pending" })
        .catch((err) => {
          logger.warn(
            "[SyncManager] failed to reset stale 'syncing' entries (instance db)",
            err,
          );
        })
        .then(() => {
          this.triggerSync();
          this.refreshPendingCount();
        });
    }
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
  triggerSync(): void {
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
    this.drain().catch((err) => {
      logger.error("[SyncManager] Unexpected drain error:", err);
    });
  }

  /**
   * Resets all failed outbox entries back to pending so they can be retried.
   * Call after a successful token refresh to unblock entries that failed due
   * to an expired token.
   */
  async resetFailedEntries(): Promise<void> {
    try {
      const activeStoreId = useAuthStore.getState().activeStoreId ?? "__init__";
      const db = getDb(activeStoreId);
      await db._outbox
        .where("status")
        .equals("failed")
        .modify({ status: "pending", retries: 0, errorMessage: undefined });
    } catch {
      // Fallback to the instance-bound DB if anything goes wrong
      logger.debug(
        "[SyncManager] activeStoreId lookup failed in resetFailedEntries(), using instance DB",
      );
      await this.db._outbox
        .where("status")
        .equals("failed")
        .modify({ status: "pending", retries: 0, errorMessage: undefined });
    }
    this.triggerSync();
  }

  // ─── Internal ──────────────────────────────────────────────────────────────

  private handleOnline = (): void => {
    this.rateLimited = false;
    this.triggerSync();
  };

  public async drain(): Promise<void> {
    // Navigation on logout should use a simple location replace so this
    // module doesn't rely on React hooks (which must be called only inside
    // components). We'll use window.location.replace('/') when available.
    this.isSyncing = true;
    useSyncStore.getState().setIsSyncing(true);

    logger.info("[SyncManager] drain started");
    try {
      // Log which DB this SyncManager instance is using and the currently
      // active store DB to help diagnose cases where the exported
      // `syncManager` is bound to a different Dexie instance than the
      // UI (OutboxPage) is reading.
      try {
        const activeStoreId =
          useAuthStore.getState().activeStoreId ?? "__init__";
        const activeDb = getDb(activeStoreId);
        logger.info("[SyncManager] instance DB vs active store DB", {
          instanceDbName: this.db.name ?? "unknown",
          activeStoreId,
          activeDbName: activeDb.name ?? "unknown",
        });
      } catch (dbLogErr) {
        logger.warn(
          "[SyncManager] failed to determine active DB info",
          dbLogErr,
        );
      }

      const activeStoreId = useAuthStore.getState().activeStoreId ?? "__init__";
      const dbToUse = (() => {
        try {
          return getDb(activeStoreId);
        } catch {
          logger.debug(
            "[SyncManager] getDb() failed in drain(), using instance DB",
          );
          return this.db;
        }
      })();

      const pending = await dbToUse._outbox
        .where("status")
        .anyOf(["pending", "failed"])
        .and((entry) => entry.retries < MAX_RETRIES)
        .sortBy("id");

      logger.info(
        "[SyncManager] drain found pending outbox entries",
        pending.map((p) => ({
          id: p.id,
          mutationId: p.mutationId,
          tableName: p.tableName,
        })),
      );

      for (const entry of pending) {
        if (entry.id == null) {
          logger.warn("[SyncManager] skipping outbox entry with no id", entry);
          continue;
        }
        const id = entry.id;
        // Mark as syncing so the UI shows progress
        await dbToUse._outbox.update(id, { status: "syncing" });

        try {
          logger.info("[SyncManager] processing outbox entry", {
            id,
            mutationId: entry.mutationId,
            tableName: entry.tableName,
            op: entry.operation.op,
          });
          await this.applyToSheets(entry);
          await dbToUse._outbox.delete(id);
          useSyncStore.getState().setLastError(null);
          logger.info("[SyncManager] successfully processed entry", { id });
        } catch (err) {
          const isRateLimit = isRateLimitError(err);
          const errStr = String(err);
          await dbToUse._outbox.update(id, {
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
                  // Reset failed entries so they can be retried with the new token.
                  await this.resetFailedEntries();
                  break; // stop this drain; resetFailedEntries will trigger a new drain
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
              await authAdapter.signOut?.();
            } catch (signOutErr) {
              logger.warn("[SyncManager] signOut failed:", signOutErr);
            }
            useAuthStore.getState().clearAuth();
            if (typeof window !== "undefined") window.location.replace("/");
            // Stop further processing
            break;
          }

          if (isRateLimit) {
            // Stop draining and backoff — other entries will retry after cooldown
            this.activateRateLimit();
            break;
          }

          // Non-rate-limit errors: log and continue with next entry
          logger.error("[SyncManager]", entry, err);
        }
      }

      useSyncStore.getState().setLastSyncedAt(new Date().toISOString());
      logger.info("[SyncManager] drain completed");
    } finally {
      this.isSyncing = false;
      useSyncStore.getState().setIsSyncing(false);
      this.refreshPendingCount();
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
      const mainSpreadsheetId = useAuthStore.getState().mainSpreadsheetId;
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
      this.triggerSync();
    }, RATE_LIMIT_BACKOFF_MS);
  }

  private refreshPendingCount(): void {
    // Count pending entries for the active store to avoid stale counts from
    // an out-of-date SyncManager DB instance.
    try {
      const activeStoreId = useAuthStore.getState().activeStoreId ?? "__init__";
      const db = getDb(activeStoreId);
      db._outbox
        .count()
        .then((count) => {
          useSyncStore.getState().setPendingCount(count);
        })
        .catch((err) => {
          logger.warn(
            "[SyncManager] failed to refresh pending count (active store db)",
            err,
          );
        });
    } catch {
      // Fallback to the instance-bound DB if anything goes wrong
      logger.debug(
        "[SyncManager] activeStoreId lookup failed in refreshPendingCount(), using instance DB",
      );
      this.db._outbox
        .count()
        .then((count) => {
          useSyncStore.getState().setPendingCount(count);
        })
        .catch((err) => {
          logger.warn(
            "[SyncManager] failed to refresh pending count (instance-bound db)",
            err,
          );
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
