/**
 * TypeScript types for the Google Sheets API v4 response shapes used by
 * sheets.client.ts. Keeping them isolated here means GoogleDataAdapter and
 * tests can import just the types without pulling in fetch logic.
 */

/** A 2-D array of cell values as returned by the Sheets API. */
export type SheetValues = (string | number | boolean)[][]

/** Response from values.get */
export interface SheetsGetResponse {
  range: string
  majorDimension: string
  values?: SheetValues
}

/** Response from values.append */
export interface SheetsAppendResponse {
  spreadsheetId: string
  tableRange: string
  updates: {
    spreadsheetId: string
    updatedRange: string
    updatedRows: number
    updatedColumns: number
    updatedCells: number
  }
}

/** Response from values.update */
export interface SheetsUpdateResponse {
  spreadsheetId: string
  updatedRange: string
  updatedRows: number
  updatedColumns: number
  updatedCells: number
}

/** Response from values.batchGet */
export interface SheetsBatchGetResponse {
  spreadsheetId: string
  valueRanges: SheetsGetResponse[]
}

/** Custom error thrown for any Sheets API HTTP error. */
export class SheetsApiError extends Error {
  readonly statusCode: number

  constructor(statusCode: number, message: string) {
    super(message)
    this.name = 'SheetsApiError'
    this.statusCode = statusCode
  }
}
