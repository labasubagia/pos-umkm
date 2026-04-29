/**
 * StoreFolderService.ts — Single entry point for data source discovery.
 *
 * Given a store's root Drive folder ID, traverses the folder tree and builds
 * a flat map of sheet_name → SheetMeta. This replaces the previous approach
 * of manually tracking mainSpreadsheetId, masterSpreadsheetId, and
 * monthlySpreadsheetId across multiple localStorage keys.
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

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const SHEETS_API = "https://sheets.googleapis.com/v4";

const MIME_FOLDER = "application/vnd.google-apps.folder";
const MIME_SPREADSHEET = "application/vnd.google-apps.spreadsheet";

const DEFAULT_CONCURRENCY = 5;

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

interface DriveNode {
  id: string;
  name: string;
  mimeType: string;
  sheet?: Record<
    string,
    { sheetId: number; spreadsheetId: string; headers: string[] }
  >;
  children?: DriveNode[];
}

export class StoreFolderService {
  private readonly getToken: () => string;
  private readonly limit: ReturnType<typeof pLimit>;

  constructor(getToken: () => string, concurrency = DEFAULT_CONCURRENCY) {
    this.getToken = getToken;
    this.limit = pLimit(concurrency);
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

  private async getFolderContent(folderId: string): Promise<DriveNode[]> {
    const token = this.getToken();
    const q = `'${folderId}' in parents and trashed = false and (mimeType = '${MIME_SPREADSHEET}' or mimeType = '${MIME_FOLDER}')`;
    const url = `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType)&corpora=user`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new Error(
        `StoreFolderService: Drive API ${res.status} for folder ${folderId}`,
      );
    }
    const data = await res.json();
    return (data.files ?? []) as DriveNode[];
  }

  private async traverseRecursive(folderId: string): Promise<DriveNode[]> {
    const items = await this.getFolderContent(folderId);

    return Promise.all(
      items.map((item) =>
        this.limit(async () => {
          if (item.mimeType === MIME_FOLDER) {
            item.children = await this.traverseRecursive(item.id);
          } else if (item.mimeType === MIME_SPREADSHEET) {
            item.sheet = await this.getSpreadsheetMeta(item.id);
          }
          return item;
        }),
      ),
    );
  }

  private async getSpreadsheetMeta(
    spreadsheetId: string,
  ): Promise<
    Record<
      string,
      { sheetId: number; spreadsheetId: string; headers: string[] }
    >
  > {
    const token = this.getToken();

    // Build ranges for header rows (Sheet1!1:1, Sheet2!1:1, etc.)
    // First get sheet list
    const listUrl = `${SHEETS_API}/spreadsheets/${spreadsheetId}?fields=sheets(properties(sheetId,title))`;
    const listRes = await fetch(listUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!listRes.ok) {
      throw new Error(
        `StoreFolderService: Sheets API ${listRes.status} for ${spreadsheetId}`,
      );
    }
    const listData = await listRes.json();
    const sheets = (listData.sheets ?? []) as Array<{
      properties: { sheetId: number; title: string };
    }>;

    const ranges = sheets.map((s) => `${s.properties.title}!1:1`);
    const detailUrl = `${SHEETS_API}/spreadsheets/${spreadsheetId}?fields=sheets(properties(sheetId,title),data(rowData(values(formattedValue))))&${ranges.map((r) => `ranges=${encodeURIComponent(r)}`).join("&")}`;
    const detailRes = await fetch(detailUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!detailRes.ok) {
      throw new Error(
        `StoreFolderService: Sheets API ${detailRes.status} for ${spreadsheetId} detail`,
      );
    }
    const detailData = await detailRes.json();

    const result: Record<
      string,
      { sheetId: number; spreadsheetId: string; headers: string[] }
    > = {};
    for (const sheet of detailData.sheets ?? []) {
      const props = sheet.properties;
      const headers: string[] = [];
      for (const gridData of sheet.data ?? []) {
        for (const row of gridData.rowData ?? []) {
          for (const v of row.values ?? []) {
            headers.push(v.formattedValue ?? "");
          }
          break; // only first row
        }
        break;
      }
      result[props.title] = {
        sheetId: props.sheetId,
        spreadsheetId,
        headers: headers.filter(Boolean),
      };
    }
    return result;
  }

  // ─── Flatten ────────────────────────────────────────────────────────────────

  private flattenToMap(nodes: DriveNode[]): TraverseResult {
    const sheets: Record<string, SheetMeta> = {};
    const monthlySheets: MonthlySheetMeta[] = [];

    const walk = (items: DriveNode[], path: string) => {
      for (const item of items) {
        if (item.sheet) {
          // Check if this is a monthly transaction spreadsheet
          const monthMatch = item.name.match(/^transaction_(\d{4}-\d{2})$/);

          if (monthMatch) {
            // Monthly spreadsheet — store separately
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
            // Non-monthly spreadsheet (master, etc.) — store in main map
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
