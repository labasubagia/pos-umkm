/**
 * zod-schemas.ts — Zod schemas for parsing Google Sheets data into typed objects.
 *
 * Google Sheets returns all values as strings. These schemas use zod.coerce()
 * to automatically convert string values to their proper types (numbers,
 * booleans, dates) before storing in Dexie.
 *
 * Import these schemas in HydrationService to transform raw sheet data
 * before writing to IndexedDB.
 */

import { z } from "zod";
import { logger } from "@/utils";

const coerceString = z.coerce.string();
const coerceNumber = z.coerce.number();
const coerceBoolean = z
  .union([z.boolean(), z.string()])
  .transform((val) =>
    typeof val === "boolean" ? val : val.toLowerCase() === "true",
  );
const coerceDate = z.coerce.date().transform((d) => d.toISOString());

const optionalCoerceDate = coerceDate.optional();

export const StoreSchema = z.object({
  id: coerceString.optional(),
  store_id: coerceString,
  store_name: coerceString,
  drive_folder_id: coerceString.optional().nullable(),
  owner_email: coerceString.optional().nullable(),
  my_role: coerceString.optional().nullable(),
  joined_at: optionalCoerceDate.nullable(),
  deleted_at: optionalCoerceDate.nullable(),
});

export const SettingSchema = z.object({
  id: coerceString,
  key: coerceString,
  value: z.union([coerceString, coerceNumber]),
  updated_at: coerceDate,
});

export const MemberSchema = z.object({
  id: coerceString,
  google_user_id: coerceString,
  email: coerceString,
  name: coerceString,
  role: coerceString,
  invited_at: coerceDate,
  deleted_at: optionalCoerceDate.nullable(),
});

export const CategorySchema = z.object({
  id: coerceString,
  name: coerceString,
  created_at: coerceDate,
  deleted_at: optionalCoerceDate.nullable(),
});

export const ProductSchema = z.object({
  id: coerceString,
  category_id: coerceString,
  name: coerceString,
  sku: coerceString,
  price: coerceNumber,
  stock: coerceNumber,
  has_variants: coerceBoolean,
  created_at: coerceDate,
  deleted_at: optionalCoerceDate.nullable(),
});

export const VariantSchema = z.object({
  id: coerceString,
  product_id: coerceString,
  option_name: coerceString,
  option_value: coerceString,
  price: coerceNumber,
  stock: coerceNumber,
  created_at: coerceDate,
  deleted_at: optionalCoerceDate.nullable(),
});

export const CustomerSchema = z.object({
  id: coerceString,
  name: coerceString,
  phone: coerceString,
  email: coerceString.optional().nullable(),
  created_at: coerceDate,
  deleted_at: optionalCoerceDate.nullable(),
});

export const PurchaseOrderSchema = z.object({
  id: coerceString,
  supplier: coerceString,
  status: z.enum(["pending", "received"]),
  created_at: coerceDate,
  deleted_at: optionalCoerceDate.nullable(),
});

export const PurchaseOrderItemSchema = z.object({
  id: coerceString,
  order_id: coerceString,
  product_id: coerceString,
  product_name: coerceString,
  qty: coerceNumber,
  cost_price: coerceNumber,
  created_at: coerceDate,
});

export const StockLogSchema = z.object({
  id: coerceString,
  product_id: coerceString,
  reason: coerceString,
  qty_before: coerceNumber,
  qty_after: coerceNumber,
  created_at: coerceDate,
});

export const AuditLogSchema = z.object({
  id: coerceString,
  event: coerceString,
  data: coerceString,
  created_at: coerceDate,
});

export const TransactionSchema = z.object({
  id: coerceString,
  created_at: coerceDate,
  cashier_id: coerceString,
  customer_id: coerceString.optional().nullable(),
  subtotal: coerceNumber,
  discount_type: z
    .union([z.enum(["flat", "percent", "none"]), z.literal("")])
    .optional()
    .nullable(),
  discount_value: coerceNumber,
  discount_amount: coerceNumber,
  tax: coerceNumber,
  total: coerceNumber,
  payment_method: z.enum(["CASH", "QRIS", "SPLIT"]),
  cash_received: coerceNumber,
  change: coerceNumber,
  receipt_number: coerceString,
  notes: coerceString.optional().nullable(),
});

export const TransactionItemSchema = z.object({
  id: coerceString,
  transaction_id: coerceString,
  product_id: coerceString,
  variant_id: coerceString.optional().nullable(),
  name: coerceString,
  price: coerceNumber,
  quantity: coerceNumber,
  subtotal: coerceNumber,
});

export const RefundSchema = z.object({
  id: coerceString,
  transaction_id: coerceString,
  product_id: coerceString,
  product_name: coerceString,
  qty: coerceNumber,
  unit_price: coerceNumber,
  reason: coerceString,
  created_at: coerceDate,
});

export type Store = z.infer<typeof StoreSchema> & Record<string, unknown>;
export type Setting = z.infer<typeof SettingSchema> & Record<string, unknown>;
export type Member = z.infer<typeof MemberSchema> & Record<string, unknown>;
export type Category = z.infer<typeof CategorySchema> & Record<string, unknown>;
export type Product = z.infer<typeof ProductSchema> & Record<string, unknown>;
export type Variant = z.infer<typeof VariantSchema> & Record<string, unknown>;
export type Customer = z.infer<typeof CustomerSchema> & Record<string, unknown>;
export type PurchaseOrder = z.infer<typeof PurchaseOrderSchema> &
  Record<string, unknown>;
export type PurchaseOrderItem = z.infer<typeof PurchaseOrderItemSchema> &
  Record<string, unknown>;
export type StockLog = z.infer<typeof StockLogSchema> & Record<string, unknown>;
export type AuditLog = z.infer<typeof AuditLogSchema> & Record<string, unknown>;
export type Transaction = z.infer<typeof TransactionSchema> &
  Record<string, unknown>;
export type TransactionItem = z.infer<typeof TransactionItemSchema> &
  Record<string, unknown>;
export type Refund = z.infer<typeof RefundSchema> & Record<string, unknown>;

export const sheetSchemaMap: Record<
  string,
  z.ZodType<Record<string, unknown>>
> = {
  Stores: StoreSchema,
  Settings: SettingSchema,
  Members: MemberSchema,
  Categories: CategorySchema,
  Products: ProductSchema,
  Variants: VariantSchema,
  Customers: CustomerSchema,
  Purchase_Orders: PurchaseOrderSchema,
  Purchase_Order_Items: PurchaseOrderItemSchema,
  Stock_Log: StockLogSchema,
  Audit_Log: AuditLogSchema,
  Transactions: TransactionSchema,
  Transaction_Items: TransactionItemSchema,
  Refunds: RefundSchema,
};

export function parseSheetRows(
  sheetName: string,
  rows: Record<string, unknown>[],
): Record<string, unknown>[] {
  const schema = sheetSchemaMap[sheetName];
  if (!schema) {
    logger.warn(
      `[parseSheetRows] No schema found for sheet "${sheetName}", returning raw rows`,
    );
    return rows;
  }
  return rows.map((row) => schema.parse(row));
}

// ─── Config Types ────────────────────────────────────────────────────────────────

export {
  ALL_TAB_HEADERS,
  MAIN_PRESET,
  MAIN_TAB_HEADERS,
  MAIN_TABS,
} from "../../config/presets";
export type {
  MainConfigPayload,
  MigrationPayload,
  MonthlySheetConfig,
  SheetConfig,
  SpreadsheetConfig,
  TransformedConfig,
  TransformedSpreadsheet,
} from "../../config/types";
