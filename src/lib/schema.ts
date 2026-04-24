/**
 * schema.ts — Single source of truth for all Google Sheets tab names and column headers.
 *
 * Imported by:
 *   - setup.service.ts  — to write header rows during spreadsheet initialisation
 *   - repos.ts          — to pass known headers to SheetRepository so append/batchAppend
 *                         can skip the redundant header-fetch GET request
 *
 * Keep this file free of business logic. Only tab names and column orders live here.
 */

/** Tab names in the Main Spreadsheet (owner's personal store registry). */
export const MAIN_TABS = ["Stores"] as const;

/** Tab names in the Master Spreadsheet. */
export const MASTER_TABS = [
  "Settings",
  "Members",
  "Categories",
  "Products",
  "Variants",
  "Customers",
  "Purchase_Orders",
  "Purchase_Order_Items",
  "Stock_Log",
  "Audit_Log",
  "Monthly_Sheets",
] as const;

/** Tab names in each Monthly Spreadsheet. */
export const MONTHLY_TABS = [
  "Transactions",
  "Transaction_Items",
  "Refunds",
] as const;

/**
 * Column headers for the Main Spreadsheet tabs.
 * TRD §4.2: private to the owner's Google account; never shared with members.
 */
export const MAIN_TAB_HEADERS: Record<string, string[]> = {
  Stores: [
    "store_id",
    "store_name",
    "master_spreadsheet_id",
    "drive_folder_id",
    "owner_email",
    "my_role",
    "joined_at",
    "deleted_at",
  ],
};

/** Column headers for each Master Sheet tab. */
export const MASTER_TAB_HEADERS: Record<string, string[]> = {
  Settings: ["id", "key", "value", "updated_at"],
  Members: [
    "id",
    "google_user_id",
    "email",
    "name",
    "role",
    "invited_at",
    "deleted_at",
  ],
  Categories: ["id", "name", "created_at", "deleted_at"],
  Products: [
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
  Variants: [
    "id",
    "product_id",
    "option_name",
    "option_value",
    "price",
    "stock",
    "created_at",
    "deleted_at",
  ],
  Customers: ["id", "name", "phone", "email", "created_at", "deleted_at"],
  Purchase_Orders: ["id", "supplier", "status", "created_at", "deleted_at"],
  Purchase_Order_Items: [
    "id",
    "order_id",
    "product_id",
    "product_name",
    "qty",
    "cost_price",
    "created_at",
  ],
  Stock_Log: [
    "id",
    "product_id",
    "reason",
    "qty_before",
    "qty_after",
    "created_at",
  ],
  Audit_Log: ["id", "event", "data", "created_at"],
  Monthly_Sheets: ["id", "year_month", "spreadsheetId", "created_at"],
};

/** Column headers for each Monthly Sheet tab. */
export const MONTHLY_TAB_HEADERS: Record<string, string[]> = {
  Transactions: [
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
  Transaction_Items: [
    "id",
    "transaction_id",
    "product_id",
    "variant_id",
    "name",
    "price",
    "quantity",
    "subtotal",
  ],
  Refunds: [
    "id",
    "transaction_id",
    "product_id",
    "product_name",
    "qty",
    "unit_price",
    "reason",
    "created_at",
  ],
};

/** Combined lookup of all known sheet tab headers across all spreadsheet types. */
export const ALL_TAB_HEADERS: Record<string, string[]> = {
  ...MAIN_TAB_HEADERS,
  ...MASTER_TAB_HEADERS,
  ...MONTHLY_TAB_HEADERS,
};
