import { describe, it, expect, beforeEach } from 'vitest'
import { MockAuthAdapter } from './MockAuthAdapter'

describe('MockAuthAdapter', () => {
  let adapter: MockAuthAdapter

  beforeEach(() => {
    adapter = new MockAuthAdapter()
  })

  it('signIn returns preset owner user', async () => {
    const user = await adapter.signIn()
    expect(user.id).toBe('mock-owner')
    expect(user.email).toBe('owner@test.com')
    expect(user.role).toBe('owner')
  })

  it('getCurrentUser returns null before signIn', () => {
    expect(adapter.getCurrentUser()).toBeNull()
  })

  it('signOut clears current user', async () => {
    await adapter.signIn()
    await adapter.signOut()
    expect(adapter.getCurrentUser()).toBeNull()
  })

  it('getAccessToken returns "mock-token" after signIn', async () => {
    await adapter.signIn()
    expect(adapter.getAccessToken()).toBe('mock-token')
  })

  it('getAccessToken returns null before signIn', () => {
    expect(adapter.getAccessToken()).toBeNull()
  })

  it('getAccessToken returns null after signOut', async () => {
    await adapter.signIn()
    await adapter.signOut()
    expect(adapter.getAccessToken()).toBeNull()
  })
})
