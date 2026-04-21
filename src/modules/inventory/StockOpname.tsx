/**
 * StockOpname.tsx — Stock opname (physical stock count) UI.
 *
 * Data comes from useStockOpname() (React Query). After save, invalidates
 * the query to refetch updated system_stock values.
 *
 * T034 deliverable.
 */
import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../store/authStore'
import { useStockOpname, STOCK_OPNAME_QUERY_KEY } from '../../hooks/useStockOpname'
import { saveOpnameResults, InventoryError, type OpnameRow } from './inventory.service'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Alert, AlertDescription } from '../../components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table'

export function StockOpname() {
  const queryClient = useQueryClient()
  const activeStoreId = useAuthStore((s) => s.activeStoreId)
  const { data: fetchedRows = [], isLoading, error: fetchError } = useStockOpname()

  // Local editable rows — initialised from query data, mutated locally until saved
  const [rows, setRows] = useState<OpnameRow[]>([])
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  useEffect(() => {
    setRows(fetchedRows)
  }, [fetchedRows])

  const saveMutation = useMutation({
    mutationFn: () => saveOpnameResults(rows),
    onSuccess: () => {
      const changedCount = rows.filter((r) => r.physical_count !== r.system_stock).length
      setSuccessMsg(
        changedCount === 0
          ? 'Tidak ada perubahan stok yang perlu disimpan.'
          : `Stok opname selesai — ${changedCount} produk diperbarui.`,
      )
      void queryClient.invalidateQueries({ queryKey: STOCK_OPNAME_QUERY_KEY(activeStoreId) })
    },
    onError: (err) => setSuccessMsg(null),
  })

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

  const errorMsg = saveMutation.isError
    ? (saveMutation.error instanceof InventoryError ? saveMutation.error.message : 'Gagal menyimpan hasil opname')
    : (fetchError instanceof Error ? fetchError.message : null)

  if (isLoading) {
    return <p data-testid="opname-loading" className="text-sm text-gray-500">Memuat data stok…</p>
  }

  return (
    <div data-testid="stock-opname-container">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Stok Opname</h2>
        <Button
          data-testid="btn-save-opname"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? 'Menyimpan…' : 'Simpan Hasil Opname'}
        </Button>
      </div>

      {errorMsg && (
        <Alert variant="destructive" className="mb-3" data-testid="opname-error">
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}
      {successMsg && (
        <Alert className="mb-3 border-green-500 bg-green-50 text-green-800" data-testid="opname-success">
          <AlertDescription>{successMsg}</AlertDescription>
        </Alert>
      )}

      {rows.length === 0 ? (
        <p data-testid="opname-empty" className="text-sm text-gray-500">
          Belum ada produk. Tambahkan produk di halaman Katalog terlebih dahulu.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produk</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Stok Sistem</TableHead>
                <TableHead className="text-right">Jumlah Fisik</TableHead>
                <TableHead className="text-right">Selisih</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const diff = row.physical_count - row.system_stock
                return (
                  <TableRow
                    key={row.product_id}
                    data-testid={`opname-row-${row.product_id}`}
                    className={diff !== 0 ? 'bg-yellow-50' : ''}
                  >
                    <TableCell data-testid={`opname-product-name-${row.product_id}`}>
                      {row.product_name}
                    </TableCell>
                    <TableCell className="text-gray-500">{row.sku || '—'}</TableCell>
                    <TableCell className="text-right" data-testid={`opname-system-stock-${row.product_id}`}>
                      {row.system_stock}
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        min={0}
                        value={row.physical_count}
                        onChange={(e) => handlePhysicalCountChange(row.product_id, e.target.value)}
                        data-testid={`opname-physical-input-${row.product_id}`}
                        className="w-20 text-right ml-auto"
                      />
                    </TableCell>
                    <TableCell
                      className={`text-right font-medium ${
                        diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-600' : 'text-gray-400'
                      }`}
                      data-testid={`opname-diff-${row.product_id}`}
                    >
                      {diff > 0 ? `+${diff}` : diff}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
