/**
 * transformer.ts — Converts config payloads into actionable spreadsheet structures.
 *
 * Replaces placeholders: <storeId>, <year>, <month>, <year>-<month>
 */

import type {
  MigrationPayload,
  SpreadsheetConfig,
  TransformedConfig,
  TransformedSpreadsheet,
} from "./types";

function padMonth(month: number): string {
  return String(month).padStart(2, "0");
}

function replacePlaceholders(
  input: string,
  storeId: string,
  year: number,
  month: number,
): string {
  const mm = padMonth(month);
  return input
    .replace(/<storeId>/g, storeId)
    .replace(/<year>/g, String(year))
    .replace(/<month>/g, mm)
    .replace(/<year>-<month>/g, `${year}-${mm}`)
    .replace(/<year>_<month>/g, `${year}_${mm}`);
}

function pathToParts(path: string): string[] {
  return path.split("/").filter(Boolean);
}

function groupByPath(
  config: SpreadsheetConfig,
  storeId: string,
  year: number,
  month: number,
): Map<string, { pathParts: string[]; sheets: SpreadsheetConfig }> {
  const grouped = new Map<
    string,
    { pathParts: string[]; sheets: SpreadsheetConfig }
  >();

  for (const [sheetName, sheetConfig] of Object.entries(config)) {
    const resolvedPath = replacePlaceholders(
      sheetConfig.path,
      storeId,
      year,
      month,
    );
    const pathParts = pathToParts(resolvedPath);
    const spreadsheetName = pathParts.pop() ?? "unknown";
    const parentPath = pathParts.join("/");
    const groupKey = `${parentPath}/${spreadsheetName}`;

    const group = grouped.get(groupKey);
    if (group) {
      group.sheets[sheetName] = {
        path: resolvedPath,
        columns: sheetConfig.columns,
      };
    } else {
      grouped.set(groupKey, {
        pathParts,
        sheets: {
          [sheetName]: {
            path: resolvedPath,
            columns: sheetConfig.columns,
          },
        },
      });
    }
  }

  return grouped;
}

function extractNameFromSheets(sheets: SpreadsheetConfig): string {
  const firstSheet = Object.values(sheets)[0];
  if (!firstSheet) return "unknown";
  const parts = pathToParts(firstSheet.path);
  return parts.pop() ?? "unknown";
}

export function transformMigrationPayload(
  payload: MigrationPayload,
  storeId: string,
  date: Date,
): TransformedConfig {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;

  const spreadsheets: TransformedSpreadsheet[] = [];

  const grouped = groupByPath(payload.sheet, storeId, year, month);
  for (const [, group] of grouped.entries()) {
    const name = extractNameFromSheets(group.sheets);
    spreadsheets.push({
      name,
      pathParts: group.pathParts,
      sheets: group.sheets,
    });
  }

  if (payload.monthlySheet) {
    const monthlyGrouped = groupByPath(
      payload.monthlySheet.sheet,
      storeId,
      year,
      month,
    );
    for (const [, group] of monthlyGrouped.entries()) {
      const name = extractNameFromSheets(group.sheets);
      spreadsheets.push({
        name,
        pathParts: group.pathParts,
        sheets: group.sheets,
      });
    }
  }

  return { spreadsheets };
}

export function transformMainConfig(config: {
  Stores: { path: string; columns: string[] };
}): { spreadsheets: TransformedSpreadsheet[] } {
  const pathParts = pathToParts(config.Stores.path);
  const name = pathParts.pop() ?? "main";

  return {
    spreadsheets: [
      {
        name,
        pathParts,
        sheets: {
          Stores: {
            path: config.Stores.path,
            columns: config.Stores.columns,
          },
        },
      },
    ],
  };
}

export function extractFolders(config: TransformedConfig): string[][] {
  const folderSet = new Set<string>();

  for (const ss of config.spreadsheets) {
    if (ss.pathParts.length > 0) {
      let current = "";
      for (const part of ss.pathParts) {
        current = current ? `${current}/${part}` : part;
        folderSet.add(current);
      }
    }
  }

  return Array.from(folderSet)
    .sort()
    .map((p) => p.split("/").filter(Boolean));
}

export function extractSpreadsheetNames(config: TransformedConfig): string[] {
  return config.spreadsheets.map((s) => s.name);
}
