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

const DEFAULT_CONCURRENCY = 5;

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
  yearMonth: string;
  sheets: Record<string, SheetMeta>;
}

export interface TraverseResult {
  sheets: Record<string, SheetMeta>;
  monthlySheets: MonthlySheetMeta[];
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

  ensureFolder(path: string[]): Promise<string | null> {
    return ensureFolder(path, getToken());
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
  async traverse(storeFolderId: string): Promise<TraverseResult> {
    const tree = await this.traverseRecursive(storeFolderId);
    return this.flattenToMap(tree);
  }

  // ─── Drive API ──────────────────────────────────────────────────────────────

  private async traverseRecursive(folderId: string): Promise<DriveNode[]> {
    const token = getToken();
    const items = await getFolderContent(folderId, token);

    return Promise.all(
      items.map((item) =>
        this.limit(async () => {
          if (item.mimeType === MIME_FOLDER) {
            item.children = await this.traverseRecursive(item.id);
          } else if (item.mimeType === MIME_SPREADSHEET) {
            item.sheet = await getSpreadsheetMeta(item.id, token);
          }
          return item;
        }),
      ),
    );
  }

  // ─── Flatten ────────────────────────────────────────────────────────────────

  private flattenToMap(nodes: DriveNode[]): TraverseResult {
    const sheets: Record<string, SheetMeta> = {};
    const monthlySheets: MonthlySheetMeta[] = [];

    const walk = (items: DriveNode[], path: string) => {
      for (const item of items) {
        if (item.sheet) {
          const monthMatch = item.name.match(/^transaction_(\d{4}-\d{2})$/);

          if (monthMatch) {
            const monthlyEntry: MonthlySheetMeta = {
              yearMonth: monthMatch[1],
              sheets: {},
            };
            for (const [sheetName, meta] of Object.entries(item.sheet)) {
              monthlyEntry.sheets[sheetName] = {
                spreadsheet_id: meta.spreadsheetId,
                spreadsheet_name: item.name,
                folder_path: path,
                sheet_name: sheetName,
                sheet_id: meta.sheetId,
                headers: meta.headers,
              };
            }
            monthlySheets.push(monthlyEntry);
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
