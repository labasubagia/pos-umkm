/**
 * MigrationService.ts — Config-driven spreadsheet migration.
 *
 * Handles:
 * - Main spreadsheet creation
 * - Store folder creation from store rows
 * - Master + monthly spreadsheet creation from config
 */

import { logger } from "@/lib/logger";
import { useAuthStore } from "../../store/authStore";
import { getStoreMapStore } from "../../store/storeMapStore";
import { makeRepo, storeFolderService } from "../adapters";
import {
  MAIN_PRESET,
  type MainConfigPayload,
  type MigrationPayload,
  STORE_MULTI_PRESET,
} from "../config/presets";
import {
  extractFolders,
  transformMigrationPayload,
} from "../config/transformer";
import { nowUTC } from "../formatters";
import { generateId } from "../uuid";

export class MigrationError extends Error {
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "MigrationError";
    this.cause = cause;
  }
}

function mm(month: number): string {
  return String(month).padStart(2, "0");
}

function getSubfoldersForSpreadsheet(name: string, year: number): string[] {
  if (name.startsWith("transaction_")) {
    return ["transactions", String(year)];
  }
  if (name.startsWith("log_")) {
    return ["logs", String(year)];
  }
  if (name.startsWith("po_")) {
    return ["po", String(year)];
  }
  if (name.startsWith("stock_")) {
    return ["stock", String(year)];
  }
  return [];
}

function getMainSpreadsheetId(): string | null {
  return (
    useAuthStore.getState().mainSpreadsheetId ??
    localStorage.getItem("mainSpreadsheetId")
  );
}

export interface StoreRecord {
  store_id: string;
  store_name: string;
  drive_folder_id: string;
  owner_email: string;
  my_role: string;
  joined_at: string;
}

const PENDING_TTL_MS = 5 * 60 * 1000;

const pendingActivations = new Map<string, Promise<void>>();

class MigrationServiceImpl {
  async initMain(config: MainConfigPayload = MAIN_PRESET): Promise<string> {
    logger.info("MigrationService.initMain: starting...");
    const pathParts = ["apps", "pos_umkm"];
    logger.info("MigrationService.initMain: ensuring folder", { pathParts });
    const folderId = await storeFolderService.ensureFolder(pathParts);
    logger.info("MigrationService.initMain: folder created", { folderId });
    const spreadsheetId = await storeFolderService.createSpreadsheet(
      "main",
      folderId ?? undefined,
      ["Stores"],
    );
    logger.info("MigrationService.initMain: spreadsheet created", {
      spreadsheetId,
    });
    await makeRepo(spreadsheetId, "Stores")._createTable(config.Stores.columns);
    return spreadsheetId;
  }

  async ensureStoreFolders(): Promise<void> {
    const mainId = getMainSpreadsheetId();
    if (!mainId) return;

    const rows = await makeRepo(mainId, "Stores").getAll();
    for (const row of rows) {
      if (row.store_id && row.drive_folder_id) {
        const storeId = String(row.store_id);
        await storeFolderService.ensureFolder([
          "apps",
          "pos_umkm",
          "stores",
          storeId,
        ]);
      }
    }
  }

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

  async listStores(mainSpreadsheetId?: string): Promise<StoreRecord[]> {
    logger.info("MigrationService.listStores: starting...");
    const mainId = mainSpreadsheetId ?? getMainSpreadsheetId();
    logger.info("MigrationService.listStores: mainId", { mainId });
    if (!mainId) return [];

    logger.info("MigrationService.listStores: fetching from Stores sheet...");
    const rows = await makeRepo(mainId, "Stores").getAll();
    logger.info("MigrationService.listStores: got rows", {
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

  async activateStore(
    store: StoreRecord,
    config: MigrationPayload = STORE_MULTI_PRESET,
  ): Promise<void> {
    logger.info("MigrationService.activateStore: starting", {
      storeId: store.store_id,
      storeName: store.store_name,
    });
    const { store_id: storeId, drive_folder_id: storeFolderId } = store;
    logger.info("MigrationService.activateStore: storeFolderId", {
      storeFolderId,
    });

    if (!storeFolderId) {
      throw new MigrationError(
        `activateStore: store "${store.store_name}" has no drive_folder_id.`,
      );
    }

    const activation = (async () => {
      logger.info("MigrationService.activateStore: checking cache...");
      const cachedMap = getStoreMapStore(storeId).getState();
      const monthlySheetCount = Object.keys(cachedMap.monthlySheets).reduce(
        (acc, year) =>
          acc + Object.keys(cachedMap.monthlySheets[Number(year)] ?? {}).length,
        0,
      );
      const isFresh =
        cachedMap.lastTraversedAt !== null &&
        Date.now() - cachedMap.lastTraversedAt < PENDING_TTL_MS &&
        (Object.keys(cachedMap.sheets).length > 0 || monthlySheetCount > 0);

      logger.info("MigrationService.activateStore: cache isFresh", { isFresh });

      if (!isFresh) {
        logger.info("MigrationService.activateStore: traversing store folder", {
          storeFolderId,
        });
        const result = await storeFolderService.traverse(storeFolderId);
        logger.info("MigrationService.activateStore: traverse complete", {
          sheets: Object.keys(result.sheets).length,
          monthlySheets: monthlySheetCount,
        });
        getStoreMapStore(storeId)
          .getState()
          .setStoreMap(storeFolderId, result.sheets, result.monthlySheets);
      }

      logger.info("MigrationService.activateStore: ensuring monthly sheets...");
      await this.ensureMonthlySheets(storeId, storeFolderId, config);
      logger.info("MigrationService.activateStore: complete");
    })();

    pendingActivations.set(storeId, activation);
    try {
      await activation;
    } finally {
      pendingActivations.delete(storeId);
    }
  }

  private async ensureMonthlySheets(
    storeId: string,
    storeFolderId: string,
    config: MigrationPayload = STORE_MULTI_PRESET,
  ): Promise<void> {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const monthsToEnsure = [{ year: currentYear, month: currentMonth }];

    const storeMap = getStoreMapStore(storeId).getState();
    let created = false;

    for (const { year, month } of monthsToEnsure) {
      const result = await this.createMonthlySheet(
        storeId,
        storeFolderId,
        year,
        month,
        config,
        storeMap,
      );
      if (result) {
        created = true;
      }
    }

    if (created) {
      const updated = await storeFolderService.traverse(storeFolderId);
      getStoreMapStore(storeId)
        .getState()
        .setStoreMap(storeFolderId, updated.sheets, updated.monthlySheets);
    }
  }

  private async createMonthlySheet(
    storeId: string,
    storeFolderId: string,
    year: number,
    month: number,
    config: MigrationPayload = STORE_MULTI_PRESET,
    storeMap?: {
      sheets: Record<string, unknown>;
      monthlySheets?: Record<number, Record<string, unknown>>;
    },
  ): Promise<boolean> {
    if (!config.monthlySheet) {
      return false;
    }

    const yearMonth = `${year}-${mm(month)}`;
    const date = new Date(year, month - 1, 1);
    const transformed = transformMigrationPayload(config, storeId, date);

    const currentStoreMap = storeMap ?? getStoreMapStore(storeId).getState();
    const monthlySheets = currentStoreMap.monthlySheets;
    const existingMonthlyYearMonths = new Set<string>();
    if (monthlySheets) {
      for (const [year, months] of Object.entries(monthlySheets)) {
        if (months) {
          for (const [month, _meta] of Object.entries(months)) {
            existingMonthlyYearMonths.add(`${year}-${month}`);
          }
        }
      }
    }
    const existingSpreadsheetNames = new Set(
      Object.values(currentStoreMap.sheets).map(
        (s: unknown) => (s as { spreadsheet_name: string }).spreadsheet_name,
      ),
    );

    let createdAny = false;

    for (const ss of transformed.spreadsheets) {
      const ssYearMonth = ss.name.match(/(\d{4}-\d{2})$/)?.[1];
      const alreadyExists =
        (ssYearMonth && existingMonthlyYearMonths.has(ssYearMonth)) ||
        existingSpreadsheetNames.has(ss.name);
      if (alreadyExists) {
        continue;
      }

      const subfolders = getSubfoldersForSpreadsheet(ss.name, year);
      const parentFolderId = subfolders.length
        ? await storeFolderService.ensureSubfolder(storeFolderId, subfolders)
        : storeFolderId;

      const spreadsheetId = await storeFolderService.createSpreadsheet(
        ss.name,
        parentFolderId ?? undefined,
        Object.keys(ss.sheets),
      );

      for (const [tabName, tabConfig] of Object.entries(ss.sheets)) {
        await makeRepo(spreadsheetId, tabName)._createTable(tabConfig.columns);
      }

      const dataSpreadsheetId = Object.values(currentStoreMap.sheets)[0] as
        | { spreadsheet_id: string }
        | undefined;
      if (dataSpreadsheetId) {
        await makeRepo(
          dataSpreadsheetId.spreadsheet_id,
          "Monthly_Sheets",
        ).batchInsert([
          {
            id: generateId(),
            year_month: yearMonth,
            spreadsheetId: spreadsheetId,
            created_at: nowUTC(),
          },
        ]);
      }

      createdAny = true;
    }

    return createdAny;
  }
}

export const MigrationService = new MigrationServiceImpl();
