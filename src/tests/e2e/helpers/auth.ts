import { Page } from '@playwright/test'

/**
 * Sign-in helper for E2E tests.
 * Full implementation will be added in T022 when auth flow is built.
 * Currently a no-op stub.
 */
export async function signInAsOwner(page: Page): Promise<void> {
  // TODO: implement in T022
}

export async function signInAsCashier(page: Page): Promise<void> {
  // TODO: implement in T022
}
