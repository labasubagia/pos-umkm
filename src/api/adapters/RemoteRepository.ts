export interface IRemoteRepository<T extends Record<string, unknown>> {
  readonly spreadsheetId: string;
  readonly sheetName: string;
  getAll(): Promise<T[]>;
  batchInsert(rows: Array<Partial<T> & Record<string, unknown>>): Promise<void>;
  batchUpdate(rows: Array<Partial<T> & Record<string, unknown>>): Promise<void>;
  softDelete(rowId: string): Promise<void>;
  createTable(columns: string[]): Promise<void>;
}
