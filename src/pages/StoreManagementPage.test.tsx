/**
 * Unit tests for StoreManagementPage.
 *
 * store-management.service is fully mocked so no real adapter I/O occurs.
 * useAuthStore is pre-seeded with an owner user.
 * react-router-dom navigate is mocked so redirect assertions are safe.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { act } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import StoreManagementPage from './StoreManagementPage'
import * as svc from '../modules/settings/store-management.service'
import type { StoreRecord } from '../modules/auth/setup.service'

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../modules/settings/store-management.service', () => ({
  listStores: vi.fn(),
  createStore: vi.fn(),
  updateStore: vi.fn(),
  removeOwnedStore: vi.fn(),
  removeAccessToStore: vi.fn(),
  StoreManagementError: class StoreManagementError extends Error {
    constructor(message: string) { super(message); this.name = 'StoreManagementError' }
  },
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const OWNER_EMAIL = 'owner@test.com'
const OTHER_EMAIL = 'other@test.com'

const ownedStore: StoreRecord = {
  store_id: 'store-owned',
  store_name: 'Toko Sendiri',
  master_spreadsheet_id: 'master-owned',
  drive_folder_id: 'folder-owned',
  owner_email: OWNER_EMAIL,
  my_role: 'owner',
  joined_at: '2026-01-01T00:00:00Z',
}

const joinedStore: StoreRecord = {
  store_id: 'store-joined',
  store_name: 'Toko Orang Lain',
  master_spreadsheet_id: 'master-joined',
  drive_folder_id: 'folder-joined',
  owner_email: OTHER_EMAIL,
  my_role: 'manager',
  joined_at: '2026-02-01T00:00:00Z',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function seedOwner() {
  act(() => {
    useAuthStore
      .getState()
      .setUser({ id: 'u1', email: OWNER_EMAIL, name: 'Test Owner', role: 'owner' }, 'owner', 'tok')
    useAuthStore.getState().setStores([ownedStore, joinedStore], ownedStore.store_id)
    useAuthStore.getState().setMainSpreadsheetId('main-id')
  })
}

function renderPage() {
  return render(
    <MemoryRouter>
      <StoreManagementPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  useAuthStore.getState().clearAuth()
  vi.clearAllMocks()
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('StoreManagementPage', () => {
  it('renders store list with correct action buttons per ownership', async () => {
    vi.mocked(svc.listStores).mockResolvedValue([ownedStore, joinedStore])
    seedOwner()
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Toko Sendiri')).toBeInTheDocument()
      expect(screen.getByText('Toko Orang Lain')).toBeInTheDocument()
    })

    // Owned store shows Edit + Hapus, no Keluar
    expect(screen.getByTestId(`btn-edit-store-${ownedStore.store_id}`)).toBeInTheDocument()
    expect(screen.getByTestId(`btn-delete-store-${ownedStore.store_id}`)).toBeInTheDocument()
    expect(screen.queryByTestId(`btn-leave-store-${ownedStore.store_id}`)).toBeNull()

    // Non-owned store shows Keluar only, no Edit/Hapus
    expect(screen.queryByTestId(`btn-edit-store-${joinedStore.store_id}`)).toBeNull()
    expect(screen.queryByTestId(`btn-delete-store-${joinedStore.store_id}`)).toBeNull()
    expect(screen.getByTestId(`btn-leave-store-${joinedStore.store_id}`)).toBeInTheDocument()
  })

  it('does not show Delete button for non-owned stores', async () => {
    vi.mocked(svc.listStores).mockResolvedValue([joinedStore])
    seedOwner()
    renderPage()

    await waitFor(() => screen.getByText('Toko Orang Lain'))
    expect(screen.queryByTestId(`btn-delete-store-${joinedStore.store_id}`)).toBeNull()
  })

  it('does not show Leave button for owned stores', async () => {
    vi.mocked(svc.listStores).mockResolvedValue([ownedStore])
    seedOwner()
    renderPage()

    await waitFor(() => screen.getByText('Toko Sendiri'))
    expect(screen.queryByTestId(`btn-leave-store-${ownedStore.store_id}`)).toBeNull()
  })

  it('Add dialog submits createStore and refreshes list', async () => {
    const user = userEvent.setup()
    const newStore: StoreRecord = { ...ownedStore, store_id: 'store-new', store_name: 'Toko Baru' }
    vi.mocked(svc.listStores)
      .mockResolvedValueOnce([ownedStore]) // initial load
      .mockResolvedValueOnce([ownedStore, newStore]) // after add
    vi.mocked(svc.createStore).mockResolvedValue(newStore)
    seedOwner()
    renderPage()

    await waitFor(() => screen.getByTestId('btn-add-store'))
    await user.click(screen.getByTestId('btn-add-store'))

    await user.type(screen.getByTestId('input-store-name'), 'Toko Baru')
    await user.click(screen.getByTestId('btn-save-store'))

    await waitFor(() => {
      expect(svc.createStore).toHaveBeenCalledWith('Toko Baru')
    })
    await waitFor(() => screen.getByText('Toko Baru'))
  })

  it('Edit dialog pre-fills store name and submits updateStore', async () => {
    const user = userEvent.setup()
    vi.mocked(svc.listStores).mockResolvedValue([ownedStore])
    vi.mocked(svc.updateStore).mockResolvedValue(undefined)
    seedOwner()
    renderPage()

    await waitFor(() => screen.getByTestId(`btn-edit-store-${ownedStore.store_id}`))
    await user.click(screen.getByTestId(`btn-edit-store-${ownedStore.store_id}`))

    const input = screen.getByTestId('input-store-name-edit')
    expect(input).toHaveValue('Toko Sendiri')

    await user.clear(input)
    await user.type(input, 'Toko Renamed')
    await user.click(screen.getByTestId('btn-save-store-edit'))

    await waitFor(() => {
      expect(svc.updateStore).toHaveBeenCalledWith(ownedStore.store_id, { store_name: 'Toko Renamed' })
    })
  })

  it('Delete confirmation calls removeOwnedStore and removes row from list', async () => {
    const user = userEvent.setup()
    vi.mocked(svc.listStores)
      .mockResolvedValueOnce([ownedStore, joinedStore]) // initial
      .mockResolvedValueOnce([joinedStore]) // after delete
    vi.mocked(svc.removeOwnedStore).mockResolvedValue(undefined)
    seedOwner()
    renderPage()

    await waitFor(() => screen.getByTestId(`btn-delete-store-${ownedStore.store_id}`))
    await user.click(screen.getByTestId(`btn-delete-store-${ownedStore.store_id}`))

    await user.click(screen.getByTestId('btn-confirm-delete-store'))

    await waitFor(() => {
      expect(svc.removeOwnedStore).toHaveBeenCalledWith(ownedStore.store_id)
    })
    await waitFor(() => expect(screen.queryByText('Toko Sendiri')).toBeNull())
  })

  it('Leave confirmation calls removeAccessToStore', async () => {
    const user = userEvent.setup()
    vi.mocked(svc.listStores).mockResolvedValue([ownedStore, joinedStore])
    vi.mocked(svc.removeAccessToStore).mockResolvedValue(undefined)
    seedOwner()
    renderPage()

    await waitFor(() => screen.getByTestId(`btn-leave-store-${joinedStore.store_id}`))
    await user.click(screen.getByTestId(`btn-leave-store-${joinedStore.store_id}`))

    await user.click(screen.getByTestId('btn-confirm-leave-store'))

    await waitFor(() => {
      expect(svc.removeAccessToStore).toHaveBeenCalledWith(joinedStore.master_spreadsheet_id)
    })
  })

  it('shows error Alert when createStore fails', async () => {
    const user = userEvent.setup()
    vi.mocked(svc.listStores).mockResolvedValue([ownedStore])
    vi.mocked(svc.createStore).mockRejectedValue(new Error('Drive quota exceeded'))
    seedOwner()
    renderPage()

    await waitFor(() => screen.getByTestId('btn-add-store'))
    await user.click(screen.getByTestId('btn-add-store'))
    await user.type(screen.getByTestId('input-store-name'), 'Toko Error')
    await user.click(screen.getByTestId('btn-save-store'))

    await waitFor(() => screen.getByTestId('alert-store-error'))
    expect(screen.getByTestId('alert-store-error')).toHaveTextContent('Drive quota exceeded')
  })

  it('shows error Alert when removeOwnedStore fails', async () => {
    const user = userEvent.setup()
    vi.mocked(svc.listStores).mockResolvedValue([ownedStore])
    vi.mocked(svc.removeOwnedStore).mockRejectedValue(new Error('Network error'))
    seedOwner()
    renderPage()

    await waitFor(() => screen.getByTestId(`btn-delete-store-${ownedStore.store_id}`))
    await user.click(screen.getByTestId(`btn-delete-store-${ownedStore.store_id}`))
    await user.click(screen.getByTestId('btn-confirm-delete-store'))

    await waitFor(() => screen.getByTestId('alert-store-error'))
    expect(screen.getByTestId('alert-store-error')).toHaveTextContent('Network error')
  })
})
