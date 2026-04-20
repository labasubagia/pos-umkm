/**
 * BusinessProfile — Form for editing business settings.
 *
 * Loads settings on mount. On save, calls saveSettings with changed fields only.
 * If business_name changed, also syncs the new name to the main spreadsheet's
 * Stores tab and to the Zustand stores list so the NavBar reflects it immediately.
 */
import { useState, useEffect, useRef } from 'react'
import { getSettings, saveSettings, type BusinessSettings } from './settings.service'
import { updateStoreName } from '../auth/setup.service'
import { useAuth } from '../auth/useAuth'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Alert, AlertDescription } from '../../components/ui/alert'

const TIMEZONES = ['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura'] as const

export default function BusinessProfile() {
  const { activeStoreId, spreadsheetId, updateActiveStoreName } = useAuth()
  const [initialName, setInitialName] = useState('')
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
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    void getSettings().then((s) => {
      setForm(s)
      setInitialName(s.business_name)
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

      // If the business name changed, sync it to main spreadsheet's Stores tab
      // and to Zustand so the NavBar store picker reflects the new name immediately.
      if (form.business_name !== initialName && activeStoreId && spreadsheetId) {
        await updateStoreName(activeStoreId, form.business_name)
        updateActiveStoreName(form.business_name)
        setInitialName(form.business_name)
      }

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
      <div className="space-y-1.5">
        <Label htmlFor="business_name">Nama Bisnis</Label>
        <Input
          id="business_name"
          data-testid="input-business-name"
          type="text"
          name="business_name"
          value={form.business_name}
          onChange={handleChange}
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="timezone">Zona Waktu</Label>
        <select
          id="timezone"
          data-testid="input-timezone"
          name="timezone"
          value={form.timezone}
          onChange={handleChange}
          className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm"
        >
          {TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="tax_rate">Tarif PPN (%)</Label>
        <Input
          id="tax_rate"
          data-testid="input-tax-rate"
          type="number"
          name="tax_rate"
          min={0}
          max={99}
          value={form.tax_rate}
          onChange={handleChange}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="receipt_footer">Footer Struk</Label>
        <Input
          id="receipt_footer"
          data-testid="input-receipt-footer"
          type="text"
          name="receipt_footer"
          value={form.receipt_footer}
          onChange={handleChange}
        />
      </div>

      {success && (
        <Alert className="border-green-500 bg-green-50 text-green-800" data-testid="profile-save-success">
          <AlertDescription>Pengaturan berhasil disimpan.</AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive" data-testid="profile-save-error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button data-testid="btn-save-profile" type="submit" disabled={saving}>
        {saving ? 'Menyimpan…' : 'Simpan'}
      </Button>
    </form>
  )
}
