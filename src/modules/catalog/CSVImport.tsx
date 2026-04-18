/**
 * CSVImport.tsx — File picker + validation preview + import action.
 *
 * Flow:
 *   1. User picks a CSV file → parsed + validated in browser
 *   2. Validation results are displayed (per-row errors highlighted)
 *   3. If all rows valid, "Import" button is enabled
 *   4. On confirm, bulkImportProducts writes all rows + store is refreshed
 */

import { useRef, useState } from 'react'
import { parseProductCSV, validateImportRows, bulkImportProducts } from './csv.service'
import type { ParsedProduct, RowValidationResult } from './csv.service'
import { useCatalogStore } from './useCatalog'
import { formatIDR } from '../../lib/formatters'

export function CSVImport() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<ParsedProduct[]>([])
  const [results, setResults] = useState<RowValidationResult[]>([])
  const [importError, setImportError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [successCount, setSuccessCount] = useState<number | null>(null)
  const { loadCatalog } = useCatalogStore()

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportError(null)
    setSuccessCount(null)
    try {
      const parsed = await parseProductCSV(file)
      const validation = validateImportRows(parsed)
      setRows(parsed)
      setResults(validation)
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleImport() {
    setImportError(null)
    setImporting(true)
    try {
      await bulkImportProducts(rows)
      setSuccessCount(rows.length)
      setRows([])
      setResults([])
      if (fileInputRef.current) fileInputRef.current.value = ''
      await loadCatalog()
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err))
    } finally {
      setImporting(false)
    }
  }

  const hasErrors = results.some((r) => !r.valid)
  const canImport = rows.length > 0 && !hasErrors

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Import Produk via CSV</h2>
        <a
          href="/pos-umkm/templates/products-template.csv"
          download
          className="text-sm text-blue-600 hover:underline"
        >
          Unduh Template CSV
        </a>
      </div>

      <div className="rounded border border-dashed border-gray-300 p-6 text-center">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          className="hidden"
          id="csv-file-input"
        />
        <label
          htmlFor="csv-file-input"
          className="cursor-pointer rounded bg-gray-100 px-4 py-2 text-sm hover:bg-gray-200"
        >
          Pilih File CSV
        </label>
        <p className="mt-2 text-xs text-gray-500">
          Format: name, category_id, price, stock, sku, has_variants
        </p>
      </div>

      {importError && (
        <div className="rounded bg-red-50 px-4 py-3 text-sm text-red-700">{importError}</div>
      )}

      {successCount !== null && (
        <div className="rounded bg-green-50 px-4 py-3 text-sm text-green-700">
          {successCount} produk berhasil diimport.
        </div>
      )}

      {results.length > 0 && (
        <>
          <div className="overflow-x-auto rounded border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Baris</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Nama</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Harga</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Stok</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i} className={r.valid ? '' : 'bg-red-50'}>
                    <td className="px-3 py-2">{r.row}</td>
                    <td className="px-3 py-2">{rows[i]?.name || '—'}</td>
                    <td className="px-3 py-2">
                      {rows[i]?.price ? formatIDR(rows[i].price) : '—'}
                    </td>
                    <td className="px-3 py-2">{rows[i]?.stock ?? '—'}</td>
                    <td className="px-3 py-2">
                      {r.valid ? (
                        <span className="text-green-700">✓ Valid</span>
                      ) : (
                        <span className="text-red-700">✗ {r.error}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleImport}
              disabled={!canImport || importing}
              className="rounded bg-blue-600 px-5 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {importing ? 'Mengimport…' : `Import ${rows.length} Produk`}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
