import { createBrowserRouter } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import CashierPage from './pages/CashierPage'
import CatalogPage from './pages/CatalogPage'
import CustomersPage from './pages/CustomersPage'
import InventoryPage from './pages/InventoryPage'
import ReportsPage from './pages/ReportsPage'
import SettingsPage from './pages/SettingsPage'
import StoreManagementPage from './pages/StoreManagementPage'
import NotFoundPage from './pages/NotFoundPage'
import LoginPage from './modules/auth/LoginPage'
import SetupWizard from './modules/auth/SetupWizard'
import StorePickerPage from './modules/auth/StorePickerPage'
import JoinPage from './modules/auth/JoinPage'
import { ProtectedRoute } from './modules/auth/ProtectedRoute'
import { RoleRoute } from './modules/auth/RoleRoute'
import { AppShell } from './components/AppShell'
import { PageLayout } from './components/PageLayout'

export const router = createBrowserRouter(
  [
    // Public routes (no nav bar)
    { path: '/', element: <LandingPage /> },
    { path: '/login', element: <LoginPage /> },
    { path: '/join', element: <JoinPage /> },

    // Setup wizard — authenticated but no persistent nav (onboarding flow)
    {
      path: '/setup',
      element: (
        <ProtectedRoute>
          <SetupWizard />
        </ProtectedRoute>
      ),
    },

    // Store picker — authenticated, resolves the active store after every login
    {
      path: '/stores',
      element: (
        <ProtectedRoute>
          <StorePickerPage />
        </ProtectedRoute>
      ),
    },

    // Protected routes — rendered inside AppShell (shows NavBar)
    {
      element: (
        <ProtectedRoute>
          <AppShell />
        </ProtectedRoute>
      ),
      children: [
        // All authenticated roles
        { path: '/cashier', element: <CashierPage /> },

        // Manager+ and owner — wrapped in PageLayout for consistent padding/max-width
        {
          element: <PageLayout />,
          children: [
            {
              path: '/catalog',
              element: (
                <RoleRoute minRole="manager">
                  <CatalogPage />
                </RoleRoute>
              ),
            },
            {
              path: '/customers',
              element: (
                <RoleRoute minRole="manager">
                  <CustomersPage />
                </RoleRoute>
              ),
            },
            {
              path: '/inventory',
              element: (
                <RoleRoute minRole="manager">
                  <InventoryPage />
                </RoleRoute>
              ),
            },
            {
              path: '/reports',
              element: (
                <RoleRoute minRole="manager">
                  <ReportsPage />
                </RoleRoute>
              ),
            },
            {
              path: '/settings',
              element: (
                <RoleRoute minRole="owner">
                  <SettingsPage />
                </RoleRoute>
              ),
            },
            {
              path: '/settings/stores',
              element: (
                <RoleRoute minRole="owner">
                  <StoreManagementPage />
                </RoleRoute>
              ),
            },
          ],
        },
      ],
    },

    { path: '*', element: <NotFoundPage /> },
  ],
  { basename: '/pos-umkm' },
)

