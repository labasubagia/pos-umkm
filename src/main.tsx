import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import './index.css'
import './lib/i18n'
import { router } from './router'
import { AuthInitializer } from './components/AuthInitializer'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthInitializer>
      <RouterProvider router={router} />
    </AuthInitializer>
  </StrictMode>,
)
