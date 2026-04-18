// Auth module — barrel file.
// All public exports from this module must be re-exported here.
// Other modules may only import from 'src/modules/auth', never from internal paths.
export { AuthProvider } from './AuthProvider'
export { ProtectedRoute } from './ProtectedRoute'
export { RoleRoute } from './RoleRoute'
export { useAuth } from './useAuth'
export { default as LoginPage } from './LoginPage'
export { default as JoinPage } from './JoinPage'
export { default as SetupWizard } from './SetupWizard'
export { PinLock } from './PinLock'
export * from './auth.service'
export * from './setup.service'
export * from './pin.service'
export * from './usePinLock'

