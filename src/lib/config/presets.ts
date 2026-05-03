/**
 * presets.ts — Configuration presets.
 *
 * Load from JSON files and export as API.
 * Use whichever preset you need - migrate() accepts any MigrationPayload.
 */

import mainConfig from "./presets/main.json";
import storeMultiConfig from "./presets/store-multi.json";
import storeSingleConfig from "./presets/store-single.json";
import type { MainConfigPayload, MigrationPayload } from "./types";

export type { MainConfigPayload, MigrationPayload } from "./types";

export const MAIN_PRESET: MainConfigPayload = mainConfig as MainConfigPayload;

export const STORE_PRESETS = {
  multi: storeMultiConfig as MigrationPayload,
  single: storeSingleConfig as MigrationPayload,
};

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

export const MASTER_TAB_HEADERS = getTabHeaders(STORE_PRESETS.multi);

export const MONTHLY_TAB_HEADERS = getTabHeaders(
  STORE_PRESETS.multi.monthlySheet
    ? { sheet: {}, monthlySheet: STORE_PRESETS.multi.monthlySheet }
    : ({ sheet: {} } as MigrationPayload),
);

export const MASTER_TABS: readonly string[] = Object.keys(
  STORE_PRESETS.multi.sheet,
);

export const MONTHLY_TABS: readonly string[] = STORE_PRESETS.multi.monthlySheet
  ? Object.keys(STORE_PRESETS.multi.monthlySheet.sheet)
  : [];

export const ALL_TAB_HEADERS: Record<string, string[]> = {
  ...MAIN_TAB_HEADERS,
  ...MASTER_TAB_HEADERS,
  ...MONTHLY_TAB_HEADERS,
};

export const STORE_MULTI_PRESET = STORE_PRESETS.multi;

export const STORE_SINGLE_PRESET = STORE_PRESETS.single;
