/**
 * Formats an integer amount in IDR (Indonesian Rupiah).
 * Uses id-ID locale: thousands separator is a period, no decimal places.
 * Example: formatIDR(15000) → "Rp 15.000"
 */
export function formatIDR(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}
