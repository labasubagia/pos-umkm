/**
 * SyncManager.test.ts — Unit tests for the outbox drain logic.
 *
 * Uses fake-indexeddb to avoid a real browser environment and MSW for
 * Sheets API HTTP mocking.
 */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { logger } from "../../utils/logger";
import type { OutboxEntry } from "../adapters/dexie/db";
import { clearDbCache, getDb } from "../adapters/dexie/db";
import { SyncManager } from "./SyncManager";

const TOKEN = "test-token";
const TEST_STORE_ID = "sync-test-store";

// Reset DB and online state before each test
import { useAuthStore } from "../../store/authStore";

beforeEach(async () => {
  // Set activeStoreId so SyncManager uses the test DB
  useAuthStore.getState().activeStoreId = TEST_STORE_ID;
  const db = getDb(TEST_STORE_ID);
  await db._outbox.clear();
  // Ensure navigator.onLine is stubbed to true by default
  Object.defineProperty(navigator, "onLine", {
    value: true,
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  clearDbCache();
});

function makeManager() {
  return new SyncManager(() => TOKEN, getDb(TEST_STORE_ID));
}

function makeEntry(
  overrides: Partial<OutboxEntry> = {},
): Omit<OutboxEntry, "id"> {
  return {
    mutationId: crypto.randomUUID(),
    tableName: "Products",
    operation: {
      op: "batchInsert",
      items: [{ id: "p1", name: "Indomie", price: 3500 }],
    },
    status: "pending",
    retries: 0,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// ─── drain logic ─────────────────────────────────────────────────────────────

describe("drain", () => {
  it("calls the SheetRepository for a pending append entry", async () => {
    const manager = makeManager();
    const db = getDb(TEST_STORE_ID);
    const { SheetRepository } = await import(
      "../adapters/google/SheetRepository"
    );
    const spy = vi
      .spyOn(SheetRepository.prototype, "batchInsert")
      .mockResolvedValue(undefined);
    await db._outbox.add(makeEntry());
    await manager.drain();
    expect(spy).toHaveBeenCalledOnce();
    expect(await db._outbox.count()).toBe(0);
    spy.mockRestore();
  });

  it("deletes the outbox entry on success", async () => {
    const manager = makeManager();
    const db = getDb(TEST_STORE_ID);
    const { SheetRepository } = await import(
      "../adapters/google/SheetRepository"
    );
    const spy = vi
      .spyOn(SheetRepository.prototype, "batchInsert")
      .mockResolvedValue(undefined);
    await db._outbox.add(makeEntry());
    await manager.drain();
    expect(await db._outbox.count()).toBe(0);
    spy.mockRestore();
  });

  it("marks entry as failed and increments retries on error", async () => {
    const manager = makeManager();
    const db = getDb(TEST_STORE_ID);
    const { SheetRepository } = await import(
      "../adapters/google/SheetRepository"
    );
    const loggerSpy = vi.spyOn(logger, "error").mockImplementation(() => {});
    const spy = vi
      .spyOn(SheetRepository.prototype, "batchInsert")
      .mockRejectedValue(new Error("Network error"));
    const id = await db._outbox.add(makeEntry());
    await manager.drain();
    const entry = await db._outbox.get(id);
    expect(entry?.status).toBe("failed");
    expect(entry?.retries).toBe(1);
    expect(loggerSpy).toHaveBeenCalledWith(
      "[SyncManager]",
      expect.objectContaining({ id, tableName: "Products" }),
      expect.any(Error),
    );
    loggerSpy.mockRestore();
    spy.mockRestore();
  });

  it("stops draining on HTTP 429 rate limit error", async () => {
    const manager = makeManager();
    const db = getDb(TEST_STORE_ID);
    const { SheetRepository } = await import(
      "../adapters/google/SheetRepository"
    );
    const spy = vi
      .spyOn(SheetRepository.prototype, "batchInsert")
      .mockRejectedValue(
        new Error("Sheets API error 429: rate limit exceeded"),
      );
    await db._outbox.add(makeEntry());
    await db._outbox.add(makeEntry({ mutationId: crypto.randomUUID() }));
    await manager.drain();
    const remaining = await db._outbox.toArray();
    expect(remaining).toHaveLength(2);
    expect(remaining[0].status).toBe("failed");
    expect(remaining[1].status).toBe("pending");
    spy.mockRestore();
  });

  it("skips entries with retries >= MAX_RETRIES", async () => {
    const manager = makeManager();
    const db = getDb(TEST_STORE_ID);
    const { SheetRepository } = await import(
      "../adapters/google/SheetRepository"
    );
    const spy = vi
      .spyOn(SheetRepository.prototype, "batchInsert")
      .mockResolvedValue(undefined);
    await db._outbox.add(makeEntry({ status: "failed", retries: 5 }));
    await manager.drain();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("does not drain when offline", async () => {
    Object.defineProperty(navigator, "onLine", {
      value: false,
      writable: true,
      configurable: true,
    });
    const manager = makeManager();
    const db = getDb(TEST_STORE_ID);
    const { SheetRepository } = await import(
      "../adapters/google/SheetRepository"
    );
    const spy = vi
      .spyOn(SheetRepository.prototype, "batchInsert")
      .mockResolvedValue(undefined);
    await db._outbox.add(makeEntry());
    manager.triggerSync();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("processes entries written to the outbox while drain is running", async () => {
    // Simulates commitTransaction: entry 1 is already queued, entries 2 & 3
    // are written to the outbox while entry 1 is being pushed to Sheets.
    // The looping drain should process all three without waiting for the
    // next poll interval.
    const manager = makeManager();
    const db = getDb(TEST_STORE_ID);
    const { SheetRepository } = await import(
      "../adapters/google/SheetRepository"
    );
    let callCount = 0;
    const spy = vi
      .spyOn(SheetRepository.prototype, "batchInsert")
      .mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          // Simulate two more writes arriving while entry 1 is being pushed
          await db._outbox.add(makeEntry({ mutationId: "concurrent-2" }));
          await db._outbox.add(makeEntry({ mutationId: "concurrent-3" }));
        }
      });

    await db._outbox.add(makeEntry({ mutationId: "first-1" }));
    await manager.drain();

    expect(spy).toHaveBeenCalledTimes(3);
    expect(await db._outbox.count()).toBe(0);
    spy.mockRestore();
  });
});

// ─── wake() ──────────────────────────────────────────────────────────────────

describe("wake()", () => {
  it("starts exactly one drain even when called multiple times per tick", async () => {
    const manager = makeManager();
    const drainSpy = vi.spyOn(manager, "drain").mockResolvedValue(undefined);

    manager.wake();
    manager.wake();
    manager.wake();

    // Flush the microtask queue so the queueMicrotask callback fires
    await new Promise<void>((resolve) => queueMicrotask(resolve));

    expect(drainSpy).toHaveBeenCalledOnce();
    drainSpy.mockRestore();
  });

  it("does not start a drain when already syncing", async () => {
    const manager = makeManager();
    // Simulate an active drain by calling drain() without awaiting
    const { SheetRepository } = await import(
      "../adapters/google/SheetRepository"
    );
    const db = getDb(TEST_STORE_ID);
    let resolveDrain!: () => void;
    vi.spyOn(SheetRepository.prototype, "batchInsert").mockReturnValue(
      new Promise<void>((r) => {
        resolveDrain = r;
      }),
    );
    await db._outbox.add(makeEntry());
    const drainPromise = manager.drain(); // starts, sets isSyncing = true
    const drainSpy = vi.spyOn(manager, "drain");

    manager.wake(); // should be a no-op because isSyncing = true
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(drainSpy).not.toHaveBeenCalled();

    resolveDrain();
    await drainPromise;
    drainSpy.mockRestore();
  });
});

// ─── operation routing ───────────────────────────────────────────────────────

describe("operation routing", () => {
  it("calls batchUpdateCells for batchUpdateCells op", async () => {
    const manager = makeManager();
    const db = getDb(TEST_STORE_ID);
    const { SheetRepository } = await import(
      "../adapters/google/SheetRepository"
    );
    const spy = vi
      .spyOn(SheetRepository.prototype, "batchUpdate")
      .mockResolvedValue(undefined);
    await db._outbox.add(
      makeEntry({
        operation: {
          op: "batchUpdate",
          items: [{ id: "p1", stock: 10 }],
        },
      }),
    );
    await manager.drain();
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });

  it("calls softDelete for softDelete op", async () => {
    const manager = makeManager();
    const db = getDb(TEST_STORE_ID);
    const { SheetRepository } = await import(
      "../adapters/google/SheetRepository"
    );
    const spy = vi
      .spyOn(SheetRepository.prototype, "softDelete")
      .mockResolvedValue(undefined);
    await db._outbox.add(
      makeEntry({
        operation: { op: "softDelete", id: "p1" },
      }),
    );
    await manager.drain();
    expect(spy).toHaveBeenCalledWith("p1");
    spy.mockRestore();
  });
});
