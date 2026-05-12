/**
 * DexieRepository.ts — ILocalRepository backed by IndexedDB (Dexie).
 *
 * Serves reads from IndexedDB (instant, offline-capable) and queues writes to
 * the _outbox table for later sync to Google Sheets by SyncManager.
 *
 * The `tableName` constructor argument identifies which IndexedDB table this
 * repo targets. SyncManager resolves the corresponding spreadsheet/sheet when
 * draining the outbox.
 *
 * Write → IndexedDB immediately (ACID via Dexie transaction)
 *       → _outbox entry queued in the same transaction
 * Read  → IndexedDB always (SyncManager keeps it up-to-date with Sheets)
 *
 * batchUpsert is decomposed locally:
 *   - entries whose id exists in Dexie → batchUpdate
 *   - entries that are new            → batchInsert
 */

import { logger } from "../../../utils/logger";
import { generateId } from "../../../utils/uuid";
import type { ILocalRepository } from "../LocalRepository";
import type { Database, OutboxEntry, OutboxOperation } from "./db";

export class DexieRepository<T extends Record<string, unknown>>
  implements ILocalRepository<T>
{
  protected readonly db: Database;
  private readonly tableName: string;
  private readonly onAfterWrite: () => void;

  constructor(
    db: Database,
    tableName: string,
    onAfterWrite: () => void = () => {},
  ) {
    this.db = db;
    this.tableName = tableName;
    this.onAfterWrite = onAfterWrite;
  }

  // ─── Reads (always from IndexedDB) ──────────────────────────────────────────

  async getAll(): Promise<T[]> {
    const items = await this.db.table<T>(this.tableName).toArray();
    return items.filter((r) => !r.deleted_at);
  }

  // ─── Writes (IndexedDB + outbox) ─────────────────────────────────────────────

  async batchInsert(
    payload: Array<Partial<T> & Record<string, unknown>>,
  ): Promise<void> {
    if (payload.length === 0) return;
    const items = payload.map((r) => (r.id ? r : { id: generateId(), ...r }));
    await this.db.transaction(
      "rw",
      [this.db.table(this.tableName), this.db._outbox],
      async () => {
        await this.db.table(this.tableName).bulkPut(items);
        await this.enqueue({
          op: "batchInsert",
          items: items as Record<string, unknown>[],
        });
      },
    );
    this.onAfterWrite();
  }

  async batchUpdate(
    payload: Array<Partial<T> & Record<string, unknown>>,
  ): Promise<void> {
    if (payload.length === 0) return;
    await this.db.transaction(
      "rw",
      [this.db.table(this.tableName), this.db._outbox],
      async () => {
        const ids = payload.map((r) => r.id as string);
        const existingItems = await this.db.table(this.tableName).bulkGet(ids);

        const mergedItems: Record<string, unknown>[] = [];
        for (let i = 0; i < payload.length; i++) {
          const existing = existingItems[i];
          if (!existing) continue;
          mergedItems.push({ ...existing, ...payload[i] });
        }
        if (mergedItems.length > 0) {
          await this.db.table(this.tableName).bulkPut(mergedItems);
        }

        await this.enqueue({
          op: "batchUpdate",
          items: payload as Record<string, unknown>[],
        });
      },
    );
    this.onAfterWrite();
  }

  async batchUpsert(
    payload: Array<Partial<T> & Record<string, unknown>>,
  ): Promise<void> {
    if (payload.length === 0) return;

    const ids = payload.map((r) => r.id as string);
    const existingItems = await this.db.table(this.tableName).bulkGet(ids);
    const existingSet = new Set(
      existingItems
        .map((r, i) => (r ? ids[i] : null))
        .filter((id): id is string => id !== null),
    );

    const toUpdate = payload.filter((r) => existingSet.has(r.id as string));
    const toInsert = payload.filter((r) => !existingSet.has(r.id as string));

    await this.db.transaction(
      "rw",
      [this.db.table(this.tableName), this.db._outbox],
      async () => {
        if (toUpdate.length > 0) {
          const existingUpdates = await this.db
            .table(this.tableName)
            .bulkGet(toUpdate.map((r) => r.id as string));
          const mergedUpdates = toUpdate.flatMap((item, index) => {
            const existing = existingUpdates[index];
            return existing ? [{ ...existing, ...item }] : [];
          });
          if (mergedUpdates.length > 0) {
            await this.db.table(this.tableName).bulkPut(mergedUpdates);
          }
          await this.enqueue({
            op: "batchUpdate",
            items: toUpdate as Record<string, unknown>[],
          });
        }
        if (toInsert.length > 0) {
          await this.db.table(this.tableName).bulkPut(toInsert);
          await this.enqueue({
            op: "batchInsert",
            items: toInsert as Record<string, unknown>[],
          });
        }
      },
    );
    this.onAfterWrite();
  }

  async softDelete(id: string): Promise<void> {
    const deletedAt = new Date().toISOString();
    await this.db.transaction(
      "rw",
      [this.db.table(this.tableName), this.db._outbox],
      async () => {
        await this.db
          .table(this.tableName)
          .update(id, { deleted_at: deletedAt });
        await this.enqueue({ op: "softDelete", id: id });
      },
    );
    this.onAfterWrite();
  }

  // ─── Internal helpers ────────────────────────────────────────────────────────

  private enqueue(operation: OutboxOperation): Promise<number> {
    const entry: OutboxEntry = {
      mutationId: generateId(),
      tableName: this.tableName,
      operation,
      status: "pending",
      retries: 0,
      createdAt: new Date().toISOString(),
    };
    logger.debug("[DexieRepository] enqueue outbox entry", {
      tableName: entry.tableName,
      mutationId: entry.mutationId,
      op: operation.op,
    });
    return this.db._outbox.add(entry);
  }
}
