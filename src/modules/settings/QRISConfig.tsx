/**
 * QRISConfig — Upload or paste a QRIS merchant QR code image.
 *
 * Loads current image via useQRISImage() (React Query).
 * Save invalidates the query to reflect the update.
 */
import { useState, useRef, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../store/authStore'
import { useQRISImage, QRIS_QUERY_KEY } from '../../hooks/useQRISImage'
import { saveQRISImage, SettingsError } from './settings.service'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Alert, AlertDescription } from '../../components/ui/alert'

export default function QRISConfig() {
  const queryClient = useQueryClient()
  const activeStoreId = useAuthStore((s) => s.activeStoreId)
  const { data: storedUrl = '' } = useQRISImage()

  const [url, setUrl] = useState('')
  const [preview, setPreview] = useState<string>('')
  const [success, setSuccess] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Populate url/preview when query data loads
  useEffect(() => {
    if (storedUrl) {
      setUrl(storedUrl)
      setPreview(storedUrl)
    }
  }, [storedUrl])

  const saveMutation = useMutation({
    mutationFn: (urlToSave: string) => saveQRISImage(urlToSave),
    onSuccess: () => {
      setSuccess(true)
      void queryClient.invalidateQueries({ queryKey: QRIS_QUERY_KEY(activeStoreId) })
    },
    onError: () => setSuccess(false),
  })

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

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSuccess(false)
    saveMutation.mutate(url)
  }

  const errorMsg = saveMutation.isError
    ? (saveMutation.error instanceof SettingsError
        ? saveMutation.error.message
        : String(saveMutation.error))
    : null

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
        {errorMsg && (
          <Alert variant="destructive" data-testid="qris-save-error">
            <AlertDescription>{errorMsg}</AlertDescription>
          </Alert>
        )}

        <Button data-testid="btn-save-qris" type="submit" disabled={saveMutation.isPending || !url}>
          {saveMutation.isPending ? 'Menyimpan…' : 'Simpan QRIS'}
        </Button>
      </form>
    </div>
  )
}
