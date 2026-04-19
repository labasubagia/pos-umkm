/**
 * QRISConfig — Upload or paste a QRIS merchant QR code image.
 *
 * Accepts a file upload (converted to data URL) or a direct https URL.
 * Displays a preview of the current image if one is stored.
 */
import { useState, useEffect, useRef } from 'react'
import { getQRISImage, saveQRISImage, SettingsError } from './settings.service'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Alert, AlertDescription } from '../../components/ui/alert'

export default function QRISConfig() {
  const [url, setUrl] = useState('')
  const [preview, setPreview] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    void getQRISImage().then((stored) => {
      if (stored) {
        setUrl(stored)
        setPreview(stored)
      }
    })
  }, [])

  function handleUrlChange(e: React.ChangeEvent<HTMLInputElement>) {
    setUrl(e.target.value)
    setPreview(e.target.value)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string
      setUrl(dataUrl)
      setPreview(dataUrl)
    }
    reader.readAsDataURL(file)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSuccess(false)
    setError(null)
    try {
      await saveQRISImage(url)
      setSuccess(true)
    } catch (err) {
      if (err instanceof SettingsError) {
        setError(err.message)
      } else {
        setError(String(err))
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div data-testid="qris-config-container" className="space-y-4 max-w-lg">
      <form onSubmit={handleSave} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="qris-url">URL Gambar QRIS</Label>
          <Input
            id="qris-url"
            data-testid="input-qris-url"
            type="text"
            value={url.startsWith('data:') ? '' : url}
            onChange={handleUrlChange}
            placeholder="https://..."
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="qris-file">Atau unggah gambar</Label>
          <input
            id="qris-file"
            data-testid="input-qris-file"
            type="file"
            accept="image/*"
            ref={fileRef}
            onChange={handleFileChange}
            className="text-sm"
          />
        </div>

        {preview && (
          <img
            data-testid="qris-image-preview"
            src={preview}
            alt="QRIS preview"
            className="max-w-[200px] border rounded"
          />
        )}

        {success && (
          <Alert className="border-green-500 bg-green-50 text-green-800" data-testid="qris-save-success">
            <AlertDescription>Gambar QRIS berhasil disimpan.</AlertDescription>
          </Alert>
        )}
        {error && (
          <Alert variant="destructive" data-testid="qris-save-error">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button data-testid="btn-save-qris" type="submit" disabled={saving || !url}>
          {saving ? 'Menyimpan…' : 'Simpan QRIS'}
        </Button>
      </form>
    </div>
  )
}
