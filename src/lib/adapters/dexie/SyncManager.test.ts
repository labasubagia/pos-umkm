/**
 * SyncManager.test.ts — Unit tests for the outbox drain logic.
 *
 * Uses fake-indexeddb to avoid a real browser environment and MSW for
 * Sheets API HTTP mocking.
 */
import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { SyncManager } from "./SyncManager";
import { getDb, clearDbCache } from "./db";
import type { OutboxEntry } from "./db";

const SPREADSHEET_ID = "test-sheet-id";
const TOKEN = "test-token";
const TEST_STORE_ID = "sync-test-store";

// Reset DB and online state before each test
beforeEach(async () => {
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
    spreadsheetId: SPREADSHEET_ID,
    sheetName: "Products",
    operation: {
      op: "append",
      rows: [{ id: "p1", name: "Indomie", price: 3500 }],
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

    // Spy on the internal applyToSheets by mocking SheetRepository.batchAppend
    // We intercept by patching the prototype used inside SyncManager.
    const { SheetRepository } = await import("../SheetRepository");
    const spy = vi
      .spyOn(SheetRepository.prototype, "batchAppend")
      .mockResolvedValue(undefined);

    await db._outbox.add(makeEntry());
    await (manager as unknown as { drain(): Promise<void> }).drain();

    expect(spy).toHaveBeenCalledOnce();
    expect(await db._outbox.count()).toBe(0);

    spy.mockRestore();
  });

  it("deletes the outbox entry on success", async () => {
    const manager = makeManager();
    const db = getDb(TEST_STORE_ID);
    const { SheetRepository } = await import("../SheetRepository");
    const spy = vi
      .spyOn(SheetRepository.prototype, "batchAppend")
      .mockResolvedValue(undefined);

    await db._outbox.add(makeEntry());
    await (manager as unknown as { drain(): Promise<void> }).drain();

    expect(await db._outbox.count()).toBe(0);
    spy.mockRestore();
  });

  it("marks entry as failed and increments retries on error", async () => {
    const manager = makeManager();
    const db = getDb(TEST_STORE_ID);
    const { SheetRepository } = await import("../SheetRepository");
    const spy = vi
      .spyOn(SheetRepository.prototype, "batchAppend")
      .mockRejectedValue(new Error("Network error"));

    const id = await db._outbox.add(makeEntry());
    await (manager as unknown as { drain(): Promise<void> }).drain();

    const entry = await db._outbox.get(id);
    expect(entry?.status).toBe("failed");
    expect(entry?.retries).toBe(1);
    spy.mockRestore();
  });

  it("stops draining on HTTP 429 rate limit error", async () => {
    const manager = makeManager();
    const db = getDb(TEST_STORE_ID);
    const { SheetRepository } = await import("../SheetRepository");
    const spy = vi
      .spyOn(SheetRepository.prototype, "batchAppend")
      .mockRejectedValue(
        new Error("Sheets API error 429: rate limit exceeded"),
      );

    // Add two entries — only first should be attempted before rate limit stops the loop
    await db._outbox.add(makeEntry());
    await db._outbox.add(makeEntry({ mutationId: crypto.randomUUID() }));

    await (manager as unknown as { drain(): Promise<void> }).drain();

    // First entry processed (failed), second still pending
    const remaining = await db._outbox.toArray();
    expect(remaining).toHaveLength(2);
    expect(remaining[0].status).toBe("failed");
    expect(remaining[1].status).toBe("pending"); // untouched
    spy.mockRestore();
  });

  it("skips entries with retries >= MAX_RETRIES", async () => {
    const manager = makeManager();
    const db = getDb(TEST_STORE_ID);
    const { SheetRepository } = await import("../SheetRepository");
    const spy = vi
      .spyOn(SheetRepository.prototype, "batchAppend")
      .mockResolvedValue(undefined);

    await db._outbox.add(makeEntry({ status: "failed", retries: 5 }));
    await (manager as unknown as { drain(): Promise<void> }).drain();

    // Entry should NOT have been processed (retries === MAX_RETRIES)
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
    const { SheetRepository } = await import("../SheetRepository");
    const spy = vi
      .spyOn(SheetRepository.prototype, "batchAppend")
      .mockResolvedValue(undefined);

    await db._outbox.add(makeEntry());
    manager.triggerSync();

    // No drain should have been attempted
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

// ─── operation routing ───────────────────────────────────────────────────────

describe("operation routing", () => {
  it("calls batchUpdateCells for batchUpdateCells op", async () => {
    const manager = makeManager();
    const db = getDb(TEST_STORE_ID);
    const { SheetRepository } = await import("../SheetRepository");
    const spy = vi
      .spyOn(SheetRepository.prototype, "batchUpdateCells")
      .mockResolvedValue(undefined);

    await db._outbox.add(
      makeEntry({
        operation: {
          op: "batchUpdateCells",
          updates: [{ rowId: "p1", column: "stock", value: 10 }],
        },
      }),
    );
    await (manager as unknown as { drain(): Promise<void> }).drain();

    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });

  it("calls softDelete for softDelete op", async () => {
    const manager = makeManager();
    const db = getDb(TEST_STORE_ID);
    const { SheetRepository } = await import("../SheetRepository");
    const spy = vi
      .spyOn(SheetRepository.prototype, "softDelete")
      .mockResolvedValue(undefined);

    await db._outbox.add(
      makeEntry({
        operation: { op: "softDelete", rowId: "p1" },
      }),
    );
    await (manager as unknown as { drain(): Promise<void> }).drain();

    expect(spy).toHaveBeenCalledWith("p1");
    spy.mockRestore();
  });
});
