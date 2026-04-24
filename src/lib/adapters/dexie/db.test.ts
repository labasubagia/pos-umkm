/**
 * db.test.ts — Unit tests for the per-store Dexie database factory.
 *
 * Verifies that getDb() returns isolated databases per storeId and that
 * clearDbCache() resets the factory so tests can start fresh.
 */
import "fake-indexeddb/auto";
import { describe, it, expect, afterEach } from "vitest";
import { getDb, clearDbCache, PosUmkmDatabase } from "./db";

afterEach(() => {
  clearDbCache();
});

describe("getDb", () => {
  it("returns a PosUmkmDatabase instance", () => {
    const db = getDb("store-a");
    expect(db).toBeInstanceOf(PosUmkmDatabase);
  });

  it("returns the same instance for the same storeId (cache hit)", () => {
    const db1 = getDb("store-a");
    const db2 = getDb("store-a");
    expect(db1).toBe(db2);
  });

  it("returns different instances for different storeIds", () => {
    const dbA = getDb("store-a");
    const dbB = getDb("store-b");
    expect(dbA).not.toBe(dbB);
  });

  it("uses storeId in the database name", () => {
    const db = getDb("my-store");
    expect(db.name).toBe("pos_umkm_my-store");
  });
});

describe("clearDbCache", () => {
  it("forces a new instance after clearing", () => {
    const before = getDb("store-x");
    clearDbCache();
    const after = getDb("store-x");
    expect(before).not.toBe(after);
  });

  it("new instance after clear still has correct db name", () => {
    getDb("store-x");
    clearDbCache();
    const fresh = getDb("store-x");
    expect(fresh.name).toBe("pos_umkm_store-x");
  });
});

describe("data isolation", () => {
  it("data written to one store is not visible in another", async () => {
    const dbA = getDb("iso-store-a");
    const dbB = getDb("iso-store-b");

    await dbA.Products.put({ id: "p1", name: "Produk A", price: 1000 });

    const inA = await dbA.Products.toArray();
    const inB = await dbB.Products.toArray();

    expect(inA).toHaveLength(1);
    expect(inB).toHaveLength(0);
  });
});
