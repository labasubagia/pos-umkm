/**
 * SetupWizard — onboarding form for first-time store owners.
 *
 * Collects business name, timezone, and PPN toggle.
 * On submit: creates master spreadsheet, initializes all tabs,
 * and navigates to /cashier.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/button'
import { createMasterSpreadsheet, initializeMasterSheets, saveSpreadsheetId } from './setup.service'
import { dataAdapter } from '../../lib/adapters'
import { useAuth } from './useAuth'

const TIMEZONES = [
  { label: 'WIB (UTC+7) — Jakarta, Bandung', value: 'Asia/Jakarta' },
  { label: 'WITA (UTC+8) — Makassar, Bali', value: 'Asia/Makassar' },
  { label: 'WIT (UTC+9) — Jayapura', value: 'Asia/Jayapura' },
]

export default function SetupWizard() {
  const navigate = useNavigate()
  const { setSpreadsheetId } = useAuth()
  const [businessName, setBusinessName] = useState('')
  const [timezone, setTimezone] = useState('Asia/Jakarta')
  const [ppnEnabled, setPpnEnabled] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!businessName.trim()) {
      setError('Nama usaha wajib diisi')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const spreadsheetId = await createMasterSpreadsheet(businessName.trim())
      await initializeMasterSheets(spreadsheetId)
      saveSpreadsheetId(spreadsheetId)

      // Persist settings row
      await dataAdapter.appendRow('Settings', {
        business_name: businessName.trim(),
        timezone,
        tax_rate: ppnEnabled ? 11 : 0,
        receipt_footer: '',
      })

      setSpreadsheetId(spreadsheetId)
      navigate('/cashier')
    } catch (err) {
      setError(`Setup gagal: ${String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-bold">Selamat Datang di POS UMKM</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-sm">
        <label className="flex flex-col gap-1">
          <span className="font-medium">Nama Usaha</span>
          <input
            className="border rounded px-3 py-2"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="Nama usaha Anda"
            required
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-medium">Zona Waktu</span>
          <select
            className="border rounded px-3 py-2"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
          >
            {TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={ppnEnabled}
            onChange={(e) => setPpnEnabled(e.target.checked)}
          />
          <span>Aktifkan PPN 11%</span>
        </label>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <Button type="submit" disabled={loading}>
          {loading ? 'Menyiapkan...' : 'Mulai Sekarang'}
        </Button>
      </form>
    </div>
  )
}
