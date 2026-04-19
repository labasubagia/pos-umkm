/**
 * MockAuthAdapter — AuthAdapter implementation with a preset owner user.
 *
 * Returns a hardcoded user so no OAuth flow is needed during development
 * or CI. The preset user's role is 'owner' so all features are accessible
 * in the dev environment without additional setup.
 */
import type { AuthAdapter, User } from '../types'

const PRESET_USER: User = {
  id: 'mock-owner',
  email: 'owner@test.com',
  name: 'Test Owner',
  // 'owner' preset gives full access during dev; real role resolved from Users sheet post-auth
  role: 'owner',
}

const MOCK_TOKEN = 'mock-token'

export class MockAuthAdapter implements AuthAdapter {
  private currentUser: User | null = null

  /** No persistent session in mock mode — always returns null. */
  async restoreSession(): Promise<User | null> {
    return null
  }

  /** Signs in with the preset owner user — no OAuth involved. */
  async signIn(): Promise<User> {
    this.currentUser = PRESET_USER
    return PRESET_USER
  }

  /** Clears the in-memory user. */
  async signOut(): Promise<void> {
    this.currentUser = null
  }

  /** Returns the current user, or null if signOut was called. */
  getCurrentUser(): User | null {
    return this.currentUser
  }

  /**
   * Returns a static mock token after sign-in.
   * Returns null before signIn is called so callers can detect unauthenticated state.
   */
  getAccessToken(): string | null {
    return this.currentUser ? MOCK_TOKEN : null
  }
}
