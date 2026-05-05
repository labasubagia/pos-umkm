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
    folderId: `e2e-folder-${key}`,
  };
}

export function makeId(testInfo: TestInfo, prefix: string): string {
  return `${prefix}-${makeTestKey(testInfo)}`;
}
