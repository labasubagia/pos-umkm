/**
 * setup.service.ts — Owner first-time setup and monthly sheet management.
 *
 * Delegates to MigrationService for config-driven spreadsheet creation.
 * Maintains backward-compatible public API.
 */

import { getRepos, makeRepo, storeFolderService } from "../../lib/adapters";
import {
  MAIN_TAB_HEADERS,
  MAIN_TABS,
  MASTER_TAB_HEADERS,
  MASTER_TABS,
  MONTHLY_TAB_HEADERS,
  MONTHLY_TABS,
} from "../../lib/adapters/zod-schemas";
import { STORE_MULTI_PRESET } from "../../lib/config/presets";
import { useAuthStore } from "../../store/authStore";
import { getStoreMapStore } from "../../store/storeMapStore";

export {
  MAIN_TAB_HEADERS,
  MAIN_TABS,
  MASTER_TAB_HEADERS,
  MASTER_TABS,
  MONTHLY_TAB_HEADERS,
  MONTHLY_TABS,
};

export interface StoreRecord {
  store_id: string;
  store_name: string;
  drive_folder_id: string;
  owner_email: string;
  my_role: string;
  joined_at: string;
}

export class SetupError extends Error {
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "SetupError";
    this.cause = cause;
  }
}

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

export function clearSetupStorage(): void {
  localStorage.removeItem("mainSpreadsheetId");
}

export async function createMainSpreadsheet(ownerEmail = ""): Promise<string> {
  const { MigrationService } = await import(
    "../../lib/services/MigrationService"
  );
  const mainId = await MigrationService.initMain();
  void ownerEmail;
  return mainId;
}

export async function listStores(
  mainSpreadsheetId: string,
): Promise<StoreRecord[]> {
  const { MigrationService } = await import(
    "../../lib/services/MigrationService"
  );
  return MigrationService.listStores(mainSpreadsheetId);
}

export async function updateStoreName(
  storeId: string,
  newName: string,
): Promise<void> {
  const { MigrationService } = await import(
    "../../lib/services/MigrationService"
  );
  await MigrationService.updateStoreName(storeId, newName);
}

export async function findOrCreateMain(
  ownerEmail = "",
): Promise<{ mainSpreadsheetId: string; stores: StoreRecord[] }> {
  void ownerEmail;
  try {
    let mainId = getMainSpreadsheetId();

    if (!mainId) {
      const { MigrationService } = await import(
        "../../lib/services/MigrationService"
      );
      mainId = await MigrationService.initMain();
      saveMainSpreadsheetId(mainId);
    }

    const stores = await listStores(mainId);
    return { mainSpreadsheetId: mainId, stores };
  } catch (err) {
    throw new SetupError(`findOrCreateMain failed: ${String(err)}`, err);
  }
}

export const pendingActivations = new Map<string, Promise<void>>();

export const STORE_MAP_TTL_MS = 5 * 60 * 1000;

export async function activateStore(store: StoreRecord): Promise<void> {
  const { MigrationService } = await import(
    "../../lib/services/MigrationService"
  );
  await MigrationService.activateStore(store);
}

export async function createMasterSpreadsheet(
  businessName: string,
  ownerEmail = "",
  mainSpreadsheetId: string,
): Promise<{ masterId: string; storeId: string; driveFolderId: string }> {
  const { MigrationService } = await import(
    "../../lib/services/MigrationService"
  );
  return MigrationService.createStore(
    businessName,
    ownerEmail,
    mainSpreadsheetId,
  );
}

export async function initializeMasterSheets(
  spreadsheetId: string,
): Promise<void> {
  if (!spreadsheetId) {
    throw new SetupError("initializeMasterSheets: spreadsheetId is required");
  }
  await Promise.all(
    MASTER_TABS.map((tab) =>
      makeRepo(spreadsheetId, tab)._createTable(MASTER_TAB_HEADERS[tab] ?? []),
    ),
  );
}

export async function initializeMonthlySheets(
  spreadsheetId: string,
): Promise<void> {
  if (!spreadsheetId) {
    throw new SetupError("initializeMonthlySheets: spreadsheetId is required");
  }
  await Promise.all(
    MONTHLY_TABS.map((tab) =>
      makeRepo(spreadsheetId, tab)._createTable(MONTHLY_TAB_HEADERS[tab] ?? []),
    ),
  );
}

export async function runStoreSetup(
  businessName: string,
  ownerEmail = "",
): Promise<{ storeId: string; driveFolderId: string }> {
  const mainId = getMainSpreadsheetId();
  if (!mainId) {
    throw new SetupError(
      "runStoreSetup: mainSpreadsheetId not found in localStorage. Call findOrCreateMain() first.",
    );
  }

  const { MigrationService } = await import(
    "../../lib/services/MigrationService"
  );

  const {
    masterId,
    storeId: newStoreId,
    driveFolderId,
  } = await MigrationService.createStore(
    businessName,
    ownerEmail,
    mainId,
    STORE_MULTI_PRESET,
  );

  await initializeMasterSheets(masterId);

  const initial = await storeFolderService.traverse(driveFolderId);
  getStoreMapStore(newStoreId)
    .getState()
    .setStoreMap(driveFolderId, initial.sheets, initial.monthlySheets);

  const { MigrationService: MigrationService2 } = await import(
    "../../lib/services/MigrationService"
  );
  const { nowUTC } = await import("../../lib/formatters");
  await MigrationService2.activateStore(
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

export async function runFirstTimeSetup(
  businessName: string,
  ownerEmail = "",
): Promise<{ storeId: string; driveFolderId: string }> {
  const { mainSpreadsheetId } = await findOrCreateMain(ownerEmail);
  saveMainSpreadsheetId(mainSpreadsheetId);
  return runStoreSetup(businessName, ownerEmail);
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
