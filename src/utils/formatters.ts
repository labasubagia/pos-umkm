/**
 * IDR Formatter & Date Utilities
 *
 * `Intl.NumberFormat` is used for currency formatting (native, no bundle cost)
 * rather than a library like numeral.js. All monetary storage is in plain
 * integers (no decimals). `date-fns` with the `id` locale is used for date
 * formatting — chosen over moment.js (deprecated, large) and dayjs (smaller
 * but less type-safe with locales).
 */
import { format, parseISO } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { toZonedTime } from "date-fns-tz";

/**
 * Formats an integer amount in IDR (Indonesian Rupiah).
 * Uses id-ID locale: thousands separator is a period, no decimal places.
 * The Intl.NumberFormat output is normalized to use a regular space instead
 * of the non-breaking space (\u00a0) that some environments emit.
 * Example: formatIDR(15000) → "Rp 15.000"
 */
export function formatIDR(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
    .format(amount)
    .replace(/\u00a0/g, " ");
}

/**
 * Formats a UTC ISO 8601 string for display in the given IANA timezone.
 * Default timezone: browser local. Default format: "dd/MM/yyyy HH:mm".
 * Format tokens follow date-fns conventions (dd, MM, yyyy, HH, mm, ss, etc.)
 * Timezone examples: 'Asia/Jakarta' (WIB), 'Asia/Makassar' (WITA), 'Asia/Jayapura' (WIT).
 */
export function formatDateTimeTZ(
  isoString: string,
  timezone = Intl.DateTimeFormat().resolvedOptions().timeZone,
  fmt = "dd/MM/yyyy HH:mm",
): string {
  const zonedDate = toZonedTime(parseISO(isoString), timezone);
  return format(zonedDate, fmt, { locale: idLocale });
}

/**
 * Returns the current UTC time as an ISO 8601 string (e.g. "2026-04-18T14:30:00.000Z").
 * Stored in Google Sheets as-is — modules convert to local timezone only for display.
 */
export function nowUTC(): string {
  return new Date().toISOString();
}

/**
 * Parses an IDR display string (e.g. "Rp 15.000") back to an integer.
 * Throws on malformed input.
 */
export function parseIDR(displayString: string): number {
  // Strip currency prefix and whitespace, then remove thousands separators (dots)
  const cleaned = displayString.replace(/Rp\s*/i, "").replace(/\./g, "").trim();
  if (!/^\d+$/.test(cleaned)) {
    throw new Error(`parseIDR: cannot parse "${displayString}" as IDR amount`);
  }
  return parseInt(cleaned, 10);
}
