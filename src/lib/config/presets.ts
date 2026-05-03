/**
 * presets.ts — Configuration presets.
 *
 * Load from JSON files and export as API.
 * Use whichever preset you need - migrate() accepts any MigrationPayload.
 */

import mainConfig from "./presets/main.json";
import storeMultiConfig from "./presets/store-multi.json";
import storeSingleConfig from "./presets/store-single.json";
import storeSplitConfig from "./presets/store-split.json";
import type { MainConfigPayload, MigrationPayload } from "./types";

export type { MainConfigPayload, MigrationPayload } from "./types";

export const MAIN_PRESET: MainConfigPayload = mainConfig as MainConfigPayload;

export const STORE_PRESETS = {
  multi: storeMultiConfig as MigrationPayload,
  single: storeSingleConfig as MigrationPayload,
  split: storeSplitConfig as MigrationPayload,
};

/**
 * ACTIVE_PRESET — the preset used at runtime.
 * Override via VITE_STORE_PRESET env variable (multi | single | split).
 * Defaults to multi.
 */
const _presetKey = (
  typeof import.meta !== "undefined"
    ? (import.meta.env?.VITE_STORE_PRESET ?? "multi")
    : "multi"
) as keyof typeof STORE_PRESETS;
export const ACTIVE_PRESET: MigrationPayload =
  STORE_PRESETS[_presetKey] ?? STORE_PRESETS.multi;

export const DEFAULT_MONTHLY_PREFIXES = ["transaction", "log", "po", "stock"];

export function getMonthlySheetPrefixes(config: MigrationPayload): string[] {
  return config.monthlySheet?.prefixes ?? DEFAULT_MONTHLY_PREFIXES;
}

export function getTabHeaders(
  config: MigrationPayload,
): Record<string, string[]> {
  const headers: Record<string, string[]> = {};

  for (const [sheetName, sheetConfig] of Object.entries(config.sheet)) {
    headers[sheetName] = sheetConfig.columns;
  }

  if (config.monthlySheet) {
    for (const [sheetName, sheetConfig] of Object.entries(
      config.monthlySheet.sheet,
    )) {
      headers[sheetName] = sheetConfig.columns;
    }
  }

  return headers;
}

export function getTabNames(config: MigrationPayload): {
  main: readonly string[];
  sheet: readonly string[];
  monthly: readonly string[];
} {
  return {
    main: Object.keys(MAIN_PRESET),
    sheet: Object.keys(config.sheet),
    monthly: config.monthlySheet ? Object.keys(config.monthlySheet.sheet) : [],
  };
}

export function getAllTabHeaders(
  config: MigrationPayload,
): Record<string, string[]> {
  return {
    ...getTabHeaders({
      sheet: MAIN_PRESET as unknown as MigrationPayload["sheet"],
    }),
    ...getTabHeaders(config),
  };
}

export const MAIN_TAB_HEADERS: Record<string, string[]> = {
  Stores: MAIN_PRESET.Stores.columns,
};

export const MAIN_TABS: readonly string[] = Object.keys(MAIN_PRESET);

const DATA_TAB_HEADERS = getTabHeaders(ACTIVE_PRESET);

const MONTHLY_TAB_HEADERS = getTabHeaders(
  ACTIVE_PRESET.monthlySheet
    ? { sheet: {}, monthlySheet: ACTIVE_PRESET.monthlySheet }
    : ({ sheet: {} } as MigrationPayload),
);

export const ALL_TAB_HEADERS: Record<string, string[]> = {
  ...MAIN_TAB_HEADERS,
  ...DATA_TAB_HEADERS,
  ...MONTHLY_TAB_HEADERS,
};
