import '@testing-library/jest-dom'

// Provide a localStorage implementation for the jsdom test environment.
// jsdom has one but it may not be fully wired up for zustand/middleware persist.
const store: Record<string, string> = {}
const mockStorage: Storage = {
  getItem: (key) => store[key] ?? null,
  setItem: (key, value) => { store[key] = value },
  removeItem: (key) => { delete store[key] },
  clear: () => { Object.keys(store).forEach((k) => delete store[k]) },
  get length() { return Object.keys(store).length },
  key: (i) => Object.keys(store)[i] ?? null,
}
Object.defineProperty(globalThis, 'localStorage', { value: mockStorage, writable: true })
