// Auth module — barrel file.
// All public exports from this module must be re-exported here.
// Other modules may only import from 'src/modules/auth', never from internal paths.
export { AuthProvider } from "./AuthProvider";
export * from "./auth.service";
export { default as JoinPage } from "./JoinPage";
export { default as LoginPage } from "./LoginPage";
export { PinLock } from "./PinLock";
export { ProtectedRoute } from "./ProtectedRoute";
export * from "./pin.service";
export { RoleRoute } from "./RoleRoute";
export { default as SetupWizard } from "./SetupWizard";
export * from "./setup.service";
export { useAuth } from "./useAuth";
export * from "./usePinLock";
