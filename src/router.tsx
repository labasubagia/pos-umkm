import { createBrowserRouter } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import SetupPage from './pages/SetupPage'
import CashierPage from './pages/CashierPage'
import CatalogPage from './pages/CatalogPage'
import ReportsPage from './pages/ReportsPage'
import SettingsPage from './pages/SettingsPage'
import NotFoundPage from './pages/NotFoundPage'

export const router = createBrowserRouter(
  [
    { path: '/', element: <LandingPage /> },
    { path: '/setup', element: <SetupPage /> },
    { path: '/cashier', element: <CashierPage /> },
    { path: '/catalog', element: <CatalogPage /> },
    { path: '/reports', element: <ReportsPage /> },
    { path: '/settings', element: <SettingsPage /> },
    { path: '*', element: <NotFoundPage /> },
  ],
  { basename: '/pos-umkm' },
)
