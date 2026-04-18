/**
 * T014 — Auth Store + ProtectedRoute unit tests
 *
 * Tests the Zustand auth store and the ProtectedRoute component.
 * Uses MockAuthAdapter so no OAuth network calls are made.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { act } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { ProtectedRoute } from './ProtectedRoute'

function resetAuthStore() {
  useAuthStore.getState().clearAuth()
}

describe('Auth Store', () => {
  beforeEach(resetAuthStore)

  it('isAuthenticated is false on initial state', () => {
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
  })

  it('login sets user, role, accessToken in store', () => {
    act(() => {
      useAuthStore.getState().setUser(
        { id: 'u1', email: 'owner@test.com', name: 'Owner', role: 'owner' },
        'owner',
        'tok-123',
      )
    })
    const state = useAuthStore.getState()
    expect(state.isAuthenticated).toBe(true)
    expect(state.user?.email).toBe('owner@test.com')
    expect(state.role).toBe('owner')
    expect(state.accessToken).toBe('tok-123')
  })

  it('logout clears user, role, accessToken from store', () => {
    act(() => {
      useAuthStore.getState().setUser(
        { id: 'u1', email: 'owner@test.com', name: 'Owner', role: 'owner' },
        'owner',
        'tok-123',
      )
      useAuthStore.getState().clearAuth()
    })
    const state = useAuthStore.getState()
    expect(state.isAuthenticated).toBe(false)
    expect(state.user).toBeNull()
    expect(state.accessToken).toBeNull()
  })

  it('login does not store accessToken in localStorage', () => {
    act(() => {
      useAuthStore.getState().setUser(
        { id: 'u1', email: 'owner@test.com', name: 'Owner', role: 'owner' },
        'owner',
        'tok-abc',
      )
    })
    // Access token must NOT appear in any localStorage key
    const stored = JSON.stringify(Object.entries(localStorage))
    expect(stored).not.toContain('tok-abc')
  })
})

describe('ProtectedRoute', () => {
  beforeEach(resetAuthStore)

  it('redirects to / when not authenticated', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/cashier']}>
        <Routes>
          <Route path="/" element={<div>Login</div>} />
          <Route
            path="/cashier"
            element={
              <ProtectedRoute>
                <div>Cashier</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    )
    expect(container.textContent).toContain('Login')
    expect(container.textContent).not.toContain('Cashier')
  })

  it('renders children when authenticated', () => {
    act(() => {
      useAuthStore.getState().setUser(
        { id: 'u1', email: 'owner@test.com', name: 'Owner', role: 'owner' },
        'owner',
        'tok-123',
      )
    })
    render(
      <MemoryRouter initialEntries={['/cashier']}>
        <Routes>
          <Route path="/" element={<div>Login</div>} />
          <Route
            path="/cashier"
            element={
              <ProtectedRoute>
                <div>Cashier</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByText('Cashier')).toBeTruthy()
  })
})
