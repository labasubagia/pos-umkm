/**
 * DriveClient — abstracts Google Drive + spreadsheet management operations.
 *
 * Separates Drive-level operations (create spreadsheet, folder management,
 * sharing) from row-level data access (SheetRepository).
 */
import * as driveClient from "./google/drive/drive.client";

export interface IDriveClient {
  createSpreadsheet(
    name: string,
    parentFolderId?: string,
    tabs?: string[],
  ): Promise<string>;
  ensureFolder(path: string[]): Promise<string | null>;
  shareSpreadsheet(
    spreadsheetId: string,
    email: string,
    role: "editor" | "viewer",
  ): Promise<void>;
  getSpreadsheetId(key: string): string | null;
}

export class GoogleDriveClient implements IDriveClient {
  private readonly getToken: () => string;

  constructor(getToken: () => string) {
    this.getToken = getToken;
  }

  createSpreadsheet(
    name: string,
    parentFolderId?: string,
    tabs?: string[],
  ): Promise<string> {
    return driveClient.createSpreadsheet(
      name,
      this.getToken(),
      parentFolderId,
      tabs,
    );
  }

  ensureFolder(path: string[]): Promise<string | null> {
    return driveClient.ensureFolder(path, this.getToken());
  }

  shareSpreadsheet(
    spreadsheetId: string,
    email: string,
    role: "editor" | "viewer",
  ): Promise<void> {
    return driveClient.shareSpreadsheet(
      spreadsheetId,
      email,
      role,
      this.getToken(),
    );
  }

  getSpreadsheetId(key: string): string | null {
    return localStorage.getItem(key);
  }
}
