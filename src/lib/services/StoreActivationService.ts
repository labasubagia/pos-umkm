/**
 * StoreActivationService.ts — Runtime store activation and monthly sheet management.
 *
 * Responsible for:
 * - Warming the storeMap cache via Drive traversal (TTL-guarded)
 * - Ensuring the current month's spreadsheets exist
 * - Deduplicating concurrent activations via pendingActivations
 */

import { logger } from "@/lib/logger";
import { getStoreMapStore } from "../../store/storeMapStore";
import { makeRepo, storeFolderService } from "../adapters";
import { ACTIVE_PRESET, type MigrationPayload } from "../config/presets";
import { transformMigrationPayload } from "../config/transformer";
import { MigrationError, type StoreRecord } from "./MigrationService";

const PENDING_TTL_MS = 5 * 60 * 1000;
export const STORE_MAP_TTL_MS = PENDING_TTL_MS;

export const pendingActivations = new Map<string, Promise<void>>();

function mm(month: number): string {
  return String(month).padStart(2, "0");
}

function getSubfoldersForSpreadsheet(name: string, year: number): string[] {
  if (name.startsWith("transaction_")) return ["transactions", String(year)];
  if (name.startsWith("log_")) return ["logs", String(year)];
  if (name.startsWith("po_")) return ["po", String(year)];
  if (name.startsWith("stock_")) return ["stock", String(year)];
  return [];
}

class StoreActivationServiceImpl {
  async activateStore(
    store: StoreRecord,
    config: MigrationPayload = ACTIVE_PRESET,
  ): Promise<void> {
    logger.info("StoreActivationService.activateStore: starting", {
      storeId: store.store_id,
      storeName: store.store_name,
    });
    const { store_id: storeId, drive_folder_id: storeFolderId } = store;

    if (!storeFolderId) {
      throw new MigrationError(
        `activateStore: store "${store.store_name}" has no drive_folder_id.`,
      );
    }

    const activation = (async () => {
      const cachedMap = getStoreMapStore(storeId).getState();
      const monthlySheetCount = Object.keys(cachedMap.monthlySheets).reduce(
        (acc, year) =>
          acc + Object.keys(cachedMap.monthlySheets[Number(year)] ?? {}).length,
        0,
      );
      // Cache is only fresh if BOTH master sheets and monthly sheets are present.
      // If monthly sheets are empty but master sheets exist the store was activated
      // before the current month's spreadsheet was created — force a re-traverse.
      const hasMasterSheets = Object.keys(cachedMap.sheets).length > 0;
      const hasMonthlySheets = !config.monthlySheet || monthlySheetCount > 0;
      const isFresh =
        cachedMap.lastTraversedAt !== null &&
        Date.now() - cachedMap.lastTraversedAt < PENDING_TTL_MS &&
        hasMasterSheets &&
        hasMonthlySheets;

      logger.info("StoreActivationService.activateStore: cache isFresh", {
        isFresh,
      });

      if (!isFresh) {
        logger.info(
          "StoreActivationService.activateStore: traversing store folder",
          { storeFolderId },
        );
        const result = await storeFolderService.traverse(storeFolderId, config);
        logger.info("StoreActivationService.activateStore: traverse complete", {
          sheets: Object.keys(result.sheets).length,
          monthlySheets: monthlySheetCount,
        });
        getStoreMapStore(storeId)
          .getState()
          .setStoreMap(storeFolderId, result.sheets, result.monthlySheets);
      }

      logger.info(
        "StoreActivationService.activateStore: ensuring monthly sheets...",
      );
      await this.ensureMonthlySheets(storeId, storeFolderId, config);
      logger.info("StoreActivationService.activateStore: complete");
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
    config: MigrationPayload = ACTIVE_PRESET,
  ): Promise<void> {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const monthStr = mm(currentMonth);

    // Quick exit: current month is already in the store map
    const storeMapBefore = getStoreMapStore(storeId).getState();
    if (storeMapBefore.monthlySheets[currentYear]?.[monthStr]) return;

    // Current month missing — try to create it, capturing the spreadsheetId so we
    // can patch the store map directly if Drive's folder listing hasn't caught up yet.
    const createdId = await this.createMonthlySheet(
      storeId,
      storeFolderId,
      currentYear,
      currentMonth,
      config,
      storeMapBefore,
    );

    // Always traverse when the current month was missing from the store map.
    const updated = await storeFolderService.traverse(storeFolderId, config);

    if (updated.monthlySheets[currentYear]?.[monthStr]) {
      // Traverse returned full metadata — use it.
      getStoreMapStore(storeId)
        .getState()
        .setStoreMap(storeFolderId, updated.sheets, updated.monthlySheets);
    } else if (createdId) {
      // Drive API eventual consistency: the new spreadsheet isn't visible in the
      // folder listing yet. Patch the store map directly with the known ID so the
      // cashier can proceed without waiting for Drive to catch up.
      logger.warn(
        "StoreActivationService: traverse missed newly-created monthly sheet — patching store map directly",
        { storeId, createdId, year: currentYear, month: monthStr },
      );
      const patchedMonthly = { ...updated.monthlySheets };
      if (!patchedMonthly[currentYear]) patchedMonthly[currentYear] = {};
      const name = `transaction_${currentYear}-${monthStr}`;
      const sheetTabs = config.monthlySheet?.sheet ?? {};
      patchedMonthly[currentYear][monthStr] = {
        year: currentYear,
        month: monthStr,
        sheets: Object.fromEntries(
          Object.entries(sheetTabs).map(([tabName, tabConfig]) => [
            tabName,
            {
              spreadsheet_id: createdId,
              spreadsheet_name: name,
              folder_path: `transactions/${currentYear}`,
              sheet_name: tabName,
              sheet_id: 0,
              headers: tabConfig.columns,
            },
          ]),
        ),
      };
      getStoreMapStore(storeId)
        .getState()
        .setStoreMap(storeFolderId, updated.sheets, patchedMonthly);
    } else {
      logger.warn(
        "StoreActivationService: monthly sheet missing from store map and could not be created",
        { storeId, year: currentYear, month: monthStr },
      );
    }
  }

  private async createMonthlySheet(
    storeId: string,
    storeFolderId: string,
    year: number,
    month: number,
    config: MigrationPayload = ACTIVE_PRESET,
    storeMap?: {
      sheets: Record<string, unknown>;
      monthlySheets?: Record<number, Record<string, unknown>>;
    },
  ): Promise<string | false> {
    if (!config.monthlySheet) return false;

    const date = new Date(year, month - 1, 1);
    const transformed = transformMigrationPayload(config, storeId, date);

    const currentStoreMap = storeMap ?? getStoreMapStore(storeId).getState();
    const monthlySheets = currentStoreMap.monthlySheets;
    const existingMonthlyYearMonths = new Set<string>();
    if (monthlySheets) {
      for (const [y, months] of Object.entries(monthlySheets)) {
        if (months) {
          for (const [m] of Object.entries(months)) {
            existingMonthlyYearMonths.add(`${y}-${m}`);
          }
        }
      }
    }
    const existingSpreadsheetNames = new Set(
      Object.values(currentStoreMap.sheets).map(
        (s: unknown) => (s as { spreadsheet_name: string }).spreadsheet_name,
      ),
    );

    let createdSpreadsheetId: string | false = false;

    for (const ss of transformed.spreadsheets) {
      const ssYearMonth = ss.name.match(/(\d{4}-\d{2})$/)?.[1];
      const alreadyExists =
        (ssYearMonth && existingMonthlyYearMonths.has(ssYearMonth)) ||
        existingSpreadsheetNames.has(ss.name);
      if (alreadyExists) continue;

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
        await makeRepo(spreadsheetId, tabName).createTable(tabConfig.columns);
      }

      createdSpreadsheetId = spreadsheetId;
    }

    return createdSpreadsheetId;
  }
}

export const StoreActivationService = new StoreActivationServiceImpl();
