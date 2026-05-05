import type { TestInfo } from "@playwright/test";

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

export function makeId(testInfo: TestInfo, prefix: string): string {
  return `${prefix}-${makeTestKey(testInfo)}`;
}
