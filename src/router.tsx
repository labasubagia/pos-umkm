import { createBrowserRouter } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import CashierPage from './pages/CashierPage'
import CatalogPage from './pages/CatalogPage'
import ReportsPage from './pages/ReportsPage'
import SettingsPage from './pages/SettingsPage'
import NotFoundPage from './pages/NotFoundPage'
import LoginPage from './modules/auth/LoginPage'
import SetupWizard from './modules/auth/SetupWizard'
import JoinPage from './modules/auth/JoinPage'
import { ProtectedRoute } from './modules/auth/ProtectedRoute'
import { RoleRoute } from './modules/auth/RoleRoute'

export const router = createBrowserRouter(
  [
    // Public routes
    { path: '/', element: <LandingPage /> },
    { path: '/login', element: <LoginPage /> },
    { path: '/join', element: <JoinPage /> },

    // Protected: all authenticated users
    {
      path: '/setup',
      element: (
        <ProtectedRoute>
          <SetupWizard />
        </ProtectedRoute>
      ),
    },
    {
      path: '/cashier',
      element: (
        <ProtectedRoute>
          <CashierPage />
        </ProtectedRoute>
      ),
    },

    // Protected: manager+ only
    {
      path: '/catalog',
      element: (
        <ProtectedRoute>
          <RoleRoute minRole="manager">
            <CatalogPage />
          </RoleRoute>
        </ProtectedRoute>
      ),
    },
    {
      path: '/reports',
      element: (
        <ProtectedRoute>
          <RoleRoute minRole="manager">
            <ReportsPage />
          </RoleRoute>
        </ProtectedRoute>
      ),
    },

    // Protected: owner only
    {
      path: '/settings',
      element: (
        <ProtectedRoute>
          <RoleRoute minRole="owner">
            <SettingsPage />
          </RoleRoute>
        </ProtectedRoute>
      ),
    },

    { path: '*', element: <NotFoundPage /> },
  ],
  { basename: '/pos-umkm' },
)

