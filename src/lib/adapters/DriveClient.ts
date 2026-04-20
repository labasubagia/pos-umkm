/**
 * DriveClient — abstracts Google Drive + spreadsheet management operations.
 *
 * Separates Drive-level operations (create spreadsheet, folder management,
 * sharing) from row-level data access (SheetRepository). Two implementations:
 *   - GoogleDriveClient: real Drive API via drive.client.ts
 *   - MockDriveClient: no-op / generates fake IDs for dev/test
 */
import * as driveClient from './google/drive/drive.client'

export interface IDriveClient {
  createSpreadsheet(name: string, parentFolderId?: string, tabs?: string[]): Promise<string>
  ensureFolder(path: string[]): Promise<string | null>
  shareSpreadsheet(spreadsheetId: string, email: string, role: 'editor' | 'viewer'): Promise<void>
  getSpreadsheetId(key: string): string | null
}

export class GoogleDriveClient implements IDriveClient {
  private readonly getToken: () => string

  constructor(getToken: () => string) {
    this.getToken = getToken
  }

  createSpreadsheet(name: string, parentFolderId?: string, tabs?: string[]): Promise<string> {
    return driveClient.createSpreadsheet(name, this.getToken(), parentFolderId, tabs)
  }

  ensureFolder(path: string[]): Promise<string | null> {
    return driveClient.ensureFolder(path, this.getToken())
  }

  shareSpreadsheet(spreadsheetId: string, email: string, role: 'editor' | 'viewer'): Promise<void> {
    return driveClient.shareSpreadsheet(spreadsheetId, email, role, this.getToken())
  }

  getSpreadsheetId(key: string): string | null {
    return localStorage.getItem(key)
  }
}

export class MockDriveClient implements IDriveClient {
  async createSpreadsheet(_name: string, _parentFolderId?: string, _tabs?: string[]): Promise<string> {
    const id = crypto.randomUUID()
    localStorage.setItem('mock_masterSpreadsheetId', id)
    return id
  }

  async ensureFolder(_path: string[]): Promise<string | null> {
    return null
  }

  async shareSpreadsheet(spreadsheetId: string, email: string, role: 'editor' | 'viewer'): Promise<void> {
    console.debug(`[MockDriveClient] shareSpreadsheet: ${spreadsheetId} → ${email} (${role})`)
  }

  getSpreadsheetId(key: string): string | null {
    return localStorage.getItem(key)
  }
}
