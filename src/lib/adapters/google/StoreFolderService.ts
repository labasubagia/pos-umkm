/**
 * StoreFolderService.ts — Single entry point for data source discovery.
 *
 * Given a store's root Drive folder ID, traverses the folder tree and builds
 * a flat sheet map. This replaces the previous approach
 * of manually tracking spreadsheet IDs across multiple localStorage keys.
 *
 * The folder structure convention:
 *   <store_folder>/
 *     master                    (spreadsheet — master data)
 *     transactions/
 *       2026/
 *         transaction_2026-04  (spreadsheet — monthly transactions)
 *         transaction_2026-05
 *       2027/
 *         ...
 *
 * Usage:
 *   const service = new StoreFolderService(getToken);
 *   const map = await service.traverse(folderId);
 *   // map["Products"] → { spreadsheet_id, sheet_name, sheet_id, headers, ... }
 */

import pLimit from "p-limit";
import type { MigrationPayload } from "@/lib/config/types";
import { logger } from "@/lib/logger";
import { useAuthStore } from "@/store";
import {
  createSpreadsheet,
  type DriveNode,
  ensureFolder,
  getFolderContent,
  MIME_FOLDER,
  MIME_SPREADSHEET,
  shareSpreadsheet,
} from "./drive/drive.client";
import { getSpreadsheetMeta } from "./sheets/sheets.ops";

const DEFAULT_CONCURRENCY = 20;
const DEFAULT_MONTHLY_PREFIXES = ["transaction", "log", "po", "stock"];

const getToken = () => {
  const tokenFromStore = useAuthStore.getState().accessToken;
  if (tokenFromStore) return tokenFromStore;
  return "";
};

export interface SheetMeta {
  spreadsheet_id: string;
  spreadsheet_name: string;
  folder_path: string;
  sheet_name: string;
  sheet_id: number;
  headers: string[];
}

export interface MonthlySheetMeta {
  year: number;
  month: string;
  sheets: Record<string, SheetMeta>;
}

export type MonthlySheetsByYear = Record<
  number,
  Record<string, MonthlySheetMeta>
>;

export interface TraverseResult {
  sheets: Record<string, SheetMeta>;
  monthlySheets: MonthlySheetsByYear;
}

export class StoreFolderService {
  private readonly limit: ReturnType<typeof pLimit>;

  constructor(concurrency = DEFAULT_CONCURRENCY) {
    this.limit = pLimit(concurrency);
  }

  getSpreadsheetId(key: string): string | null {
    return localStorage.getItem(key);
  }

  createSpreadsheet(
    name: string,
    parentFolderId?: string,
    tabs?: string[],
  ): Promise<string> {
    return createSpreadsheet(name, getToken(), parentFolderId, tabs);
  }

  ensureFolder(path: string[], parentId?: string): Promise<string | null> {
    return ensureFolder(path, getToken(), parentId);
  }

  shareSpreadsheet(
    spreadsheetId: string,
    email: string,
    role: "editor" | "viewer",
  ): Promise<void> {
    return shareSpreadsheet(spreadsheetId, email, role, getToken());
  }

  /**
   * Traverses the store folder and returns a flat sheet map + monthly sheets array.
   * Non-transaction sheets are in `sheets` (keyed by sheet name).
   * Monthly transaction spreadsheets are in `monthlySheets` (array, one per month).
   */
  async traverse(
    storeFolderId: string,
    config?: MigrationPayload,
  ): Promise<TraverseResult> {
    const prefixes = config?.monthlySheet?.prefixes ?? DEFAULT_MONTHLY_PREFIXES;
    logger.info("StoreFolderService.traverse: starting", {
      storeFolderId,
      prefixes,
    });
    const tree = await this.traverseRecursive(storeFolderId);
    logger.info("StoreFolderService.traverse: got tree, flattening");
    return this.flattenToMap(tree, prefixes);
  }

  // ─── Drive API ──────────────────────────────────────────────────────────────

  private async traverseRecursive(folderId: string): Promise<DriveNode[]> {
    logger.debug("StoreFolderService.traverseRecursive: folderId", {
      folderId,
    });
    const token = getToken();
    logger.debug("StoreFolderService.traverseRecursive: getFolderContent", {
      folderId,
    });
    const items = await getFolderContent(folderId, token);
    logger.debug("StoreFolderService.traverseRecursive: got items", {
      folderId,
      count: items.length,
    });

    return Promise.all(
      items.map((item) =>
        this.limit(async () => {
          if (item.mimeType === MIME_FOLDER) {
            logger.debug(
              "StoreFolderService.traverseRecursive: entering folder",
              { folderId: item.name },
            );
            item.children = await this.traverseRecursive(item.id);
            logger.debug("StoreFolderService.traverseRecursive: done folder", {
              folderId: item.name,
            });
          } else if (item.mimeType === MIME_SPREADSHEET) {
            logger.debug(
              "StoreFolderService.traverseRecursive: getSpreadsheetMeta",
              { id: item.id, name: item.name },
            );
            item.sheet = await getSpreadsheetMeta(item.id, token);
          }
          return item;
        }),
      ),
    );
  }

  // ─── Flatten ────────────────────────────────────────────────────────────────

  private flattenToMap(
    nodes: DriveNode[],
    prefixes: string[] = DEFAULT_MONTHLY_PREFIXES,
  ): TraverseResult {
    const sheets: Record<string, SheetMeta> = {};
    const monthlySheets: MonthlySheetsByYear = {};
    const pattern = new RegExp(`^(${prefixes.join("|")})_(\\d{4}-\\d{2})$`);

    const walk = (items: DriveNode[], path: string) => {
      for (const item of items) {
        if (item.sheet) {
          const monthMatch = item.name.match(pattern);

          if (monthMatch) {
            const yearMonth = monthMatch[2];
            const yearNum = parseInt(yearMonth.split("-")[0], 10);
            const month = yearMonth.split("-")[1];

            if (!monthlySheets[yearNum]) {
              monthlySheets[yearNum] = {};
            }
            if (!monthlySheets[yearNum][month]) {
              monthlySheets[yearNum][month] = {
                year: yearNum,
                month,
                sheets: {},
              };
            }

            for (const [sheetName, meta] of Object.entries(item.sheet)) {
              monthlySheets[yearNum][month].sheets[sheetName] = {
                spreadsheet_id: meta.spreadsheetId,
                spreadsheet_name: item.name,
                folder_path: path,
                sheet_name: sheetName,
                sheet_id: meta.sheetId,
                headers: meta.headers,
              };
            }
          } else {
            for (const [sheetName, meta] of Object.entries(item.sheet)) {
              sheets[sheetName] = {
                spreadsheet_id: meta.spreadsheetId,
                spreadsheet_name: item.name,
                folder_path: path,
                sheet_name: sheetName,
                sheet_id: meta.sheetId,
                headers: meta.headers,
              };
            }
          }
        }
        if (item.children) {
          const childPath = path ? `${path}/${item.name}` : item.name;
          walk(item.children, childPath);
        }
      }
    };

    walk(nodes, "");
    return { sheets, monthlySheets };
  }
}
