/**
 * entity-types.ts — Typed row shapes for every Dexie table.
 *
 * Each interface extends Record<string, unknown> to satisfy the
 * ILocalRepository<T extends Record<string, unknown>> constraint.
 *
 * These are the canonical "row" types used by the DB layer (db.ts, repos.ts)
 * and consumed by service files so they no longer need to cast through
 * `Record<string, unknown>` on every field access.
 *
 * Source of truth for column shapes: src/lib/schema.ts.
 */

import type { Role } from "./types";

// ─── Main spreadsheet ─────────────────────────────────────────────────────────

export interface StoreRow extends Record<string, unknown> {
  /** Primary key in Dexie — equals store_id. Set by HydrationService. */
  id: string;
  store_id: string;
  store_name: string;
  master_spreadsheet_id: string;
  drive_folder_id: string;
  owner_email: string;
  my_role: string;
  joined_at: string;
  deleted_at: string | null;
}

// ─── Master spreadsheet ───────────────────────────────────────────────────────

/** Key-value settings row. Aggregated into BusinessSettings by getSettings(). */
export interface SettingRow extends Record<string, unknown> {
  id: string;
  key: string;
  value: string | number;
  updated_at: string;
}

export interface MemberRow extends Record<string, unknown> {
  id: string;
  google_user_id: string;
  email: string;
  name: string;
  role: Role;
  invited_at: string;
  deleted_at: string | null;
}

export interface CategoryRow extends Record<string, unknown> {
  id: string;
  name: string;
  created_at: string;
  deleted_at: string | null;
}

export interface ProductRow extends Record<string, unknown> {
  id: string;
  category_id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  /**
   * Always boolean after the db.ts reading hook normalises "TRUE"/"FALSE"
   * strings that Google Sheets returns during hydration.
   */
  has_variants: boolean;
  created_at: string;
  deleted_at: string | null;
}

export interface VariantRow extends Record<string, unknown> {
  id: string;
  product_id: string;
  option_name: string;
  option_value: string;
  price: number;
  stock: number;
  created_at: string;
  deleted_at: string | null;
}

export interface CustomerRow extends Record<string, unknown> {
  id: string;
  name: string;
  phone: string;
  email: string;
  created_at: string;
  deleted_at: string | null;
}

export interface PurchaseOrderRow extends Record<string, unknown> {
  id: string;
  supplier: string;
  status: "pending" | "received";
  created_at: string;
  deleted_at: string | null;
}

export interface PurchaseOrderItemRow extends Record<string, unknown> {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  qty: number;
  cost_price: number;
  created_at: string;
}

export interface StockLogRow extends Record<string, unknown> {
  id: string;
  product_id: string;
  reason: string;
  qty_before: number;
  qty_after: number;
  created_at: string;
}

export interface AuditLogRow extends Record<string, unknown> {
  id: string;
  event: string;
  data: string;
  created_at: string;
}

export interface MonthlySheetRow extends Record<string, unknown> {
  id: string;
  year_month: string;
  spreadsheetId: string;
  created_at: string;
}

// ─── Monthly spreadsheet ──────────────────────────────────────────────────────

export interface TransactionRow extends Record<string, unknown> {
  id: string;
  created_at: string;
  cashier_id: string;
  customer_id: string | null;
  subtotal: number;
  discount_type: "flat" | "percent" | null;
  discount_value: number;
  discount_amount: number;
  tax: number;
  total: number;
  payment_method: "CASH" | "QRIS" | "SPLIT";
  cash_received: number;
  change: number;
  receipt_number: string;
  notes: string | null;
}

export interface TransactionItemRow extends Record<string, unknown> {
  id: string;
  transaction_id: string;
  product_id: string;
  variant_id: string | null;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
}

export interface RefundRow extends Record<string, unknown> {
  id: string;
  transaction_id: string;
  product_id: string;
  product_name: string;
  qty: number;
  unit_price: number;
  reason: string;
  created_at: string;
}
