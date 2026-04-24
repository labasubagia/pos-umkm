import {
  Archive,
  BarChart2,
  type LucideIcon,
  Package,
  Settings,
  ShoppingCart,
  Users,
} from "lucide-react";
import type { Role } from "../lib/adapters/types";

export interface SubNavItem {
  /** Relative path from /:storeId, e.g. "catalog/products" */
  to: string;
  label: string;
  minRole: Role;
  testId: string;
}

export interface NavItem {
  /** Relative path from /:storeId, e.g. "catalog" */
  to: string;
  label: string;
  icon: LucideIcon;
  minRole: Role;
  /** Sub-nav items shown in a secondary bar when this section is active */
  children?: SubNavItem[];
}

export const NAV_ITEMS: NavItem[] = [
  {
    to: "cashier",
    label: "Kasir",
    icon: ShoppingCart,
    minRole: "cashier" as Role,
  },
  {
    to: "catalog",
    label: "Katalog",
    icon: Package,
    minRole: "manager" as Role,
    children: [
      {
        to: "catalog/products",
        label: "Produk",
        minRole: "manager" as Role,
        testId: "subnav-catalog-products",
      },
      {
        to: "catalog/categories",
        label: "Kategori",
        minRole: "manager" as Role,
        testId: "subnav-catalog-categories",
      },
      {
        to: "catalog/import-csv",
        label: "Import CSV",
        minRole: "manager" as Role,
        testId: "subnav-catalog-import-csv",
      },
    ],
  },
  {
    to: "inventory",
    label: "Inventori",
    icon: Archive,
    minRole: "manager" as Role,
    children: [
      {
        to: "inventory/stock-opname",
        label: "Stok Opname",
        minRole: "manager" as Role,
        testId: "subnav-inventory-stock-opname",
      },
      {
        to: "inventory/purchase-order",
        label: "Purchase Order",
        minRole: "manager" as Role,
        testId: "subnav-inventory-purchase-order",
      },
    ],
  },
  {
    to: "customers",
    label: "Pelanggan",
    icon: Users,
    minRole: "manager" as Role,
    children: [
      {
        to: "customers",
        label: "Pelanggan",
        minRole: "manager" as Role,
        testId: "subnav-customers",
      },
      {
        to: "customers/refund",
        label: "Refund / Retur",
        minRole: "manager" as Role,
        testId: "subnav-customers-refund",
      },
    ],
  },
  {
    to: "reports",
    label: "Laporan",
    icon: BarChart2,
    minRole: "manager" as Role,
    children: [
      {
        to: "reports/daily-summary",
        label: "Harian",
        minRole: "manager" as Role,
        testId: "subnav-reports-daily-summary",
      },
      {
        to: "reports/sales",
        label: "Penjualan",
        minRole: "manager" as Role,
        testId: "subnav-reports-sales",
      },
      {
        to: "reports/gross-profit",
        label: "Laba Kotor",
        minRole: "manager" as Role,
        testId: "subnav-reports-gross-profit",
      },
      {
        to: "reports/cash-reconciliation",
        label: "Rekonsiliasi",
        minRole: "manager" as Role,
        testId: "subnav-reports-cash-reconciliation",
      },
    ],
  },
  {
    to: "settings",
    label: "Pengaturan",
    icon: Settings,
    minRole: "owner" as Role,
    children: [
      {
        to: "settings/business-profile",
        label: "Profil Bisnis",
        minRole: "owner" as Role,
        testId: "subnav-settings-business-profile",
      },
      {
        to: "settings/member-management",
        label: "Tim",
        minRole: "owner" as Role,
        testId: "subnav-settings-member-management",
      },
      {
        to: "settings/store-management",
        label: "Toko",
        minRole: "owner" as Role,
        testId: "subnav-settings-store-management",
      },
      {
        to: "settings/qris-config",
        label: "QRIS",
        minRole: "owner" as Role,
        testId: "subnav-settings-qris-config",
      },
      {
        to: "settings/outbox",
        label: "Outbox",
        minRole: "owner" as Role,
        testId: "subnav-settings-outbox",
      },
    ],
  },
];
