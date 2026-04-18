/**
 * BusinessProfile — Form for editing business settings.
 *
 * Loads settings on mount. On save, calls saveSettings with changed fields only.
 */
import { useState, useEffect } from 'react'
import { getSettings, saveSettings, type BusinessSettings } from './settings.service'
import { Button } from '../../components/ui/button'

const TIMEZONES = ['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura'] as const

export default function BusinessProfile() {
  const [form, setForm] = useState<BusinessSettings>({
    business_name: '',
    timezone: 'Asia/Jakarta',
    tax_rate: 11,
    receipt_footer: '',
    qris_image_url: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void getSettings().then((s) => {
      setForm(s)
      setLoading(false)
    })
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target
    setForm((prev) => ({
      ...prev,
      [name]: name === 'tax_rate' ? parseInt(value, 10) : value,
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSuccess(false)
    setError(null)
    try {
      await saveSettings(form)
      setSuccess(true)
    } catch (err) {
      setError(String(err))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="p-4 text-sm text-gray-500">Memuat pengaturan…</p>

  return (
    <form
      data-testid="business-profile-form"
      onSubmit={handleSubmit}
      className="space-y-4 max-w-lg"
    >
      <div>
        <label className="block text-sm font-medium mb-1">Nama Bisnis</label>
        <input
          data-testid="input-business-name"
          type="text"
          name="business_name"
          value={form.business_name}
          onChange={handleChange}
          required
          className="w-full border rounded px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Zona Waktu</label>
        <select
          data-testid="input-timezone"
          name="timezone"
          value={form.timezone}
          onChange={handleChange}
          className="w-full border rounded px-3 py-2 text-sm"
        >
          {TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Tarif PPN (%)</label>
        <input
          data-testid="input-tax-rate"
          type="number"
          name="tax_rate"
          min={0}
          max={99}
          value={form.tax_rate}
          onChange={handleChange}
          className="w-full border rounded px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Footer Struk</label>
        <input
          data-testid="input-receipt-footer"
          type="text"
          name="receipt_footer"
          value={form.receipt_footer}
          onChange={handleChange}
          className="w-full border rounded px-3 py-2 text-sm"
        />
      </div>

      {success && (
        <p data-testid="profile-save-success" className="text-sm text-green-600">
          Pengaturan berhasil disimpan.
        </p>
      )}
      {error && (
        <p data-testid="profile-save-error" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <Button data-testid="btn-save-profile" type="submit" disabled={saving}>
        {saving ? 'Menyimpan…' : 'Simpan'}
      </Button>
    </form>
  )
}
