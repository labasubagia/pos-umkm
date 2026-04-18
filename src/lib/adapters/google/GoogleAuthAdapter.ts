/**
 * GoogleAuthAdapter — AuthAdapter implementation using Google Identity Services (GIS).
 *
 * Wraps the GIS token client flow. The `drive.file` scope is requested for
 * the owner (to create/write spreadsheets); `spreadsheets` scope is requested
 * for members (read/write to shared sheets). Scope is determined post-sign-in
 * based on the user's role stored in the Master Sheet.
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
            callback: (response: { access_token?: string; error?: string }) => void
          }): { requestAccessToken(): void }
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
const OWNER_SCOPE = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets'

export class GoogleAuthAdapter implements AuthAdapter {
  private currentUser: User | null = null
  private accessToken: string | null = null

  /**
   * Initiates the GIS token client flow.
   * Resolves when the user grants permission and an access token is received.
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
          this.accessToken = response.access_token
          try {
            const user = await fetchGoogleUserInfo(response.access_token)
            this.currentUser = user
            resolve(user)
          } catch (err) {
            reject(err)
          }
        },
      })
      tokenClient.requestAccessToken()
    })
  }

  /** Clears the in-memory token and user. GIS handles session revocation externally. */
  async signOut(): Promise<void> {
    this.currentUser = null
    this.accessToken = null
  }

  getCurrentUser(): User | null {
    return this.currentUser
  }

  getAccessToken(): string | null {
    return this.accessToken
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
    role: 'owner', // default; actual role is read from Master Sheet post-sign-in
  }
}
