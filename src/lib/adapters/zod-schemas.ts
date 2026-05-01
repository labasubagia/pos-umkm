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

const coerceString = z.coerce.string();
const coerceNumber = z.coerce.number();
const coerceBoolean = z
  .union([z.boolean(), z.string()])
  .transform((val) =>
    typeof val === "boolean" ? val : val.toLowerCase() === "true",
  );
const coerceDate = z.coerce.date().transform((d) => d.toISOString());

const optionalCoerceDate = coerceDate.optional();

export const StoreRowSchema = z.object({
  id: coerceString.optional(),
  store_id: coerceString,
  store_name: coerceString,
  master_spreadsheet_id: coerceString.optional().nullable(),
  drive_folder_id: coerceString.optional().nullable(),
  owner_email: coerceString.optional().nullable(),
  my_role: coerceString.optional().nullable(),
  joined_at: optionalCoerceDate.nullable(),
  deleted_at: optionalCoerceDate.nullable(),
});

export const SettingRowSchema = z.object({
  id: coerceString,
  key: coerceString,
  value: z.union([coerceString, coerceNumber]),
  updated_at: coerceDate,
});

export const MemberRowSchema = z.object({
  id: coerceString,
  google_user_id: coerceString,
  email: coerceString,
  name: coerceString,
  role: coerceString,
  invited_at: coerceDate,
  deleted_at: optionalCoerceDate.nullable(),
});

export const CategoryRowSchema = z.object({
  id: coerceString,
  name: coerceString,
  created_at: coerceDate,
  deleted_at: optionalCoerceDate.nullable(),
});

export const ProductRowSchema = z.object({
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

export const VariantRowSchema = z.object({
  id: coerceString,
  product_id: coerceString,
  option_name: coerceString,
  option_value: coerceString,
  price: coerceNumber,
  stock: coerceNumber,
  created_at: coerceDate,
  deleted_at: optionalCoerceDate.nullable(),
});

export const CustomerRowSchema = z.object({
  id: coerceString,
  name: coerceString,
  phone: coerceString,
  email: coerceString.optional().nullable(),
  created_at: coerceDate,
  deleted_at: optionalCoerceDate.nullable(),
});

export const PurchaseOrderRowSchema = z.object({
  id: coerceString,
  supplier: coerceString,
  status: z.enum(["pending", "received"]),
  created_at: coerceDate,
  deleted_at: optionalCoerceDate.nullable(),
});

export const PurchaseOrderItemRowSchema = z.object({
  id: coerceString,
  order_id: coerceString,
  product_id: coerceString,
  product_name: coerceString,
  qty: coerceNumber,
  cost_price: coerceNumber,
  created_at: coerceDate,
});

export const StockLogRowSchema = z.object({
  id: coerceString,
  product_id: coerceString,
  reason: coerceString,
  qty_before: coerceNumber,
  qty_after: coerceNumber,
  created_at: coerceDate,
});

export const AuditLogRowSchema = z.object({
  id: coerceString,
  event: coerceString,
  data: coerceString,
  created_at: coerceDate,
});

export const MonthlySheetRowSchema = z.object({
  id: coerceString,
  year_month: coerceString,
  spreadsheetId: coerceString,
  created_at: coerceDate,
});

export const TransactionRowSchema = z.object({
  id: coerceString,
  created_at: coerceDate,
  cashier_id: coerceString,
  customer_id: coerceString.optional().nullable(),
  subtotal: coerceNumber,
  discount_type: z.enum(["flat", "percent", "none"]).optional().nullable(),
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

export const TransactionItemRowSchema = z.object({
  id: coerceString,
  transaction_id: coerceString,
  product_id: coerceString,
  variant_id: coerceString.optional().nullable(),
  name: coerceString,
  price: coerceNumber,
  quantity: coerceNumber,
  subtotal: coerceNumber,
});

export const RefundRowSchema = z.object({
  id: coerceString,
  transaction_id: coerceString,
  product_id: coerceString,
  product_name: coerceString,
  qty: coerceNumber,
  unit_price: coerceNumber,
  reason: coerceString,
  created_at: coerceDate,
});

export type StoreRowZod = z.infer<typeof StoreRowSchema>;
export type SettingRowZod = z.infer<typeof SettingRowSchema>;
export type MemberRowZod = z.infer<typeof MemberRowSchema>;
export type CategoryRowZod = z.infer<typeof CategoryRowSchema>;
export type ProductRowZod = z.infer<typeof ProductRowSchema>;
export type VariantRowZod = z.infer<typeof VariantRowSchema>;
export type CustomerRowZod = z.infer<typeof CustomerRowSchema>;
export type PurchaseOrderRowZod = z.infer<typeof PurchaseOrderRowSchema>;
export type PurchaseOrderItemRowZod = z.infer<
  typeof PurchaseOrderItemRowSchema
>;
export type StockLogRowZod = z.infer<typeof StockLogRowSchema>;
export type AuditLogRowZod = z.infer<typeof AuditLogRowSchema>;
export type MonthlySheetRowZod = z.infer<typeof MonthlySheetRowSchema>;
export type TransactionRowZod = z.infer<typeof TransactionRowSchema>;
export type TransactionItemRowZod = z.infer<typeof TransactionItemRowSchema>;
export type RefundRowZod = z.infer<typeof RefundRowSchema>;

export const sheetSchemaMap: Record<
  string,
  z.ZodType<Record<string, unknown>>
> = {
  Stores: StoreRowSchema,
  Settings: SettingRowSchema,
  Members: MemberRowSchema,
  Categories: CategoryRowSchema,
  Products: ProductRowSchema,
  Variants: VariantRowSchema,
  Customers: CustomerRowSchema,
  Purchase_Orders: PurchaseOrderRowSchema,
  Purchase_Order_Items: PurchaseOrderItemRowSchema,
  Stock_Log: StockLogRowSchema,
  Audit_Log: AuditLogRowSchema,
  Monthly_Sheets: MonthlySheetRowSchema,
  Transactions: TransactionRowSchema,
  Transaction_Items: TransactionItemRowSchema,
  Refunds: RefundRowSchema,
};

export function parseSheetRows(
  sheetName: string,
  rows: Record<string, unknown>[],
): Record<string, unknown>[] {
  const schema = sheetSchemaMap[sheetName];
  if (!schema) {
    console.warn(
      `[parseSheetRows] No schema found for sheet "${sheetName}", returning raw rows`,
    );
    return rows;
  }
  return rows.map((row) => schema.parse(row));
}
