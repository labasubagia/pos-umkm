/**
 * GoogleAuthAdapter — AuthAdapter implementation using Google Identity Services (GIS).
 *
 * Wraps the GIS token client flow. The `drive.file` scope is requested for
 * the owner (to create/write spreadsheets); `spreadsheets` scope is requested
 * for members (read/write to shared sheets). Scope is determined post-sign-in
 * based on the user's role stored in the Master Sheet.
 *
 * Token persistence follows the same pattern as the reference implementation
 * (labasubagia/product-price-list): access_token, expiry, and user profile are
 * stored in localStorage so the OAuth popup is only shown once per token lifetime
 * (~1 hour). restoreSession() checks expiry on every page load and skips the
 * popup when the token is still valid.
 *
 * By keeping all GIS-specific code in this file, future migration to a
 * different auth provider only requires replacing this adapter.
 */
import type { AuthAdapter, User } from '../types'
import { AdapterError } from '../types'

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(config: {
            client_id: string
            scope: string
            callback: (response: {
              access_token?: string
              expires_in?: number
              error?: string
            }) => void
          }): { requestAccessToken(options?: { prompt?: string }): void }
        }
        id: {
          initialize(config: {
            client_id: string
            callback: (response: { credential: string }) => void
          }): void
          prompt(): void
        }
      }
    }
  }
}

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
const OWNER_SCOPE =
  'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets'

// localStorage keys — prefixed to avoid clashes with other apps on the same origin.
const LS_ACCESS_TOKEN = 'gsi_access_token'
const LS_TOKEN_EXPIRY = 'gsi_token_expiry'
const LS_USER_ID = 'gsi_user_id'
const LS_USER_EMAIL = 'gsi_user_email'
const LS_USER_NAME = 'gsi_user_name'

export class GoogleAuthAdapter implements AuthAdapter {
  private currentUser: User | null = null
  private accessToken: string | null = null

  /**
   * Tries to restore a previous session from localStorage without showing an
   * OAuth popup. Checks token expiry first — if the stored token has expired
   * (or is missing), clears storage and returns null so the caller can redirect
   * to the login page.
   */
  async restoreSession(): Promise<User | null> {
    const token = localStorage.getItem(LS_ACCESS_TOKEN)
    const expiry = Number(localStorage.getItem(LS_TOKEN_EXPIRY) ?? '0')

    if (!token || Date.now() >= expiry) {
      this.clearStorage()
      return null
    }

    // Restore cached user profile — avoids a userinfo network round-trip.
    const id = localStorage.getItem(LS_USER_ID)
    const email = localStorage.getItem(LS_USER_EMAIL)
    const name = localStorage.getItem(LS_USER_NAME)
    if (!id || !email || !name) {
      this.clearStorage()
      return null
    }

    this.accessToken = token
    this.currentUser = { id, email, name, role: 'owner' }
    return this.currentUser
  }

  /**
   * Initiates the GIS token client flow.
   * Resolves when the user grants permission and a token is received.
   * Persists token + expiry + user profile to localStorage so subsequent
   * page loads can skip the popup via restoreSession().
   */
  async signIn(): Promise<User> {
    if (!CLIENT_ID) {
      throw new AdapterError('GoogleAuthAdapter: VITE_GOOGLE_CLIENT_ID env var is not set')
    }
    if (!window.google) {
      throw new AdapterError('GoogleAuthAdapter: Google Identity Services script not loaded')
    }

    return new Promise<User>((resolve, reject) => {
      const tokenClient = window.google!.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID!,
        scope: OWNER_SCOPE,
        callback: async (response) => {
          if (response.error || !response.access_token) {
            reject(new AdapterError(`GIS sign-in failed: ${response.error ?? 'no token'}`))
            return
          }

          const token = response.access_token
          // GIS returns expires_in in seconds; subtract 1 min buffer to avoid
          // using a token that is about to expire mid-request.
          const expiresIn = response.expires_in ?? 3600
          const expiry = Date.now() + expiresIn * 1000 - 60_000

          this.accessToken = token
          localStorage.setItem(LS_ACCESS_TOKEN, token)
          localStorage.setItem(LS_TOKEN_EXPIRY, expiry.toString())

          try {
            const user = await fetchGoogleUserInfo(token)
            this.currentUser = user
            localStorage.setItem(LS_USER_ID, user.id)
            localStorage.setItem(LS_USER_EMAIL, user.email)
            if (user.name) {
              localStorage.setItem(LS_USER_NAME, user.name)
            } else {
              localStorage.removeItem(LS_USER_NAME)
            }
            resolve(user)
          } catch (err) {
            reject(err)
          }
        },
      })
      tokenClient.requestAccessToken()
    })
  }

  /** Clears the in-memory token, user, and all localStorage keys. */
  async signOut(): Promise<void> {
    this.currentUser = null
    this.accessToken = null
    this.clearStorage()
  }

  getCurrentUser(): User | null {
    return this.currentUser
  }

  getAccessToken(): string | null {
    return this.accessToken
  }

  private clearStorage(): void {
    localStorage.removeItem(LS_ACCESS_TOKEN)
    localStorage.removeItem(LS_TOKEN_EXPIRY)
    localStorage.removeItem(LS_USER_ID)
    localStorage.removeItem(LS_USER_EMAIL)
    localStorage.removeItem(LS_USER_NAME)
  }
}

/**
 * Fetches the authenticated user's profile from the Google UserInfo endpoint.
 * Used after receiving an access token to populate the User object.
 */
async function fetchGoogleUserInfo(token: string): Promise<User> {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    throw new AdapterError(`Failed to fetch user info: HTTP ${res.status}`)
  }
  const data = await res.json()
  return {
    id: data.sub as string,
    email: data.email as string,
    name: data.name as string,
    role: 'owner' as const, // default; actual role is read from Master Sheet post-sign-in
  }
}
