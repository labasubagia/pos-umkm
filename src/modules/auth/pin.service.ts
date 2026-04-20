/**
 * pin.service.ts — PIN hashing and verification using bcryptjs.
 *
 * bcryptjs is a pure-JS bcrypt implementation — no native binary required
 * in the browser. PIN validation runs entirely client-side with no network
 * call, which means the lock screen can work even without internet access.
 *
 * The PIN hash is stored in the `Members` sheet (Master Spreadsheet) via
 * DataAdapter so it persists across sessions and devices.
 */

import bcrypt from 'bcryptjs'
import { getRepos } from '../../lib/adapters'

const BCRYPT_ROUNDS = 10

/**
 * Hashes a plain-text PIN using bcrypt.
 * The rounds parameter is intentionally low (10) because we want
 * the hash to be fast enough for UX on mobile, while still being
 * computationally expensive enough to deter brute-force.
 */
export async function hashPIN(pin: string): Promise<string> {
  return bcrypt.hash(pin, BCRYPT_ROUNDS)
}

/**
 * Compares a plain-text PIN against a previously hashed value.
 * Returns true only if the PIN matches the hash exactly.
 */
export async function verifyPIN(pin: string, hash: string): Promise<boolean> {
  if (!pin) return false
  return bcrypt.compare(pin, hash)
}

/**
 * Saves the PIN hash to the `Members` sheet for the given userId.
 * Stores in the `pin_hash` column via DataAdapter so the call works
 * with both Mock (localStorage) and Google (Sheets API) adapters.
 */
export async function savePINHash(
  userId: string,
  hash: string,
): Promise<void> {
  await getRepos().members.updateCell(userId, 'pin_hash', hash)
}
