/**
 * setup.service.ts — Backward-compatible re-exports + local storage utilities.
 *
 * All migration logic lives in MigrationService. This module re-exports the
 * types and constants callers need and provides the two local utilities
 * (clearSetupStorage, shareSheetWithAllMembers) that are not migration logic.
 */

import { getRepos, storeFolderService } from "../../lib/adapters";

export function clearSetupStorage(): void {
  localStorage.removeItem("mainSpreadsheetId");
}

export async function shareSheetWithAllMembers(
  spreadsheetId: string,
): Promise<void> {
  const members = await getRepos().members.getAll();
  const activeMembers = members.filter(
    (u) =>
      !(u as Record<string, unknown>).deleted_at &&
      (u as Record<string, unknown>).email &&
      (u as Record<string, unknown>).email !== "",
  );
  await Promise.all(
    activeMembers.map((u) =>
      storeFolderService.shareSpreadsheet(
        spreadsheetId,
        (u as Record<string, unknown>).email as string,
        "editor",
      ),
    ),
  );
}
