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

import { getStoreMapStore } from "../../store/storeMapStore";
import { makeRepo, storeFolderService } from "../adapters";
import {
  MASTER_TAB_HEADERS,
  MASTER_TABS,
  type MigrationPayload,
  MONTHLY_TAB_HEADERS,
  MONTHLY_TABS,
  STORE_MULTI_PRESET,
} from "../config/presets";
import {
  extractFolders,
  transformMigrationPayload,
} from "../config/transformer";
import { nowUTC } from "../formatters";
import { generateId } from "../uuid";
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
    config: MigrationPayload = STORE_MULTI_PRESET,
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
        await makeRepo(spreadsheetId, sheetName)._createTable(
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
    config: MigrationPayload = STORE_MULTI_PRESET,
  ): Promise<{ masterId: string; storeId: string; driveFolderId: string }> {
    const storeId = generateId();

    const storeFolderId = await storeFolderService.ensureFolder([
      "apps",
      "pos_umkm",
      "stores",
      storeId,
    ]);

    const sheetTabs = Object.keys(config.sheet);
    const dataSpreadsheetId = await storeFolderService.createSpreadsheet(
      "data",
      storeFolderId ?? undefined,
      sheetTabs,
    );

    for (const [tabName, tabConfig] of Object.entries(config.sheet)) {
      await makeRepo(dataSpreadsheetId, tabName)._createTable(
        tabConfig.columns,
      );
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
      masterId: dataSpreadsheetId,
      storeId,
      driveFolderId: storeFolderId ?? "",
    };
  }

  async initializeMasterSheets(spreadsheetId: string): Promise<void> {
    if (!spreadsheetId) {
      throw new MigrationError(
        "initializeMasterSheets: spreadsheetId is required",
      );
    }
    await Promise.all(
      MASTER_TABS.map((tab) =>
        makeRepo(spreadsheetId, tab)._createTable(
          MASTER_TAB_HEADERS[tab] ?? [],
        ),
      ),
    );
  }

  async initializeMonthlySheets(spreadsheetId: string): Promise<void> {
    if (!spreadsheetId) {
      throw new MigrationError(
        "initializeMonthlySheets: spreadsheetId is required",
      );
    }
    await Promise.all(
      MONTHLY_TABS.map((tab) =>
        makeRepo(spreadsheetId, tab)._createTable(
          MONTHLY_TAB_HEADERS[tab] ?? [],
        ),
      ),
    );
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

    const {
      masterId,
      storeId: newStoreId,
      driveFolderId,
    } = await this.createStore(
      businessName,
      ownerEmail,
      mainId,
      STORE_MULTI_PRESET,
    );

    await this.initializeMasterSheets(masterId);

    const initial = await storeFolderService.traverse(
      driveFolderId,
      STORE_MULTI_PRESET,
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
      STORE_MULTI_PRESET,
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
