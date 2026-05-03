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

import type { IRemoteRepository } from "../RemoteRepository";
import * as sheetsOps from "./sheets/sheets.ops";

export class SheetRepository<T extends Record<string, unknown>>
  implements IRemoteRepository<T>
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

  async getAll(): Promise<T[]> {
    return sheetsOps.getAll(
      this.spreadsheetId,
      this.sheetName,
      this.getToken(),
    ) as Promise<T[]>;
  }

  async batchInsert(
    rows: Array<Partial<T> & Record<string, unknown>>,
  ): Promise<void> {
    await sheetsOps.batchInsert(
      this.spreadsheetId,
      this.sheetName,
      rows as Record<string, unknown>[],
      this.getToken(),
      this.knownHeaders,
    );
  }

  async batchUpdate(
    rows: Array<Partial<T> & Record<string, unknown>>,
  ): Promise<void> {
    const updates = rows.flatMap(({ id, ...fields }) =>
      Object.entries(fields).map(([column, value]) => ({
        rowId: id as string,
        column,
        value,
      })),
    );
    await sheetsOps.batchUpdate(
      this.spreadsheetId,
      this.sheetName,
      updates,
      this.getToken(),
    );
  }

  async softDelete(rowId: string): Promise<void> {
    await sheetsOps.softDelete(
      this.spreadsheetId,
      this.sheetName,
      rowId,
      this.getToken(),
    );
  }

  async createTable(headers: string[]): Promise<void> {
    await sheetsOps.writeHeaders(
      this.spreadsheetId,
      this.sheetName,
      headers,
      this.getToken(),
    );
  }
}
