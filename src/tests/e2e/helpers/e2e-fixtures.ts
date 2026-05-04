import type { TestInfo } from "@playwright/test";
import type { StoreConfig } from "./auth";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function makeTestKey(testInfo: TestInfo): string {
  const title = slugify(testInfo.title);
  return `${title}-w${testInfo.workerIndex}-r${testInfo.retry}`;
}

export function makeStoreConfig(testInfo: TestInfo): StoreConfig {
  const key = makeTestKey(testInfo);
  return {
    storeId: `e2e-store-${key}`,
    mainSpreadsheetId: `e2e-main-${key}`,
  };
}

export function makeId(testInfo: TestInfo, prefix: string): string {
  return `${prefix}-${makeTestKey(testInfo)}`;
}

export interface ProductFixture {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  category_id: string;
  has_variants: boolean;
  created_at: string;
  deleted_at: string | null;
}

export interface CategoryFixture {
  id: string;
  name: string;
  created_at: string;
  deleted_at: string | null;
}

export function makeFixtures(testInfo: TestInfo) {
  const now = new Date().toISOString();
  const catId = makeId(testInfo, "cat-1");
  const prod1Id = makeId(testInfo, "prod-1");
  const prod2Id = makeId(testInfo, "prod-2");

  return {
    categories: [
      {
        id: catId,
        name: "Makanan & Minuman",
        created_at: now,
        deleted_at: null,
      },
    ] as CategoryFixture[],
    products: [
      {
        id: prod1Id,
        category_id: catId,
        name: "Nasi Goreng",
        sku: "NASGOR",
        price: 15000,
        stock: 20,
        has_variants: false,
        created_at: now,
        deleted_at: null,
      },
      {
        id: prod2Id,
        category_id: catId,
        name: "Es Teh Manis",
        sku: "ESTEH",
        price: 5000,
        stock: 50,
        has_variants: false,
        created_at: now,
        deleted_at: null,
      },
    ] as ProductFixture[],
    catId,
    prod1Id,
    prod2Id,
  };
}
