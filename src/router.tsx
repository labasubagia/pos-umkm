import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { PageLayout } from "./components/PageLayout";
import JoinPage from "./modules/auth/JoinPage";
import LoginPage from "./modules/auth/LoginPage";
import { ProtectedRoute } from "./modules/auth/ProtectedRoute";
import { RoleRoute } from "./modules/auth/RoleRoute";
import SetupWizard from "./modules/auth/SetupWizard";
import StorePickerPage from "./modules/auth/StorePickerPage";
import { CategoryList } from "./modules/catalog/CategoryList";
import { CSVImport } from "./modules/catalog/CSVImport";
import { ProductList } from "./modules/catalog/ProductList";
import { RefundFlow } from "./modules/customers/RefundFlow";
import { PurchaseOrders } from "./modules/inventory/PurchaseOrders";
import { StockOpname } from "./modules/inventory/StockOpname";
import { CashReconciliation } from "./modules/reports/CashReconciliation";
import { DailySummary } from "./modules/reports/DailySummary";
import { GrossProfitReport } from "./modules/reports/GrossProfitReport";
import { SalesReport } from "./modules/reports/SalesReport";
import { BusinessProfile } from "./modules/settings/BusinessProfile";
import { MemberManagement } from "./modules/settings/MemberManagement";
import { QRISConfig } from "./modules/settings/QRISConfig";
import CashierPage from "./pages/CashierPage";
import CustomersPage from "./pages/CustomersPage";
import LandingPage from "./pages/LandingPage";
import NotFoundPage from "./pages/NotFoundPage";
import OutboxPage from "./pages/OutboxPage";
import StoreManagementPage from "./pages/StoreManagementPage";

export const router = createBrowserRouter(
  [
    // Public routes (no nav bar)
    { path: "/", element: <LandingPage /> },
    { path: "/login", element: <LoginPage /> },
    { path: "/join", element: <JoinPage /> },

    // Setup wizard — authenticated but no persistent nav (onboarding flow)
    {
      path: "/setup",
      element: (
        <ProtectedRoute>
          <SetupWizard />
        </ProtectedRoute>
      ),
    },

    // Store picker — authenticated, resolves the active store after every login
    {
      path: "/stores",
      element: (
        <ProtectedRoute>
          <StorePickerPage />
        </ProtectedRoute>
      ),
    },

    // Protected routes — scoped to a specific store via /:storeId in the URL.
    {
      path: "/:storeId",
      element: (
        <ProtectedRoute>
          <AppShell />
        </ProtectedRoute>
      ),
      children: [
        // Index — redirect bare /:storeId to the cashier screen
        { index: true, element: <Navigate to="cashier" replace /> },

        // Cashier — all authenticated roles, no PageLayout (full-bleed)
        { path: "cashier", element: <CashierPage /> },

        // All remaining pages use PageLayout for consistent padding/max-width
        {
          element: <PageLayout />,
          children: [
            // ── Catalog ──────────────────────────────────────────────────────
            {
              path: "catalog",
              element: (
                <RoleRoute minRole="manager">
                  <Navigate to="products" replace />
                </RoleRoute>
              ),
            },
            {
              path: "catalog/products",
              element: (
                <RoleRoute minRole="manager">
                  <ProductList />
                </RoleRoute>
              ),
            },
            {
              path: "catalog/categories",
              element: (
                <RoleRoute minRole="manager">
                  <CategoryList />
                </RoleRoute>
              ),
            },
            {
              path: "catalog/import-csv",
              element: (
                <RoleRoute minRole="manager">
                  <CSVImport />
                </RoleRoute>
              ),
            },

            // ── Inventory ────────────────────────────────────────────────────
            {
              path: "inventory",
              element: (
                <RoleRoute minRole="manager">
                  <Navigate to="stock-opname" replace />
                </RoleRoute>
              ),
            },
            {
              path: "inventory/stock-opname",
              element: (
                <RoleRoute minRole="manager">
                  <StockOpname />
                </RoleRoute>
              ),
            },
            {
              path: "inventory/purchase-order",
              element: (
                <RoleRoute minRole="manager">
                  <PurchaseOrders />
                </RoleRoute>
              ),
            },

            // ── Customers ────────────────────────────────────────────────────
            {
              path: "customers",
              element: (
                <RoleRoute minRole="manager">
                  <CustomersPage />
                </RoleRoute>
              ),
            },
            {
              path: "customers/refund",
              element: (
                <RoleRoute minRole="manager">
                  <RefundFlow />
                </RoleRoute>
              ),
            },

            // ── Reports ──────────────────────────────────────────────────────
            {
              path: "reports",
              element: (
                <RoleRoute minRole="manager">
                  <Navigate to="daily-summary" replace />
                </RoleRoute>
              ),
            },
            {
              path: "reports/daily-summary",
              element: (
                <RoleRoute minRole="manager">
                  <DailySummary />
                </RoleRoute>
              ),
            },
            {
              path: "reports/sales",
              element: (
                <RoleRoute minRole="manager">
                  <SalesReport />
                </RoleRoute>
              ),
            },
            {
              path: "reports/gross-profit",
              element: (
                <RoleRoute minRole="manager">
                  <GrossProfitReport />
                </RoleRoute>
              ),
            },
            {
              path: "reports/cash-reconciliation",
              element: (
                <RoleRoute minRole="manager">
                  <CashReconciliation />
                </RoleRoute>
              ),
            },

            // ── Settings ─────────────────────────────────────────────────────
            {
              path: "settings",
              element: (
                <RoleRoute minRole="owner">
                  <Navigate to="business-profile" replace />
                </RoleRoute>
              ),
            },
            {
              path: "settings/business-profile",
              element: (
                <RoleRoute minRole="owner">
                  <BusinessProfile />
                </RoleRoute>
              ),
            },
            {
              path: "settings/member-management",
              element: (
                <RoleRoute minRole="owner">
                  <MemberManagement />
                </RoleRoute>
              ),
            },
            {
              path: "settings/store-management",
              element: (
                <RoleRoute minRole="owner">
                  <StoreManagementPage />
                </RoleRoute>
              ),
            },
            {
              path: "settings/qris-config",
              element: (
                <RoleRoute minRole="owner">
                  <QRISConfig />
                </RoleRoute>
              ),
            },
            {
              path: "settings/outbox",
              element: (
                <RoleRoute minRole="owner">
                  <OutboxPage />
                </RoleRoute>
              ),
            },
          ],
        },
      ],
    },

    { path: "*", element: <NotFoundPage /> },
  ],
  { basename: "/pos-umkm" },
);
