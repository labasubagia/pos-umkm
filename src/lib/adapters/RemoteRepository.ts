export interface IRemoteRepository<T extends Record<string, unknown>> {
  readonly spreadsheetId: string;
  readonly sheetName: string;
  getAll(): Promise<T[]>;
  batchInsert(rows: Array<Partial<T> & Record<string, unknown>>): Promise<void>;
  batchUpdate(
    updates: Array<{ rowId: string; column: string; value: unknown }>,
  ): Promise<void>;
  softDelete(rowId: string): Promise<void>;
  _createTable(columns: string[]): Promise<void>;
}
