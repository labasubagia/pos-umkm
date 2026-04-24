/**
 * Thin wrapper around `crypto.randomUUID()` so tests can mock it via
 * `vi.spyOn(uuidModule, 'generateId')` without patching globalThis.
 * `crypto.randomUUID` is natively available in all supported browsers
 * (Chrome 92+, Firefox 95+, Safari 15.4+) — no polyfill needed.
 */
export function generateId(): string {
  return crypto.randomUUID();
}
