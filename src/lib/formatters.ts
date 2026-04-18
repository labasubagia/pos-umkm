/**
 * IDR Formatter & Date Utilities
 *
 * `Intl.NumberFormat` is used for currency formatting (native, no bundle cost)
 * rather than a library like numeral.js. All monetary storage is in plain
 * integers (no decimals). `date-fns` with the `id` locale is used for date
 * formatting — chosen over moment.js (deprecated, large) and dayjs (smaller
 * but less type-safe with locales).
 */
import { format, parseISO } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { toZonedTime } from 'date-fns-tz'

export { formatIDR } from './formatIDR'

/**
 * Formats an integer IDR amount as a display string.
 * Throws if the amount is negative or not an integer.
 */
export function formatIDRStrict(amount: number): string {
  if (amount < 0) throw new RangeError(`formatIDR: amount must be ≥ 0, got ${amount}`)
  if (!Number.isInteger(amount))
    throw new TypeError(`formatIDR: amount must be an integer, got ${amount}`)
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

/**
 * Formats a UTC ISO 8601 string as DD/MM/YYYY in the given IANA timezone.
 * Timezone examples: 'Asia/Jakarta' (WIB), 'Asia/Makassar' (WITA), 'Asia/Jayapura' (WIT).
 */
export function formatDate(isoString: string, timezone: string): string {
  const zonedDate = toZonedTime(parseISO(isoString), timezone)
  return format(zonedDate, 'dd/MM/yyyy', { locale: idLocale })
}

/**
 * Formats a UTC ISO 8601 string as DD/MM/YYYY HH:mm in the given IANA timezone.
 */
export function formatDateTime(isoString: string, timezone: string): string {
  const zonedDate = toZonedTime(parseISO(isoString), timezone)
  return format(zonedDate, 'dd/MM/yyyy HH:mm', { locale: idLocale })
}

/**
 * Returns the current UTC time as an ISO 8601 string (e.g. "2026-04-18T14:30:00.000Z").
 * Stored in Google Sheets as-is — modules convert to local timezone only for display.
 */
export function nowUTC(): string {
  return new Date().toISOString()
}

/**
 * Parses an IDR display string (e.g. "Rp 15.000") back to an integer.
 * Throws on malformed input.
 */
export function parseIDR(displayString: string): number {
  // Strip currency prefix and whitespace, then remove thousands separators (dots)
  const cleaned = displayString.replace(/Rp\s*/i, '').replace(/\./g, '').trim()
  if (!/^\d+$/.test(cleaned)) {
    throw new Error(`parseIDR: cannot parse "${displayString}" as IDR amount`)
  }
  return parseInt(cleaned, 10)
}
