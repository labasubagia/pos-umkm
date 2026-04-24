/**
 * SheetRepository — immutable, per-sheet data access object.
 *
 * Each instance is bound to a single (spreadsheetId, sheetName) pair at
 * construction time. There are no setters — switching spreadsheets means
 * creating a new instance, not mutating an existing one.
 *
 * Backed by sheetsOps (Google Sheets API v4). The mock equivalent is
 * MockSheetRepository which uses localStorage instead.
 */
import * as sheetsOps from "./google/sheets/sheets.ops";

export interface ISheetRepository<T extends Record<string, unknown>> {
  readonly spreadsheetId: string;
  readonly sheetName: string;
  getAll(): Promise<T[]>;
  batchAppend(rows: Array<Partial<T> & Record<string, unknown>>): Promise<void>;
  batchUpdateCells(
    updates: Array<{ rowId: string; column: string; value: unknown }>,
  ): Promise<void>;
  batchUpsertByKey(
    lookupColumn: string,
    updateColumn: string,
    entries: Array<{ lookupValue: string; value: unknown }>,
    makeNewRow: (
      lookupValue: string,
      value: unknown,
    ) => Record<string, unknown>,
  ): Promise<void>;
  softDelete(rowId: string): Promise<void>;
  writeHeaders(headers: string[]): Promise<void>;
}

export class SheetRepository<T extends Record<string, unknown>>
  implements ISheetRepository<T>
{
  readonly spreadsheetId: string;
  readonly sheetName: string;
  private readonly getToken: () => string;
  private readonly knownHeaders?: string[];

  constructor(
    spreadsheetId: string,
    sheetName: string,
    getToken: () => string,
    knownHeaders?: string[],
  ) {
    this.spreadsheetId = spreadsheetId;
    this.sheetName = sheetName;
    this.getToken = getToken;
    this.knownHeaders = knownHeaders;
  }

  getAll(): Promise<T[]> {
    return sheetsOps.getSheet(
      this.spreadsheetId,
      this.sheetName,
      this.getToken(),
    ) as Promise<T[]>;
  }

  batchAppend(
    rows: Array<Partial<T> & Record<string, unknown>>,
  ): Promise<void> {
    return sheetsOps.batchAppendRows(
      this.spreadsheetId,
      this.sheetName,
      rows as Record<string, unknown>[],
      this.getToken(),
      this.knownHeaders,
    );
  }

  batchUpdateCells(
    updates: Array<{ rowId: string; column: string; value: unknown }>,
  ): Promise<void> {
    return sheetsOps.batchUpdateCells(
      this.spreadsheetId,
      this.sheetName,
      updates,
      this.getToken(),
    );
  }

  batchUpsertByKey(
    lookupColumn: string,
    updateColumn: string,
    entries: Array<{ lookupValue: string; value: unknown }>,
    makeNewRow: (
      lookupValue: string,
      value: unknown,
    ) => Record<string, unknown>,
  ): Promise<void> {
    return sheetsOps.batchUpsertByKey(
      this.spreadsheetId,
      this.sheetName,
      lookupColumn,
      updateColumn,
      entries,
      makeNewRow,
      this.getToken(),
    );
  }

  softDelete(rowId: string): Promise<void> {
    return sheetsOps.softDelete(
      this.spreadsheetId,
      this.sheetName,
      rowId,
      this.getToken(),
    );
  }

  writeHeaders(headers: string[]): Promise<void> {
    return sheetsOps.writeHeaders(
      this.spreadsheetId,
      this.sheetName,
      headers,
      this.getToken(),
    );
  }
}
