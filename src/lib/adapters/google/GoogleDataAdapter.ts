/**
 * GoogleDataAdapter — DataAdapter implementation backed by Google Sheets API v4.
 *
 * Thin orchestrator: manages spreadsheetId state and routes each interface
 * method to the appropriate sub-module:
 *   - sheets/sheets.ops.ts  — row read/write/update operations
 *   - drive/drive.client.ts — spreadsheet creation, folder management, sharing
 *
 * Tab naming convention: sheet tabs are named exactly as the `sheetName`
 * argument (e.g., "Products", "Transactions_2026-04"). The first row of each
 * tab is always the header row; data starts at row 2.
 */
import type { DataAdapter } from '../types'
import * as sheetsOps from './sheets/sheets.ops'
import * as driveClient from './drive/drive.client'

const MASTER_LS_KEY = 'masterSpreadsheetId'

/** Tabs that live in the monthly transaction spreadsheet (not the master). */
const MONTHLY_TAB_NAMES = new Set(['Transactions', 'Transaction_Items', 'Refunds'])

export class GoogleDataAdapter implements DataAdapter {
  private spreadsheetId: string        // master spreadsheet
  private monthlySpreadsheetId: string // current month's transaction spreadsheet
  private readonly getToken: () => string

  constructor(spreadsheetId: string, getToken: () => string) {
    this.spreadsheetId = spreadsheetId
    this.monthlySpreadsheetId = ''
    this.getToken = getToken
  }

  /** Routes to monthly spreadsheet for transaction tabs; master for everything else. */
  private resolveId(sheetName: string): string {
    if (MONTHLY_TAB_NAMES.has(sheetName) && this.monthlySpreadsheetId) {
      return this.monthlySpreadsheetId
    }
    return this.spreadsheetId
  }

  async getSheet(sheetName: string): Promise<Record<string, unknown>[]> {
    return sheetsOps.getSheet(this.resolveId(sheetName), sheetName, this.getToken())
  }

  async writeHeaders(sheetName: string, headers: string[]): Promise<void> {
    return sheetsOps.writeHeaders(this.resolveId(sheetName), sheetName, headers, this.getToken())
  }

  async appendRow(sheetName: string, row: Record<string, unknown>): Promise<void> {
    return sheetsOps.appendRow(this.resolveId(sheetName), sheetName, row, this.getToken())
  }

  async updateCell(sheetName: string, rowId: string, column: string, value: unknown): Promise<void> {
    return sheetsOps.updateCell(this.resolveId(sheetName), sheetName, rowId, column, value, this.getToken())
  }

  async batchUpdateCells(
    sheetName: string,
    updates: Array<{ rowId: string; column: string; value: unknown }>,
  ): Promise<void> {
    return sheetsOps.batchUpdateCells(this.resolveId(sheetName), sheetName, updates, this.getToken())
  }

  async batchUpsertByKey(
    sheetName: string,
    lookupColumn: string,
    updateColumn: string,
    entries: Array<{ lookupValue: string; value: unknown }>,
    makeNewRow: (lookupValue: string, value: unknown) => Record<string, unknown>,
  ): Promise<void> {
    return sheetsOps.batchUpsertByKey(
      this.resolveId(sheetName), sheetName, lookupColumn, updateColumn, entries, makeNewRow, this.getToken(),
    )
  }

  async softDelete(sheetName: string, rowId: string): Promise<void> {
    return sheetsOps.softDelete(this.resolveId(sheetName), sheetName, rowId, this.getToken())
  }

  /** Updates the active spreadsheetId so subsequent calls target the right sheet. */
  setSpreadsheetId(id: string): void {
    this.spreadsheetId = id
  }

  /** Routes Transactions/Transaction_Items/Refunds writes to the monthly spreadsheet. */
  setMonthlySpreadsheetId(id: string): void {
    this.monthlySpreadsheetId = id
  }

  async createSpreadsheet(name: string, parentFolderId?: string, tabs?: string[]): Promise<string> {
    return driveClient.createSpreadsheet(name, this.getToken(), parentFolderId, tabs)
  }

  /** Reads the master spreadsheetId from the canonical localStorage key. */
  getSpreadsheetId(_key: string): string | null {
    return localStorage.getItem(MASTER_LS_KEY)
  }

  async ensureFolder(path: string[]): Promise<string | null> {
    return driveClient.ensureFolder(path, this.getToken())
  }

  async shareSpreadsheet(spreadsheetId: string, email: string, role: 'editor' | 'viewer'): Promise<void> {
    return driveClient.shareSpreadsheet(spreadsheetId, email, role, this.getToken())
  }
}
