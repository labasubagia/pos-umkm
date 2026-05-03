/**
 * types.ts — Config interfaces for spreadsheet migration.
 */

export interface SheetConfig {
  path: string;
  columns: string[];
}

export interface SpreadsheetConfig {
  [sheetName: string]: SheetConfig;
}

export interface MainConfigPayload {
  Stores: SheetConfig;
}

export interface MonthlySheetConfig {
  sheet: SpreadsheetConfig;
  prefixes?: string[];
}

export interface MigrationPayload {
  sheet: SpreadsheetConfig;
  monthlySheet?: MonthlySheetConfig;
}

export interface TransformedSpreadsheet {
  name: string;
  pathParts: string[];
  sheets: SpreadsheetConfig;
}

export interface TransformedConfig {
  spreadsheets: TransformedSpreadsheet[];
}
