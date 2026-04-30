/**
 * DexieRepository.test.ts — Unit tests for offline-first IndexedDB repo.
 *
 * Uses fake-indexeddb to run Dexie in a Node.js test environment without
 * a real browser. Each test starts with a fresh database to avoid state leakage.
 */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DexieRepository } from "./DexieRepository";
import { clearDbCache, getDb } from "./db";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TEST_STORE_ID = "test-store";

type ProductRow = {
  id: string;
  name: string;
  price: number;
  deleted_at?: string | null;
};

function makeRepo(sheetName = "Products") {
  return new DexieRepository<ProductRow>(getDb(TEST_STORE_ID), {
    spreadsheetId: "spreadsheet-1",
    sheetName,
  });
}

// Reset Dexie tables between tests
beforeEach(async () => {
  localStorage.clear();
  const db = getDb(TEST_STORE_ID);
  await db.Products.clear();
  await db._outbox.clear();
  await db._syncMeta.clear();
});

afterEach(() => {
  clearDbCache();
});

// ─── getAll ───────────────────────────────────────────────────────────────────

describe("getAll", () => {
  it("returns empty array when IndexedDB is empty", async () => {
    const repo = makeRepo();
    expect(await repo.getAll()).toEqual([]);
  });

  it("returns rows that have no deleted_at", async () => {
    const db = getDb(TEST_STORE_ID);
    await db.Products.bulkPut([
      { id: "p1", name: "Produk A", price: 1000, deleted_at: null },
      { id: "p2", name: "Produk B", price: 2000, deleted_at: "" },
    ]);
    const rows = await makeRepo().getAll();
    expect(rows).toHaveLength(2);
  });

  it("filters out soft-deleted rows", async () => {
    const db = getDb(TEST_STORE_ID);
    await db.Products.bulkPut([
      { id: "p1", name: "Aktif", price: 1000, deleted_at: null },
      {
        id: "p2",
        name: "Dihapus",
        price: 2000,
        deleted_at: "2026-01-01T00:00:00Z",
      },
    ]);
    const rows = await makeRepo().getAll();
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("p1");
  });
});

// ─── batchInsert ──────────────────────────────────────────────────────────────

describe("batchInsert", () => {
  it("stores rows in IndexedDB", async () => {
    const db = getDb(TEST_STORE_ID);
    const repo = makeRepo();
    await repo.batchInsert([{ id: "p1", name: "Indomie", price: 3500 }]);
    const stored = await db.Products.get("p1");
    expect(stored).toMatchObject({ id: "p1", name: "Indomie", price: 3500 });
  });

  it("auto-generates id when row has none", async () => {
    const db = getDb(TEST_STORE_ID);
    const repo = makeRepo();
    await repo.batchInsert([{ name: "Teh Botol", price: 5000 } as ProductRow]);
    const all = await db.Products.toArray();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBeTruthy();
  });

  it("queues an outbox entry with op=append", async () => {
    const db = getDb(TEST_STORE_ID);
    await makeRepo().batchInsert([{ id: "p1", name: "Es Teh", price: 4000 }]);
    const entries = await db._outbox.toArray();
    expect(entries).toHaveLength(1);
    expect(entries[0].operation.op).toBe("append");
    expect(entries[0].status).toBe("pending");
    expect(entries[0].sheetName).toBe("Products");
    expect(entries[0].spreadsheetId).toBe("spreadsheet-1");
  });

  it("is a no-op for empty rows array", async () => {
    const db = getDb(TEST_STORE_ID);
    await makeRepo().batchInsert([]);
    expect(await db._outbox.count()).toBe(0);
  });

  it("rejects writes when no spreadsheetId can be resolved", async () => {
    const db = getDb(TEST_STORE_ID);
    const repo = new DexieRepository<ProductRow>(db, {
      spreadsheetId: "",
      sheetName: "Products",
    });

    await expect(
      repo.batchInsert([{ id: "p1", name: "Indomie", price: 3500 }]),
    ).rejects.toThrow(/spreadsheetId/i);

    expect(await db.Products.count()).toBe(0);
    expect(await db._outbox.count()).toBe(0);
  });
});

// ─── batchUpdate ──────────────────────────────────────────────────────────────

describe("batchUpdate", () => {
  it("updates the field in IndexedDB", async () => {
    const db = getDb(TEST_STORE_ID);
    await db.Products.put({
      id: "p1",
      name: "Roti",
      price: 2000,
      deleted_at: null,
    });
    await makeRepo().batchUpdate([{ id: "p1", price: 2500 }]);
    const updated = await db.Products.get("p1");
    expect(updated?.price).toBe(2500);
  });

  it("queues an outbox entry with op=batchUpdateCells", async () => {
    const db = getDb(TEST_STORE_ID);
    await db.Products.put({
      id: "p1",
      name: "Roti",
      price: 2000,
      deleted_at: null,
    });
    await makeRepo().batchUpdate([{ id: "p1", price: 2500 }]);
    const entry = (await db._outbox.toArray())[0];
    expect(entry.operation.op).toBe("batchUpdateCells");
  });

  it("skips rows not found locally (race condition guard)", async () => {
    const db = getDb(TEST_STORE_ID);
    // Row doesn't exist in Dexie yet — should not throw
    await makeRepo().batchUpdate([{ id: "missing", price: 1 }]);
    // Outbox entry is still queued — SyncManager will handle it
    expect(await db._outbox.count()).toBe(1);
  });

  it("is a no-op for empty rows array", async () => {
    const db = getDb(TEST_STORE_ID);
    await makeRepo().batchUpdate([]);
    expect(await db._outbox.count()).toBe(0);
  });
});

// ─── softDelete ───────────────────────────────────────────────────────────────

describe("softDelete", () => {
  it("sets deleted_at on the row in IndexedDB", async () => {
    const db = getDb(TEST_STORE_ID);
    await db.Products.put({
      id: "p1",
      name: "Mie",
      price: 3000,
      deleted_at: null,
    });
    await makeRepo().softDelete("p1");
    const row = await db.Products.get("p1");
    expect(row?.deleted_at).toBeTruthy();
  });

  it("queues an outbox entry with op=softDelete", async () => {
    const db = getDb(TEST_STORE_ID);
    await db.Products.put({
      id: "p1",
      name: "Mie",
      price: 3000,
      deleted_at: null,
    });
    await makeRepo().softDelete("p1");
    const entry = (await db._outbox.toArray())[0];
    expect(entry.operation.op).toBe("softDelete");
    expect((entry.operation as { op: "softDelete"; rowId: string }).rowId).toBe(
      "p1",
    );
  });

  it("row no longer returned by getAll() after soft delete", async () => {
    const db = getDb(TEST_STORE_ID);
    await db.Products.put({
      id: "p1",
      name: "Mie",
      price: 3000,
      deleted_at: null,
    });
    const repo = makeRepo();
    await repo.softDelete("p1");
    expect(await repo.getAll()).toHaveLength(0);
  });
});

// ─── batchUpsert ─────────────────────────────────────────────────────────────

describe("batchUpsert", () => {
  it("updates existing rows and inserts new ones by id", async () => {
    const db = getDb(TEST_STORE_ID);
    await db.Settings.put({
      id: "s1",
      key: "business_name",
      value: "Toko Lama",
      deleted_at: null,
    });
    const repo = new DexieRepository<Record<string, unknown>>(db, {
      spreadsheetId: "spreadsheet-1",
      sheetName: "Settings",
    });
    await repo.batchUpsert([
      { id: "s1", key: "business_name", value: "Toko Baru", deleted_at: null }, // update
      {
        id: "new-addr",
        key: "address",
        value: "Jl. Merdeka",
        deleted_at: null,
      }, // insert
    ]);
    const all = await db.Settings.toArray();
    expect(all).toHaveLength(2);
    const name = all.find((r) => r.key === "business_name");
    expect(name?.value).toBe("Toko Baru");
    const addr = all.find((r) => r.key === "address");
    expect(addr).toBeTruthy();
  });
});
