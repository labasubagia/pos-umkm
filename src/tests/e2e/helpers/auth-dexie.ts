/**
 * auth-dexie.ts — E2E auth injection for the Dexie (Google) adapter.
 *
 * Injects auth state and store map into localStorage before the page loads so that:
 *   1. GoogleAuthAdapter.restoreSession() returns the fake user immediately
 *      (reads `gsi_*` keys — no OAuth popup needed).
 *   2. Zustand `persist` middleware rehydrates the auth store from the injected
 *      `pos-umkm-auth` key, so ProtectedRoute sees isAuthenticated=true on the
 *      first render.
 *   3. The store map (`pos_umkm_storemap_<storeId>`) is pre-populated with the
 *      fake spreadsheet IDs so AppShell doesn't need to traverse Drive.
 *
 * Usage:
 *   await injectAuthState(page, storeConfig)
 *   await page.goto(`${BASE}/${store.storeId}/cashier`)
 *   await page.waitForSelector('[data-testid="product-search-input"]')
 */
import type { Page } from "@playwright/test";
import { stubGoogleApis } from "./route-stubs";

export const BASE = "/pos-umkm";

export interface StoreConfig {
  storeId: string;
  masterSpreadsheetId: string;
  mainSpreadsheetId: string;
  monthlySpreadsheetId: string;
}

export const DEFAULT_STORE: StoreConfig = {
  storeId: "e2e-store-1",
  masterSpreadsheetId: "e2e-master-id",
  mainSpreadsheetId: "e2e-main-id",
  monthlySpreadsheetId: "e2e-monthly-id",
};

/**
 * Injects GoogleAuthAdapter session tokens + Zustand auth state + store map
 * into localStorage via page.addInitScript (runs before any page JavaScript).
 * Must be called before page.goto().
 */
export async function injectAuthState(
  page: Page,
  store: StoreConfig = DEFAULT_STORE,
): Promise<void> {
  await stubGoogleApis(page);

  await page.addInitScript(
    ({ store }) => {
      // GoogleAuthAdapter reads these to restore session without OAuth popup.
      localStorage.setItem("gsi_access_token", "fake-e2e-token");
      localStorage.setItem("gsi_token_expiry", String(Date.now() + 3_600_000));
      localStorage.setItem("gsi_user_id", "e2e-owner-1");
      localStorage.setItem("gsi_user_email", "owner@e2e.test");
      localStorage.setItem("gsi_user_name", "E2E Owner");

      // Zustand persist key — rehydrates isAuthenticated + sheet IDs on load.
      localStorage.setItem(
        "pos-umkm-auth",
        JSON.stringify({
          state: {
            user: {
              id: "e2e-owner-1",
              email: "owner@e2e.test",
              name: "E2E Owner",
              role: "owner",
            },
            role: "owner",
            isAuthenticated: true,
            mainSpreadsheetId: store.mainSpreadsheetId,
            activeStoreId: store.storeId,
          },
          version: 0,
        }),
      );

      // Legacy keys used by setup.service helpers.
      localStorage.setItem("mainSpreadsheetId", store.mainSpreadsheetId);
      localStorage.setItem("activeStoreId", store.storeId);
      localStorage.setItem("storeFolderId", "e2e-folder-id");

      // Store map — pre-populated so AppShell doesn't need to traverse Drive.
      const now = new Date();
      const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      localStorage.setItem(
        `pos_umkm_storemap_${store.storeId}`,
        JSON.stringify({
          state: {
            storeFolderId: "e2e-folder-id",
            sheets: {
              Stores: {
                spreadsheet_id: store.mainSpreadsheetId,
                spreadsheet_name: "main",
                folder_path: "",
                sheet_name: "Stores",
                sheet_id: 1,
                headers: [
                  "store_id",
                  "store_name",
                  "master_spreadsheet_id",
                  "drive_folder_id",
                  "owner_email",
                  "my_role",
                  "joined_at",
                ],
              },
              Settings: {
                spreadsheet_id: store.masterSpreadsheetId,
                spreadsheet_name: "master",
                folder_path: "",
                sheet_name: "Settings",
                sheet_id: 2,
                headers: ["id", "key", "value", "updated_at"],
              },
              Members: {
                spreadsheet_id: store.masterSpreadsheetId,
                spreadsheet_name: "master",
                folder_path: "",
                sheet_name: "Members",
                sheet_id: 3,
                headers: [
                  "id",
                  "google_user_id",
                  "email",
                  "name",
                  "role",
                  "invited_at",
                  "deleted_at",
                ],
              },
              Categories: {
                spreadsheet_id: store.masterSpreadsheetId,
                spreadsheet_name: "master",
                folder_path: "",
                sheet_name: "Categories",
                sheet_id: 4,
                headers: ["id", "name", "created_at", "deleted_at"],
              },
              Products: {
                spreadsheet_id: store.masterSpreadsheetId,
                spreadsheet_name: "master",
                folder_path: "",
                sheet_name: "Products",
                sheet_id: 5,
                headers: [
                  "id",
                  "category_id",
                  "name",
                  "sku",
                  "price",
                  "stock",
                  "has_variants",
                  "created_at",
                  "deleted_at",
                ],
              },
              Variants: {
                spreadsheet_id: store.masterSpreadsheetId,
                spreadsheet_name: "master",
                folder_path: "",
                sheet_name: "Variants",
                sheet_id: 6,
                headers: [
                  "id",
                  "product_id",
                  "option_name",
                  "option_value",
                  "price",
                  "stock",
                  "created_at",
                  "deleted_at",
                ],
              },
              Customers: {
                spreadsheet_id: store.masterSpreadsheetId,
                spreadsheet_name: "master",
                folder_path: "",
                sheet_name: "Customers",
                sheet_id: 7,
                headers: [
                  "id",
                  "name",
                  "phone",
                  "email",
                  "created_at",
                  "deleted_at",
                ],
              },
              Purchase_Orders: {
                spreadsheet_id: store.masterSpreadsheetId,
                spreadsheet_name: "master",
                folder_path: "",
                sheet_name: "Purchase_Orders",
                sheet_id: 8,
                headers: [
                  "id",
                  "supplier",
                  "status",
                  "created_at",
                  "deleted_at",
                ],
              },
              Purchase_Order_Items: {
                spreadsheet_id: store.masterSpreadsheetId,
                spreadsheet_name: "master",
                folder_path: "",
                sheet_name: "Purchase_Order_Items",
                sheet_id: 9,
                headers: [
                  "id",
                  "order_id",
                  "product_id",
                  "product_name",
                  "qty",
                  "cost_price",
                  "created_at",
                ],
              },
              Stock_Log: {
                spreadsheet_id: store.masterSpreadsheetId,
                spreadsheet_name: "master",
                folder_path: "",
                sheet_name: "Stock_Log",
                sheet_id: 10,
                headers: [
                  "id",
                  "product_id",
                  "reason",
                  "qty_before",
                  "qty_after",
                  "created_at",
                ],
              },
              Audit_Log: {
                spreadsheet_id: store.masterSpreadsheetId,
                spreadsheet_name: "master",
                folder_path: "",
                sheet_name: "Audit_Log",
                sheet_id: 11,
                headers: ["id", "event", "data", "created_at"],
              },
              Monthly_Sheets: {
                spreadsheet_id: store.masterSpreadsheetId,
                spreadsheet_name: "master",
                folder_path: "",
                sheet_name: "Monthly_Sheets",
                sheet_id: 12,
                headers: ["id", "year_month", "spreadsheetId", "created_at"],
              },
            },
            monthlySheets: [
              {
                yearMonth,
                sheets: {
                  Transactions: {
                    spreadsheet_id: store.monthlySpreadsheetId,
                    spreadsheet_name: `transaction_${yearMonth}`,
                    folder_path: `transactions/${now.getFullYear()}`,
                    sheet_name: "Transactions",
                    sheet_id: 20,
                    headers: [
                      "id",
                      "created_at",
                      "cashier_id",
                      "customer_id",
                      "subtotal",
                      "discount_type",
                      "discount_value",
                      "discount_amount",
                      "tax",
                      "total",
                      "payment_method",
                      "cash_received",
                      "change",
                      "receipt_number",
                      "notes",
                    ],
                  },
                  Transaction_Items: {
                    spreadsheet_id: store.monthlySpreadsheetId,
                    spreadsheet_name: `transaction_${yearMonth}`,
                    folder_path: `transactions/${now.getFullYear()}`,
                    sheet_name: "Transaction_Items",
                    sheet_id: 21,
                    headers: [
                      "id",
                      "transaction_id",
                      "product_id",
                      "variant_id",
                      "name",
                      "price",
                      "quantity",
                      "subtotal",
                    ],
                  },
                  Refunds: {
                    spreadsheet_id: store.monthlySpreadsheetId,
                    spreadsheet_name: `transaction_${yearMonth}`,
                    folder_path: `transactions/${now.getFullYear()}`,
                    sheet_name: "Refunds",
                    sheet_id: 22,
                    headers: [
                      "id",
                      "transaction_id",
                      "product_id",
                      "product_name",
                      "qty",
                      "unit_price",
                      "reason",
                      "created_at",
                    ],
                  },
                },
              },
            ],
            lastTraversedAt: Date.now(),
          },
          version: 0,
        }),
      );
    },
    { store },
  );
}

/**
 * Full sign-in helper: injects auth, navigates to /cashier, waits for the
 * product-search-input to confirm the page is ready.
 */
export async function signInAsDexie(
  page: Page,
  store: StoreConfig = DEFAULT_STORE,
): Promise<void> {
  await injectAuthState(page, store);
  await page.goto(`${BASE}/${store.storeId}/cashier`);
  await page.getByTestId("product-search-input").waitFor();
}
