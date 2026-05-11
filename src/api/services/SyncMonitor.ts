/**
 * SyncMonitor.ts — Aggregates pending count from both outbox tables.
 *
 * This service maintains the single source of truth for syncStore.pendingCount.
 * Instead of trying to subscribe to Dexie table changes, it provides methods
 * that are called from DexieRepository and SyncManager when outbox state changes.
 *
 * Lifecycle:
 *   - Created in adapters/index.ts
 *   - updateCount() called from DexieRepository.onAfterWrite()
 *   - updateCount() called from SyncManager after drain completes
 */

import { useSyncStore } from "../../store/syncStore";
import { logger } from "../../utils/logger";
import type { Database } from "../adapters/dexie/db";

export class SyncMonitor {
  private storeDb: Database;
  private mainDb: Database;
  private isStopped = false;

  constructor(storeDb: Database, mainDb: Database) {
    this.storeDb = storeDb;
    this.mainDb = mainDb;
  }

  /**
   * Recompute and update the pending count from both DBs.
   * Called when outbox state changes (writes or after sync completes).
   */
  async updateCount(): Promise<void> {
    if (this.isStopped) {
      logger.debug("[SyncMonitor] updateCount skipped after stop", {
        storeDbName: this.storeDb.name,
        mainDbName: this.mainDb.name,
      });
      return;
    }

    logger.info("[SyncMonitor] updateCount called", {
      storeDbName: this.storeDb.name,
      mainDbName: this.mainDb.name,
    });
    try {
      const countPromises =
        this.storeDb === this.mainDb
          ? [this.storeDb._outbox.count()]
          : [this.storeDb._outbox.count(), this.mainDb._outbox.count()];

      const counts = await Promise.all(countPromises);
      const total = counts.reduce((a, b) => a + b, 0);

      useSyncStore.getState().setPendingCount(total);
      logger.info("[SyncMonitor] pending count updated to", {
        total,
        counts:
          this.storeDb === this.mainDb
            ? counts[0]
            : { store: counts[0], main: counts[1] },
      });
    } catch (err) {
      if (
        err instanceof Error &&
        (err.name === "DatabaseClosedError" ||
          err.message.includes("Database has been closed"))
      ) {
        logger.debug("[SyncMonitor] updateCount skipped for closed database", {
          error: err,
          storeDbName: this.storeDb.name,
          mainDbName: this.mainDb.name,
          isStopped: this.isStopped,
        });
        return;
      }

      logger.error("[SyncMonitor] failed to update pending count", err);
    }
  }

  /** Called when switching stores or logging out. */
  async start(): Promise<void> {
    this.isStopped = false;

    try {
      await this.updateCount();
    } catch (err) {
      logger.warn("[SyncMonitor] failed initial count", {
        error: err,
        storeDbName: this.storeDb.name,
        mainDbName: this.mainDb.name,
      });
    }

    logger.info("[SyncMonitor] started monitoring", {
      storeDbName: this.storeDb.name,
      mainDbName: this.mainDb.name,
      isSame: this.storeDb === this.mainDb,
    });
  }

  /** Called on logout or store switch. */
  stop(): void {
    this.isStopped = true;
    logger.debug("[SyncMonitor] stopped", {
      storeDbName: this.storeDb.name,
      mainDbName: this.mainDb.name,
    });
  }
}
