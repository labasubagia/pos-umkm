/**
 * settings.service.ts — Business settings management.
 *
 * Reads/writes the `Settings` tab of the Master Sheet.
 * The Settings tab uses a key-value layout:
 *   Row 1: header sentinel
 *   Row N: { key: "business_name", value: "Warung Pak Santoso" }
 *
 * QRIS image URL is stored here so the cashier screen can display the
 * static merchant QR code without any backend integration.
 */

import { dataAdapter } from '../../lib/adapters'
import { nowUTC } from '../../lib/formatters'

export interface BusinessSettings {
  business_name: string
  timezone: string
  tax_rate: number
  receipt_footer: string
  qris_image_url: string
}

/** Reads all settings rows and returns them as a flat object. */
export async function getSettings(): Promise<BusinessSettings> {
  const rows = await dataAdapter.getSheet('Settings')
  const map: Record<string, string> = {}
  for (const row of rows) {
    if (row['key'] && row['value'] !== undefined) {
      map[row['key'] as string] = String(row['value'])
    }
  }
  return {
    business_name: map['business_name'] ?? 'POS UMKM',
    timezone: map['timezone'] ?? 'Asia/Jakarta',
    tax_rate: parseInt(map['tax_rate'] ?? '11', 10),
    receipt_footer: map['receipt_footer'] ?? 'Terima kasih sudah berbelanja!',
    qris_image_url: map['qris_image_url'] ?? '',
  }
}

/** Returns the QRIS QR image URL stored in Settings, or empty string if not configured. */
export async function getQRISImageUrl(): Promise<string> {
  const settings = await getSettings()
  return settings.qris_image_url
}

/**
 * Saves the QRIS image URL to the Settings tab.
 * If a row for qris_image_url already exists, it is updated via updateCell.
 * Otherwise a new key-value row is appended.
 */
export async function saveQRISImageUrl(url: string): Promise<void> {
  const rows = await dataAdapter.getSheet('Settings')
  const existing = rows.find((r) => r['key'] === 'qris_image_url')
  if (existing) {
    await dataAdapter.updateCell('Settings', existing['id'] as string, 'value', url)
  } else {
    await dataAdapter.appendRow('Settings', {
      key: 'qris_image_url',
      value: url,
      updated_at: nowUTC(),
    })
  }
}

/** Saves any subset of business settings. */
export async function saveSetting(key: string, value: string): Promise<void> {
  const rows = await dataAdapter.getSheet('Settings')
  const existing = rows.find((r) => r['key'] === key)
  if (existing) {
    await dataAdapter.updateCell('Settings', existing['id'] as string, 'value', value)
  } else {
    await dataAdapter.appendRow('Settings', {
      key,
      value,
      updated_at: nowUTC(),
    })
  }
}
