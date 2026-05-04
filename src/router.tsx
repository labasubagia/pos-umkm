import { createBrowserRouter, Navigate, redirect } from "react-router";
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
import { CustomersListPage } from "./modules/customers/CustomersListPage";
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
import LandingPage from "./pages/LandingPage";
import NotFoundPage from "./pages/NotFoundPage";
import OutboxPage from "./pages/OutboxPage";
import StoreManagementPage from "./pages/StoreManagementPage";

const catalogIndexLoader = () => redirect("products");
const inventoryIndexLoader = () => redirect("stock-opname");
const reportsIndexLoader = () => redirect("daily-summary");
const settingsIndexLoader = () => redirect("business-profile");

export const router = createBrowserRouter(
  [
    { path: "/", element: <LandingPage /> },
    { path: "/login", element: <LoginPage /> },
    { path: "/join", element: <JoinPage /> },
    {
      path: "/setup",
      element: (
        <ProtectedRoute>
          <SetupWizard />
        </ProtectedRoute>
      ),
    },
    {
      path: "/stores",
      element: (
        <ProtectedRoute>
          <StorePickerPage />
        </ProtectedRoute>
      ),
    },
    {
      path: "/:storeId",
      element: (
        <ProtectedRoute>
          <AppShell />
        </ProtectedRoute>
      ),
      children: [
        { index: true, element: <Navigate to="cashier" replace /> },
        { path: "cashier", element: <CashierPage /> },
        {
          element: <PageLayout />,
          children: [
            {
              path: "catalog",
              loader: catalogIndexLoader,
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
            {
              path: "inventory",
              loader: inventoryIndexLoader,
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
            {
              path: "customers",
              element: (
                <RoleRoute minRole="manager">
                  <CustomersListPage />
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
            {
              path: "reports",
              loader: reportsIndexLoader,
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
            {
              path: "settings",
              loader: settingsIndexLoader,
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
  {
    basename: "/pos-umkm",
  },
);
