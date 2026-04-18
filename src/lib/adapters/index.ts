/**
 * Active adapter selected at build time via VITE_ADAPTER env var.
 *
 * Vite tree-shakes the unused adapter out of the production bundle because
 * the conditional is resolved at build time (import.meta.env is static).
 *
 * Usage:
 *   VITE_ADAPTER=mock   → MockDataAdapter + MockAuthAdapter (dev/CI)
 *   VITE_ADAPTER=google → GoogleDataAdapter + GoogleAuthAdapter (production)
 *
 * Feature modules import from here, never from lib/sheets/ or lib/adapters/mock|google.
 */
import type { DataAdapter, AuthAdapter } from './types'
import { MockDataAdapter } from './mock/MockDataAdapter'
import { MockAuthAdapter } from './mock/MockAuthAdapter'
import { GoogleDataAdapter } from './google/GoogleDataAdapter'
import { GoogleAuthAdapter } from './google/GoogleAuthAdapter'

const adapterType = import.meta.env.VITE_ADAPTER ?? 'mock'

function createAdapters(): { dataAdapter: DataAdapter; authAdapter: AuthAdapter } {
  if (adapterType === 'google') {
    // GoogleDataAdapter requires a spreadsheetId and a token getter.
    // These are wired up in the auth flow (T014); a placeholder is used here.
    // The auth module calls dataAdapter.createSpreadsheet() on first run.
    const authAdapter = new GoogleAuthAdapter()
    const dataAdapter = new GoogleDataAdapter(
      authAdapter.getAccessToken() !== null
        ? (localStorage.getItem('spreadsheet_master') ?? '')
        : '',
      () => authAdapter.getAccessToken() ?? '',
    )
    return { dataAdapter, authAdapter }
  }
  return {
    dataAdapter: new MockDataAdapter(),
    authAdapter: new MockAuthAdapter(),
  }
}

const { dataAdapter, authAdapter } = createAdapters()

export { dataAdapter, authAdapter }
export type { DataAdapter, AuthAdapter }
export { AdapterError } from './types'
export type { User } from './types'
