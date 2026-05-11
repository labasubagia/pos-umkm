/**
 * db.test.ts — Unit tests for the per-store Dexie database factory.
 *
 * Verifies that getDb() returns isolated databases per storeId and that
 * clearDbCache() resets the factory so tests can start fresh.
 */
import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { clearDbCache, Database, deletePosUmkmDatabases, getDb } from "./db";

afterEach(() => {
  clearDbCache();
});

describe("getDb", () => {
  it("returns a Database instance", () => {
    const db = getDb("store-a");
    expect(db).toBeInstanceOf(Database);
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

describe("deletePosUmkmDatabases", () => {
  it("deletes cached POS UMKM databases from IndexedDB", async () => {
    const before = getDb("store-delete");
    await before.Products.put({
      id: "p-delete",
      name: "Produk Hapus",
      price: 1000,
      category_id: "",
      sku: "",
      stock: 0,
      has_variants: false,
      created_at: "",
    });

    const deletedDbNames = await deletePosUmkmDatabases();
    const after = getDb("store-delete");

    expect(deletedDbNames).toContain("pos_umkm_store-delete");
    expect(after).not.toBe(before);
    await expect(after.Products.toArray()).resolves.toHaveLength(0);
  });
});

describe("data isolation", () => {
  it("data written to one store is not visible in another", async () => {
    const dbA = getDb("iso-store-a");
    const dbB = getDb("iso-store-b");

    await dbA.Products.put({
      id: "p1",
      name: "Produk A",
      price: 1000,
      category_id: "",
      sku: "",
      stock: 0,
      has_variants: false,
      created_at: "",
    });

    const inA = await dbA.Products.toArray();
    const inB = await dbB.Products.toArray();

    expect(inA).toHaveLength(1);
    expect(inB).toHaveLength(0);
  });
});

describe("role-based schema", () => {
  it("__main__ DB only exposes Stores and infra tables", async () => {
    const mainDb = getDb("__main__");

    await mainDb.Stores.put({
      id: "s-1",
      store_id: "s-1",
      store_name: "Main Store",
      drive_folder_id: "folder-1",
      owner_user_id: "owner-1",
      created_at: "",
      deleted_at: null,
    });

    expect(() => mainDb.table("Products")).toThrow();
  });

  it("__init__ DB keeps bootstrap tables but not store data tables", async () => {
    const initDb = getDb("__init__");

    await initDb.Settings.put({
      id: "cfg-1",
      key: "business_name",
      value: "Warung Init",
      updated_at: "",
    });
    await initDb.Members.put({
      id: "m-1",
      google_user_id: "u-1",
      email: "owner@example.com",
      name: "Owner Init",
      role: "owner",
      invited_at: "",
      deleted_at: null,
    });

    expect(() => initDb.table("Products")).toThrow();
  });
});
