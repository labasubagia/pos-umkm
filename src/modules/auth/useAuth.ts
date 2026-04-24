/**
 * useAuth — convenience hook for consuming the auth Zustand store.
 *
 * Re-exports the store so all auth consumers import from the same place
 * (`modules/auth/useAuth`) rather than referencing the store directly.
 * This keeps the auth module self-contained.
 */
export { useAuthStore as useAuth } from "../../store/authStore";
