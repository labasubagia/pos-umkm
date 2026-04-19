/**
 * T043 + T044 — settings.service unit tests
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getSettings,
  saveSettings,
  saveQRISImage,
  getQRISImage,
  SettingsError,
} from './settings.service'
import * as adapters from '../../lib/adapters'

beforeEach(() => {
  vi.restoreAllMocks()
})

// ── T043 ──────────────────────────────────────────────────────────────────────

describe('getSettings', () => {
  it('correctly maps all key-value rows to typed BusinessSettings object', async () => {
    vi.spyOn(adapters.dataAdapter, 'getSheet').mockResolvedValue([
      { id: '1', key: 'business_name', value: 'Warung Pak Santoso', updated_at: '' },
      { id: '2', key: 'timezone', value: 'Asia/Makassar', updated_at: '' },
      { id: '3', key: 'tax_rate', value: '11', updated_at: '' },
      { id: '4', key: 'receipt_footer', value: 'Terima kasih!', updated_at: '' },
      { id: '5', key: 'qris_image_url', value: 'https://example.com/qr.png', updated_at: '' },
    ])

    const settings = await getSettings()

    expect(settings.business_name).toBe('Warung Pak Santoso')
    expect(settings.timezone).toBe('Asia/Makassar')
    expect(settings.tax_rate).toBe(11)
    expect(settings.receipt_footer).toBe('Terima kasih!')
    expect(settings.qris_image_url).toBe('https://example.com/qr.png')
  })

  it('returns default values when Settings tab is empty', async () => {
    vi.spyOn(adapters.dataAdapter, 'getSheet').mockResolvedValue([])

    const settings = await getSettings()

    expect(settings.business_name).toBe('POS UMKM')
    expect(settings.timezone).toBe('Asia/Jakarta')
    expect(settings.tax_rate).toBe(11)
    expect(settings.receipt_footer).toBe('Terima kasih sudah berbelanja!')
    expect(settings.qris_image_url).toBe('')
  })
})

describe('saveSettings', () => {
  it('calls batchUpsertByKey with all changed fields', async () => {
    const upsertSpy = vi
      .spyOn(adapters.dataAdapter, 'batchUpsertByKey')
      .mockResolvedValue()

    await saveSettings({ business_name: 'New Name', tax_rate: 5 })

    expect(upsertSpy).toHaveBeenCalledWith(
      'Settings',
      'key',
      'value',
      expect.arrayContaining([
        { lookupValue: 'business_name', value: 'New Name' },
        { lookupValue: 'tax_rate', value: '5' },
      ]),
      expect.any(Function),
    )
    expect(upsertSpy).toHaveBeenCalledTimes(1)
  })

  it('does nothing when no fields provided', async () => {
    const upsertSpy = vi
      .spyOn(adapters.dataAdapter, 'batchUpsertByKey')
      .mockResolvedValue()

    await saveSettings({})

    expect(upsertSpy).not.toHaveBeenCalled()
  })
})

// ── T044 ──────────────────────────────────────────────────────────────────────

describe('saveQRISImage', () => {
  it('stores a data URL in the Settings tab', async () => {
    vi.spyOn(adapters.dataAdapter, 'getSheet').mockResolvedValue([])
    const appendSpy = vi
      .spyOn(adapters.dataAdapter, 'appendRow')
      .mockResolvedValue()

    const dataUrl = 'data:image/png;base64,abc123'
    await saveQRISImage(dataUrl)

    expect(appendSpy).toHaveBeenCalledWith(
      'Settings',
      expect.objectContaining({ key: 'qris_image_url', value: dataUrl }),
    )
  })

  it('stores an https URL in the Settings tab', async () => {
    vi.spyOn(adapters.dataAdapter, 'getSheet').mockResolvedValue([])
    const appendSpy = vi
      .spyOn(adapters.dataAdapter, 'appendRow')
      .mockResolvedValue()

    await saveQRISImage('https://example.com/qris.png')

    expect(appendSpy).toHaveBeenCalledWith(
      'Settings',
      expect.objectContaining({ key: 'qris_image_url', value: 'https://example.com/qris.png' }),
    )
  })

  it('throws SettingsError if value is not a valid URL or data URL', async () => {
    await expect(saveQRISImage('not-a-url')).rejects.toThrow(SettingsError)
    await expect(saveQRISImage('ftp://old-protocol.com/img.png')).rejects.toThrow(SettingsError)
    await expect(saveQRISImage('')).rejects.toThrow(SettingsError)
  })
})

describe('getQRISImage', () => {
  it('returns stored QRIS image value', async () => {
    vi.spyOn(adapters.dataAdapter, 'getSheet').mockResolvedValue([
      { id: '1', key: 'qris_image_url', value: 'https://cdn.example.com/qr.png', updated_at: '' },
    ])

    const url = await getQRISImage()

    expect(url).toBe('https://cdn.example.com/qr.png')
  })

  it('returns empty string when not configured', async () => {
    vi.spyOn(adapters.dataAdapter, 'getSheet').mockResolvedValue([])

    const url = await getQRISImage()

    expect(url).toBe('')
  })
})
