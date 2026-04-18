/**
 * StockOpname.tsx — Stock opname (physical stock count) UI.
 *
 * Displays a table of all products with system stock and an editable
 * physical count input. On save, only changed rows are written to the sheet.
 *
 * T034 deliverable.
 */
import { useEffect, useState, useCallback } from 'react'
import { fetchStockOpnameData, saveOpnameResults, InventoryError, type OpnameRow } from './inventory.service'

export function StockOpname() {
  const [rows, setRows] = useState<OpnameRow[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchStockOpnameData()
      setRows(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data stok')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function handlePhysicalCountChange(productId: string, value: string) {
    const count = parseInt(value, 10)
    setRows((prev) =>
      prev.map((r) =>
        r.product_id === productId
          ? { ...r, physical_count: isNaN(count) ? r.physical_count : count }
          : r,
      ),
    )
    setSuccessMsg(null)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSuccessMsg(null)
    try {
      await saveOpnameResults(rows)
      const changedCount = rows.filter((r) => r.physical_count !== r.system_stock).length
      setSuccessMsg(
        changedCount === 0
          ? 'Tidak ada perubahan stok yang perlu disimpan.'
          : `Stok opname selesai — ${changedCount} produk diperbarui.`,
      )
      // Reload to reflect updated system_stock values
      await load()
    } catch (err) {
      setError(err instanceof InventoryError ? err.message : 'Gagal menyimpan hasil opname')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p data-testid="opname-loading" className="text-sm text-gray-500">Memuat data stok…</p>
  }

  return (
    <div data-testid="stock-opname-container">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Stok Opname</h2>
        <button
          data-testid="btn-save-opname"
          onClick={handleSave}
          disabled={saving}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Menyimpan…' : 'Simpan Hasil Opname'}
        </button>
      </div>

      {error && (
        <p data-testid="opname-error" className="mb-3 rounded bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {successMsg && (
        <p data-testid="opname-success" className="mb-3 rounded bg-green-50 p-3 text-sm text-green-700">
          {successMsg}
        </p>
      )}

      {rows.length === 0 ? (
        <p data-testid="opname-empty" className="text-sm text-gray-500">
          Belum ada produk. Tambahkan produk di halaman Katalog terlebih dahulu.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left">
                <th className="px-3 py-2 font-medium text-gray-600">Produk</th>
                <th className="px-3 py-2 font-medium text-gray-600">SKU</th>
                <th className="px-3 py-2 text-right font-medium text-gray-600">Stok Sistem</th>
                <th className="px-3 py-2 text-right font-medium text-gray-600">Jumlah Fisik</th>
                <th className="px-3 py-2 text-right font-medium text-gray-600">Selisih</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const diff = row.physical_count - row.system_stock
                return (
                  <tr
                    key={row.product_id}
                    data-testid={`opname-row-${row.product_id}`}
                    className={`border-b ${diff !== 0 ? 'bg-yellow-50' : ''}`}
                  >
                    <td className="px-3 py-2" data-testid={`opname-product-name-${row.product_id}`}>
                      {row.product_name}
                    </td>
                    <td className="px-3 py-2 text-gray-500">{row.sku || '—'}</td>
                    <td className="px-3 py-2 text-right" data-testid={`opname-system-stock-${row.product_id}`}>
                      {row.system_stock}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        min={0}
                        value={row.physical_count}
                        onChange={(e) => handlePhysicalCountChange(row.product_id, e.target.value)}
                        data-testid={`opname-physical-input-${row.product_id}`}
                        className="w-20 rounded border border-gray-300 px-2 py-1 text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-medium ${
                        diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-600' : 'text-gray-400'
                      }`}
                      data-testid={`opname-diff-${row.product_id}`}
                    >
                      {diff > 0 ? `+${diff}` : diff}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
