/**
 * StoreRegistryService.ts — Main spreadsheet registry and auth persistence.
 *
 * Responsible for:
 * - Creating and reading the main spreadsheet (Stores tab)
 * - Auth/localStorage helpers for mainSpreadsheetId
 * - findOrCreateMain orchestration
 */

import { logger } from "@/utils/logger";
import { MAIN_PRESET, type MainConfigPayload } from "../../config/presets";
import { useAuthStore } from "../../store/authStore";
import { makeRepo, storeFolderService } from "../adapters";
import { MigrationError, type StoreRecord } from "./MigrationService";

export function getMainSpreadsheetId(): string | null {
  return (
    useAuthStore.getState().mainSpreadsheetId ??
    localStorage.getItem("mainSpreadsheetId")
  );
}

export function saveMainSpreadsheetId(id: string): void {
  useAuthStore.getState().setMainSpreadsheetId(id);
  localStorage.setItem("mainSpreadsheetId", id);
}

class StoreRegistryServiceImpl {
  async initMain(config: MainConfigPayload = MAIN_PRESET): Promise<string> {
    logger.info("StoreRegistryService.initMain: starting...");
    const folderId = await storeFolderService.ensureFolder([
      "apps",
      "pos_umkm",
    ]);
    const spreadsheetId = await storeFolderService.createSpreadsheet(
      "main",
      folderId ?? undefined,
      ["Stores"],
    );
    logger.info("StoreRegistryService.initMain: spreadsheet created", {
      spreadsheetId,
    });
    await makeRepo(spreadsheetId, "Stores").createTable(config.Stores.columns);
    return spreadsheetId;
  }

  async listStores(mainSpreadsheetId?: string): Promise<StoreRecord[]> {
    logger.info("StoreRegistryService.listStores: starting...");
    const mainId = mainSpreadsheetId ?? getMainSpreadsheetId();
    if (!mainId) return [];

    const rows = await makeRepo(mainId, "Stores").getAll();
    logger.info("StoreRegistryService.listStores: got rows", {
      count: rows.length,
    });
    return rows
      .filter((r) => r.store_id && r.drive_folder_id)
      .map((r) => ({
        store_id: String(r.store_id),
        store_name: String(r.store_name ?? ""),
        drive_folder_id: String(r.drive_folder_id ?? ""),
        owner_email: String(r.owner_email ?? ""),
        my_role: String(r.my_role ?? "owner"),
        joined_at: String(r.joined_at ?? ""),
      }));
  }

  async updateStoreName(storeId: string, newName: string): Promise<void> {
    const mainId = getMainSpreadsheetId();
    if (!mainId) {
      throw new MigrationError("updateStoreName: mainSpreadsheetId not found");
    }
    await makeRepo(mainId, "Stores").batchUpdate([
      { rowId: storeId, column: "store_name", value: newName },
    ]);
  }

  async ensureStoreFolders(): Promise<void> {
    const mainId = getMainSpreadsheetId();
    if (!mainId) return;

    const rows = await makeRepo(mainId, "Stores").getAll();
    for (const row of rows) {
      if (row.store_id && row.drive_folder_id) {
        await storeFolderService.ensureFolder([
          "apps",
          "pos_umkm",
          "stores",
          String(row.store_id),
        ]);
      }
    }
  }

  async findOrCreateMain(
    ownerEmail = "",
  ): Promise<{ mainSpreadsheetId: string; stores: StoreRecord[] }> {
    void ownerEmail;
    try {
      let mainId = getMainSpreadsheetId();
      if (!mainId) {
        mainId = await this.initMain();
        saveMainSpreadsheetId(mainId);
      }
      const stores = await this.listStores(mainId);
      return { mainSpreadsheetId: mainId, stores };
    } catch (err) {
      throw new MigrationError(`findOrCreateMain failed: ${String(err)}`, err);
    }
  }
}

export const StoreRegistryService = new StoreRegistryServiceImpl();
