/**
 * setup.service.ts — Owner first-time setup and monthly sheet management.
 *
 * Responsible for:
 * 1. Detecting or creating the Main spreadsheet (owner's personal store registry).
 * 2. Creating store folder structure (master + transactions/YYYY spreadsheets).
 * 3. Activating a store by traversing its Drive folder to build the sheet map.
 * 4. Pre-creating current + next month's transaction spreadsheets (Option B).
 *
 * The sheet map is the single source of truth for spreadsheet IDs.
 * No more individual spreadsheet ID management in localStorage.
 */

import {
  driveClient,
  getRepos,
  makeRepo,
  storeFolderService,
} from "../../lib/adapters";
import { nowUTC } from "../../lib/formatters";
import {
  MAIN_TAB_HEADERS,
  MAIN_TABS,
  MASTER_TAB_HEADERS,
  MASTER_TABS,
  MONTHLY_TAB_HEADERS,
  MONTHLY_TABS,
} from "../../lib/schema";
import { generateId } from "../../lib/uuid";
import { useAuthStore } from "../../store/authStore";
import {
  getActiveStoreMap,
  setActiveStoreMap,
} from "../../store/storeMapStore";

// Re-export so existing callers that imported from this module continue to work.
export {
  MAIN_TAB_HEADERS,
  MAIN_TABS,
  MASTER_TAB_HEADERS,
  MASTER_TABS,
  MONTHLY_TAB_HEADERS,
  MONTHLY_TABS,
};

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * One row from the main.Stores tab — represents a store the user owns or has joined.
 * This is the shape returned by listStores() and consumed by activateStore().
 */
export interface StoreRecord {
  store_id: string;
  store_name: string;
  master_spreadsheet_id: string;
  drive_folder_id: string;
  owner_email: string;
  my_role: string;
  joined_at: string;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/** Returns the zero-padded month string, e.g. "04" for April. */
function mm(month: number): string {
  return String(month).padStart(2, "0");
}

/** Custom error for setup failures. */
export class SetupError extends Error {
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "SetupError";
    this.cause = cause;
  }
}

/** Returns the mainSpreadsheetId from Zustand (persisted), falling back to the
 *  legacy direct localStorage key for users migrating from pre-Zustand sessions. */
export function getMainSpreadsheetId(): string | null {
  return (
    useAuthStore.getState().mainSpreadsheetId ??
    localStorage.getItem("mainSpreadsheetId")
  );
}

/** Persists the mainSpreadsheetId to Zustand (which persists to localStorage via
 *  the `pos-umkm-auth` key). Also writes the legacy direct key so old code paths
 *  and any backward-compat reads continue to work during the transition period. */
export function saveMainSpreadsheetId(id: string): void {
  useAuthStore.getState().setMainSpreadsheetId(id);
  localStorage.setItem("mainSpreadsheetId", id); // legacy fallback key
}

/**
 * Removes all setup-related localStorage keys. Call this on sign-out to prevent
 * stale spreadsheet IDs from being picked up on the next login (especially if a
 * different Google account signs in on the same device).
 *
 * Note: Zustand `clearAuth()` already clears the persisted `pos-umkm-auth` blob.
 * This function cleans up the additional direct-write keys that setup.service.ts
 * and legacy code paths write to localStorage independently.
 */
export function clearSetupStorage(): void {
  localStorage.removeItem("mainSpreadsheetId");
  localStorage.removeItem("masterSpreadsheetId");
  localStorage.removeItem("activeStoreId");
  localStorage.removeItem("storeFolderId");
  // Clear all monthly transaction sheet cache keys — both store-scoped
  // (txSheet_<storeId>_YYYY-MM) and legacy unscoped (txSheet_YYYY-MM) formats.
  Object.keys(localStorage)
    .filter((k) => k.startsWith("txSheet_"))
    .forEach((k) => {
      localStorage.removeItem(k);
    });
}

// ─── Main Spreadsheet ─────────────────────────────────────────────────────────

/**
 * Creates the `main` spreadsheet at apps/pos_umkm/main in the owner's Drive.
 * This is the owner's private store registry (never shared with members).
 * Called once per Google account — subsequent logins read from it.
 * Writes the Stores tab header row immediately after creation.
 */
export async function createMainSpreadsheet(ownerEmail = ""): Promise<string> {
  try {
    let parentFolderId: string | undefined;
    const fid = await driveClient.ensureFolder(["apps", "pos_umkm"]);
    if (fid) parentFolderId = fid;
    const mainId = await driveClient.createSpreadsheet("main", parentFolderId, [
      ...MAIN_TABS,
    ]);
    await makeRepo(mainId, "Stores").writeHeaders(
      MAIN_TAB_HEADERS.Stores ?? [],
    );
    void ownerEmail; // reserved for future row insertion on member join flow
    return mainId;
  } catch (err) {
    throw new SetupError(`createMainSpreadsheet failed: ${String(err)}`, err);
  }
}

/**
 * Reads all store rows from main.Stores.
 */
export async function listStores(
  mainSpreadsheetId: string,
): Promise<StoreRecord[]> {
  const rows = await makeRepo(mainSpreadsheetId, "Stores").getAll();
  return rows
    .filter((r) => r.store_id && r.master_spreadsheet_id)
    .map((r) => ({
      store_id: String(r.store_id),
      store_name: String(r.store_name ?? ""),
      master_spreadsheet_id: String(r.master_spreadsheet_id),
      drive_folder_id: String(r.drive_folder_id ?? ""),
      owner_email: String(r.owner_email ?? ""),
      my_role: String(r.my_role ?? "owner"),
      joined_at: String(r.joined_at ?? ""),
    }));
}

/**
 * Updates the `store_name` column in the main spreadsheet's `Stores` tab.
 *
 * Called when the owner renames their business in Settings > Profil Bisnis.
 * The main spreadsheet is the registry shared across all stores so the store
 * picker shows the up-to-date name.
 */
export async function updateStoreName(
  storeId: string,
  newName: string,
): Promise<void> {
  const mainId = getMainSpreadsheetId();
  if (!mainId)
    throw new SetupError("updateStoreName: mainSpreadsheetId not found");

  try {
    await makeRepo(mainId, "Stores").batchUpdateCells([
      { rowId: storeId, column: "store_name", value: newName },
    ]);
  } catch (err) {
    if (
      err instanceof Error &&
      err.name === "AdapterError" &&
      err.message.includes("not found")
    ) {
      throw new SetupError(
        `updateStoreName: store ${storeId} not found in main.Stores`,
      );
    }
    throw err;
  }
}

/**
 * Post-login entry point: finds the owner's main spreadsheet or creates it.
 *
 * On every login (not just first-time) this function:
 *   1. Checks localStorage for a cached mainSpreadsheetId (fast path).
 *   2. If not cached: calls createMainSpreadsheet() which uses Drive "find or
 *      create" — searches apps/pos_umkm/ for an existing `main` spreadsheet
 *      before creating a new one. This means clearing localStorage never causes
 *      a duplicate main spreadsheet.
 *   3. Reads and returns the current store list from main.Stores.
 *
 * The caller (StorePickerPage) routes to /setup (0 stores), auto-activates
 * (1 store), or shows the picker (2+ stores).
 */
export async function findOrCreateMain(
  ownerEmail = "",
): Promise<{ mainSpreadsheetId: string; stores: StoreRecord[] }> {
  try {
    let mainId = getMainSpreadsheetId();

    if (!mainId) {
      mainId = await createMainSpreadsheet(ownerEmail);
      saveMainSpreadsheetId(mainId);
    }

    const stores = await listStores(mainId);
    return { mainSpreadsheetId: mainId, stores };
  } catch (err) {
    throw new SetupError(`findOrCreateMain failed: ${String(err)}`, err);
  }
}

// ─── Store Activation ─────────────────────────────────────────────────────────

/**
 * Activates a store by traversing its Drive folder to build the sheet map.
 *
 * This is the new single entry point for store activation. Instead of
 * manually tracking main/master/monthly spreadsheet IDs, we:
 *   1. Traverse the store's Drive folder to discover all spreadsheets
 *   2. Build a flat sheet map (sheet_name → SheetMeta)
 *   3. Pre-create current + next month's transaction sheets (Option B)
 *   4. Re-traverse to pick up newly created sheets
 *
 * @param store  The store record from main.Stores (must have drive_folder_id).
 */
export async function activateStore(store: StoreRecord): Promise<void> {
  const { store_id: storeId, drive_folder_id: storeFolderId } = store;

  if (!storeFolderId) {
    throw new SetupError(
      `activateStore: store "${store.store_name}" has no drive_folder_id. ` +
        `This store may have been created before the folder-based architecture.`,
    );
  }

  // Initialize the store map store for this store_id
  setActiveStoreMap(storeId);

  // Traverse the folder to build the sheet map
  const result = await storeFolderService.traverse(storeFolderId);
  getActiveStoreMap()
    .getState()
    .setStoreMap(storeFolderId, result.sheets, result.monthlySheets);

  // Option B: Pre-create current + next month's sheets if missing
  await ensureMonthlySheets(storeId, storeFolderId);
}

/**
 * Ensures current + next month's transaction spreadsheets exist.
 * Creates any that are missing, then updates the store map with the new sheets.
 * Option B strategy: always have current + next month ready.
 */
async function ensureMonthlySheets(
  storeId: string,
  storeFolderId: string,
): Promise<void> {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // Calculate next month
  const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
  const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;

  const monthsToEnsure = [
    { year: currentYear, month: currentMonth },
    { year: nextYear, month: nextMonth },
  ];

  const storeMap = getActiveStoreMap().getState();
  let created = false;

  for (const { year, month } of monthsToEnsure) {
    const yearMonth = `${year}-${mm(month)}`;
    const sheetName = `transaction_${yearMonth}`;

    // Check if a spreadsheet with this name already exists in the map
    const alreadyExists = Object.values(storeMap.sheets).some(
      (s) => s.spreadsheet_name === sheetName,
    );
    if (alreadyExists) continue;

    // Create the monthly sheet
    try {
      const monthlyId = await createMonthlySheetForStore(
        storeId,
        storeFolderId,
        year,
        month,
      );
      if (monthlyId) {
        created = true;
      }
    } catch (err) {
      // Cashiers may lack drive scope — log and continue
      console.warn(
        `[setup] Failed to pre-create monthly sheet for ${yearMonth}:`,
        err,
      );
    }
  }

  // Re-traverse to pick up any newly created sheets
  if (created) {
    const updated = await storeFolderService.traverse(storeFolderId);
    getActiveStoreMap()
      .getState()
      .setStoreMap(storeFolderId, updated.sheets, updated.monthlySheets);
  }
}

/**
 * Creates a monthly transaction spreadsheet for a specific store.
 * Named "transaction_<year>-<month>" and placed inside the year folder under
 * the store's transactions/<year>/ in Drive.
 * Registers the entry in the master sheet's Monthly_Sheets tab.
 */
async function createMonthlySheetForStore(
  storeId: string,
  _storeFolderId: string,
  year: number,
  month: number,
): Promise<string | null> {
  const yearMonth = `${year}-${mm(month)}`;
  const name = `transaction_${yearMonth}`;

  // Check if it already exists in the store map
  const storeMap = getActiveStoreMap().getState();
  for (const sheet of Object.values(storeMap.sheets)) {
    if (sheet.spreadsheet_name === name) {
      return sheet.spreadsheet_id;
    }
  }

  // Create the year folder and spreadsheet
  const yearFolderId = await driveClient.ensureFolder([
    "apps",
    "pos_umkm",
    "stores",
    storeId,
    "transactions",
    String(year),
  ]);

  const id = await driveClient.createSpreadsheet(
    name,
    yearFolderId ?? undefined,
    [...MONTHLY_TABS],
  );

  // Write headers
  await initializeMonthlySheets(id);

  // Register in Monthly_Sheets tab (read from master spreadsheet in the store map)
  const masterMeta = storeMap.sheets.Monthly_Sheets;
  if (masterMeta) {
    await makeRepo(masterMeta.spreadsheet_id, "Monthly_Sheets").batchAppend([
      {
        id: generateId(),
        year_month: yearMonth,
        spreadsheetId: id,
        created_at: nowUTC(),
      },
    ]);
  }

  return id;
}

// ─── Master Spreadsheet ───────────────────────────────────────────────────────

/**
 * Creates the `master` spreadsheet for a new store and registers it in main.Stores.
 *
 * Assumes the main spreadsheet already exists — call findOrCreateMain() first.
 * Does NOT create main (that is findOrCreateMain's responsibility).
 */
export async function createMasterSpreadsheet(
  businessName: string,
  ownerEmail = "",
  mainSpreadsheetId: string,
): Promise<{ masterId: string; storeId: string; driveFolderId: string }> {
  try {
    const storeId = generateId();

    // ── 1. Create store folder ────────────────────────────────────────────────
    let storeFolderId: string | undefined;
    const fid = await driveClient.ensureFolder([
      "apps",
      "pos_umkm",
      "stores",
      storeId,
    ]);
    if (fid) storeFolderId = fid;

    // ── 2. Create master spreadsheet ──────────────────────────────────────────
    const masterId = await driveClient.createSpreadsheet(
      "master",
      storeFolderId,
      [...MASTER_TABS],
    );

    // ── 3. Register new store in main.Stores ──────────────────────────────────
    await makeRepo(mainSpreadsheetId, "Stores").batchAppend([
      {
        store_id: storeId,
        store_name: businessName,
        master_spreadsheet_id: masterId,
        drive_folder_id: storeFolderId ?? "",
        owner_email: ownerEmail,
        my_role: "owner",
        joined_at: nowUTC(),
      },
    ]);

    return { masterId, storeId, driveFolderId: storeFolderId ?? "" };
  } catch (err) {
    throw new SetupError(`createMasterSpreadsheet failed: ${String(err)}`, err);
  }
}

/**
 * Writes the column header row to every tab of the Master Spreadsheet.
 */
export async function initializeMasterSheets(
  spreadsheetId: string,
): Promise<void> {
  if (!spreadsheetId) {
    throw new SetupError("initializeMasterSheets: spreadsheetId is required");
  }
  await Promise.all(
    MASTER_TABS.map((tab) =>
      makeRepo(spreadsheetId, tab).writeHeaders(MASTER_TAB_HEADERS[tab] ?? []),
    ),
  );
}

// ─── Monthly Spreadsheet ──────────────────────────────────────────────────────

/**
 * Writes the column header row to every tab of a Monthly Spreadsheet.
 */
export async function initializeMonthlySheets(
  spreadsheetId: string,
): Promise<void> {
  if (!spreadsheetId) {
    throw new SetupError("initializeMonthlySheets: spreadsheetId is required");
  }
  await Promise.all(
    MONTHLY_TABS.map((tab) =>
      makeRepo(spreadsheetId, tab).writeHeaders(MONTHLY_TAB_HEADERS[tab] ?? []),
    ),
  );
}

// ─── Setup Orchestrators ──────────────────────────────────────────────────────

/**
 * Creates a new store (master + monthly spreadsheets) using the main spreadsheet
 * already present in localStorage. Called from SetupWizard for both first-time
 * setup and adding a new branch.
 *
 * Precondition: findOrCreateMain() must have been called before navigating to
 * /setup, so that mainSpreadsheetId is persisted in localStorage.
 *
 * Steps:
 *   1. createMasterSpreadsheet → store folder + master spreadsheet + main.Stores row
 *   2. initializeMasterSheets  → frozen header rows on all master tabs
 *   3. createMonthlySheet      → current month's transaction spreadsheet
 *   4. initializeMonthlySheets → frozen header rows on all monthly tabs
 *   5. Traverse folder         → build the sheet map
 *   6. Pre-create next month   → Option B
 */
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

  const {
    masterId,
    storeId: newStoreId,
    driveFolderId,
  } = await createMasterSpreadsheet(businessName, ownerEmail, mainId);
  await initializeMasterSheets(masterId);

  // Create current month's transaction spreadsheet
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const yearMonth = `${year}-${mm(month)}`;
  const name = `transaction_${yearMonth}`;

  const yearFolderId = await driveClient.ensureFolder([
    "apps",
    "pos_umkm",
    "stores",
    newStoreId,
    "transactions",
    String(year),
  ]);
  const monthlyId = await driveClient.createSpreadsheet(
    name,
    yearFolderId ?? undefined,
    [...MONTHLY_TABS],
  );
  await initializeMonthlySheets(monthlyId);

  // Register in Monthly_Sheets
  await makeRepo(masterId, "Monthly_Sheets").batchAppend([
    {
      id: generateId(),
      year_month: yearMonth,
      spreadsheetId: monthlyId,
      created_at: nowUTC(),
    },
  ]);

  // Initialize the store map and traverse to build the full map
  setActiveStoreMap(newStoreId);
  const initial = await storeFolderService.traverse(driveFolderId);
  getActiveStoreMap()
    .getState()
    .setStoreMap(driveFolderId, initial.sheets, initial.monthlySheets);

  // Option B: Pre-create next month's sheet
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  try {
    await createMonthlySheetForStore(
      newStoreId,
      driveFolderId,
      nextYear,
      nextMonth,
    );
    // Re-traverse to pick up the new sheet
    const updated = await storeFolderService.traverse(driveFolderId);
    getActiveStoreMap()
      .getState()
      .setStoreMap(driveFolderId, updated.sheets, updated.monthlySheets);
  } catch (err) {
    console.warn("[setup] Failed to pre-create next month's sheet:", err);
  }

  return { storeId: newStoreId, driveFolderId };
}

/**
 * Full first-time setup orchestrator.
 * Combines findOrCreateMain + runStoreSetup into one call.
 *
 * @param businessName  Display name of the store.
 * @param ownerEmail    Owner's Google account email.
 */
export async function runFirstTimeSetup(
  businessName: string,
  ownerEmail = "",
): Promise<{ storeId: string; driveFolderId: string }> {
  const { mainSpreadsheetId } = await findOrCreateMain(ownerEmail);
  saveMainSpreadsheetId(mainSpreadsheetId);
  return runStoreSetup(businessName, ownerEmail);
}

/**
 * Shares the given spreadsheet with all active members listed in the Members tab.
 * Active members are rows where deleted_at is falsy.
 * Called after creating a new monthly sheet so all members can access it.
 */
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
      driveClient.shareSpreadsheet(
        spreadsheetId,
        (u as Record<string, unknown>).email as string,
        "editor",
      ),
    ),
  );
}
