/**
 * MigrationService.ts — Store provisioning and setup orchestration.
 *
 * Responsible for:
 * - Creating the store Drive folder and data spreadsheet (createStore)
 * - Writing header rows for master/monthly tabs (initializeMasterSheets, initializeMonthlySheets)
 * - One-shot config-driven bootstrap (migrate)
 * - Full setup orchestration (runStoreSetup, runFirstTimeSetup)
 *
 * Delegates runtime activation to StoreActivationService
 * and main-spreadsheet registry to StoreRegistryService.
 */

import { ACTIVE_PRESET, type MigrationPayload } from "../../config/presets";
import {
  extractFolders,
  transformMigrationPayload,
} from "../../config/transformer";
import { getStoreMapStore } from "../../store/storeMapStore";
import { nowUTC } from "../../utils/formatters";
import { generateId } from "../../utils/uuid";
import { makeRepo, storeFolderService } from "../adapters";
import { StoreActivationService } from "./StoreActivationService";
import {
  getMainSpreadsheetId,
  StoreRegistryService,
  saveMainSpreadsheetId,
} from "./StoreRegistryService";

export class MigrationError extends Error {
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "MigrationError";
    this.cause = cause;
  }
}

export interface StoreRecord {
  store_id: string;
  store_name: string;
  drive_folder_id: string;
  owner_email: string;
  my_role: string;
  joined_at: string;
}

class MigrationServiceImpl {
  async migrate(
    storeId: string,
    date: Date,
    config: MigrationPayload = ACTIVE_PRESET,
  ): Promise<Record<string, string>> {
    const transformed = transformMigrationPayload(config, storeId, date);
    const folders = extractFolders(transformed);

    for (const folderPath of folders) {
      await storeFolderService.ensureFolder(folderPath);
    }

    const created: Record<string, string> = {};

    for (const ss of transformed.spreadsheets) {
      const parentFolderId = ss.pathParts.length
        ? await storeFolderService.ensureFolder(ss.pathParts)
        : undefined;

      const spreadsheetId = await storeFolderService.createSpreadsheet(
        ss.name,
        parentFolderId ?? undefined,
        Object.keys(ss.sheets),
      );

      for (const [sheetName, sheetConfig] of Object.entries(ss.sheets)) {
        await makeRepo(spreadsheetId, sheetName).createTable(
          sheetConfig.columns,
        );
      }

      const pathKey =
        ss.pathParts.length > 0
          ? `${ss.pathParts.join("/")}/${ss.name}`
          : ss.name;
      created[pathKey] = spreadsheetId;
    }

    return created;
  }

  async createStore(
    businessName: string,
    ownerEmail: string,
    mainSpreadsheetId: string,
    config: MigrationPayload = ACTIVE_PRESET,
  ): Promise<{ storeId: string; driveFolderId: string }> {
    const storeId = generateId();

    const storeFolderId = await storeFolderService.ensureFolder([
      "apps",
      "pos_umkm",
      "stores",
      storeId,
    ]);

    // Use transformMigrationPayload so the spreadsheet layout respects the
    // config — a split preset produces multiple spreadsheets while a single
    // preset produces one. Pass only config.sheet; monthly sheets are created
    // separately by StoreActivationService.ensureMonthlySheets.
    const transformed = transformMigrationPayload(
      { sheet: config.sheet },
      storeId,
      new Date(),
    );

    for (const ss of transformed.spreadsheets) {
      const parentFolderId = ss.pathParts.length
        ? await storeFolderService.ensureFolder(ss.pathParts)
        : (storeFolderId ?? undefined);

      const spreadsheetId = await storeFolderService.createSpreadsheet(
        ss.name,
        parentFolderId ?? undefined,
        Object.keys(ss.sheets),
      );

      for (const [tabName, tabConfig] of Object.entries(ss.sheets)) {
        await makeRepo(spreadsheetId, tabName).createTable(tabConfig.columns);
      }
    }

    await makeRepo(mainSpreadsheetId, "Stores").batchInsert([
      {
        store_id: storeId,
        store_name: businessName,
        drive_folder_id: storeFolderId ?? "",
        owner_email: ownerEmail,
        my_role: "owner",
        joined_at: nowUTC(),
      },
    ]);

    return {
      storeId,
      driveFolderId: storeFolderId ?? "",
    };
  }

  async runStoreSetup(
    businessName: string,
    ownerEmail = "",
  ): Promise<{ storeId: string; driveFolderId: string }> {
    const mainId = getMainSpreadsheetId();
    if (!mainId) {
      throw new MigrationError(
        "runStoreSetup: mainSpreadsheetId not found. Call runFirstTimeSetup() first.",
      );
    }

    const { storeId: newStoreId, driveFolderId } = await this.createStore(
      businessName,
      ownerEmail,
      mainId,
      ACTIVE_PRESET,
    );

    const initial = await storeFolderService.traverse(
      driveFolderId,
      ACTIVE_PRESET,
    );
    getStoreMapStore(newStoreId)
      .getState()
      .setStoreMap(driveFolderId, initial.sheets, initial.monthlySheets);

    await StoreActivationService.activateStore(
      {
        store_id: newStoreId,
        store_name: businessName,
        drive_folder_id: driveFolderId,
        owner_email: ownerEmail,
        my_role: "owner",
        joined_at: nowUTC(),
      },
      ACTIVE_PRESET,
    );

    return { storeId: newStoreId, driveFolderId };
  }

  async runFirstTimeSetup(
    businessName: string,
    ownerEmail = "",
  ): Promise<{ storeId: string; driveFolderId: string }> {
    let mainId = getMainSpreadsheetId();
    if (!mainId) {
      mainId = await StoreRegistryService.initMain();
      saveMainSpreadsheetId(mainId);
    }
    return this.runStoreSetup(businessName, ownerEmail);
  }
}

export const MigrationService = new MigrationServiceImpl();
