/**
 * T048 — NavBar unit tests
 *
 * Verifies role-filtered nav links, logo, username display,
 * sign-out behaviour, and unauthenticated state.
 *
 * authAdapter.signOut is mocked so no real OAuth calls are made.
 * useNavigate is mocked because NavBar calls navigate('/') on sign-out.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { act } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { NavBar } from './NavBar'
import * as adapters from '../lib/adapters'
import type { Role } from '../lib/adapters/types'

vi.mock('../lib/adapters', () => ({
  authAdapter: {
    signOut: vi.fn().mockResolvedValue(undefined),
    signIn: vi.fn(),
    getCurrentUser: vi.fn(() => null),
    getAccessToken: vi.fn(() => null),
  },
  dataAdapter: {},
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

function setRole(role: Role, name = 'Test User') {
  act(() => {
    useAuthStore
      .getState()
      .setUser({ id: 'u1', email: 'test@test.com', name, role }, role, 'tok')
  })
}

function renderNavBar(initialPath = '/cashier') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <NavBar />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  useAuthStore.getState().clearAuth()
  vi.clearAllMocks()
})

describe('NavBar', () => {
  it('renders logo text "POS UMKM"', () => {
    setRole('owner')
    renderNavBar()
    expect(screen.getByTestId('navbar-logo')).toHaveTextContent('POS UMKM')
  })

  it('owner sees all 6 nav links (Kasir, Katalog, Inventori, Pelanggan, Laporan, Pengaturan)', () => {
    setRole('owner')
    renderNavBar()
    expect(screen.getByTestId('navbar-nav').querySelectorAll('a')).toHaveLength(6)
  })

  it('manager sees 5 nav links (not Pengaturan)', () => {
    setRole('manager')
    renderNavBar()
    expect(screen.getByTestId('navbar-nav').querySelectorAll('a')).toHaveLength(5)
    expect(screen.queryByTestId('nav-settings')).toBeNull()
  })

  it('cashier sees only Kasir link', () => {
    setRole('cashier')
    renderNavBar()
    const links = screen.getByTestId('navbar-nav').querySelectorAll('a')
    expect(links).toHaveLength(1)
    expect(screen.getByTestId('nav-cashier')).toBeTruthy()
  })

  it('active route link has active styling (aria-current="page")', () => {
    setRole('owner')
    renderNavBar('/cashier')
    // React Router NavLink sets aria-current="page" on the active link
    expect(screen.getByTestId('nav-cashier')).toHaveAttribute('aria-current', 'page')
    expect(screen.queryByTestId('nav-catalog')).not.toHaveAttribute('aria-current', 'page')
  })

  it('renders username from auth store', () => {
    setRole('owner', 'Budi Santoso')
    renderNavBar()
    expect(screen.getByTestId('navbar-username')).toHaveTextContent('Budi Santoso')
  })

  it('sign-out button calls authAdapter.signOut and clearAuth', async () => {
    const user = userEvent.setup()
    setRole('owner')
    renderNavBar()
    await user.click(screen.getByTestId('btn-logout'))
    expect(adapters.authAdapter.signOut).toHaveBeenCalledOnce()
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true })
  })

  it('unauthenticated user sees no nav links and no username', () => {
    // No setRole — store starts cleared (no user)
    renderNavBar()
    expect(screen.getByTestId('navbar-nav').querySelectorAll('a')).toHaveLength(0)
    expect(screen.queryByTestId('navbar-username')).toBeNull()
  })
})
