/**
 * CustomerSearch.tsx — Typeahead search component for attaching a customer to a transaction.
 *
 * Loads the full customer list once on mount and filters client-side to avoid
 * per-keystroke API calls (acceptable for UMKM scale: typically < 1000 customers).
 * Shows a "Tambah Pelanggan Baru" button when no results match the query.
 */

import { useState, useEffect } from 'react'
import { fetchCustomers, type Customer } from './customers.service'
import { Input } from '../../components/ui/input'
import { Button } from '../../components/ui/button'

interface CustomerSearchProps {
  /** Called when the user selects a customer, or null to clear the selection. */
  onSelect: (customer: Customer | null) => void
}

export function CustomerSearch({ onSelect }: CustomerSearchProps) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Customer | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCustomers()
      .then(setCustomers)
      .finally(() => setLoading(false))
  }, [])

  const filtered = query.trim()
    ? customers.filter(
        (c) =>
          c.name.toLowerCase().includes(query.trim().toLowerCase()) ||
          c.phone.includes(query.trim()),
      )
    : []

  const hasResults = filtered.length > 0
  const showAddButton = query.trim().length > 0 && !hasResults

  function handleSelect(customer: Customer) {
    setSelected(customer)
    setQuery(customer.name)
    onSelect(customer)
  }

  function handleClear() {
    setSelected(null)
    setQuery('')
    onSelect(null)
  }

  return (
    <div className="relative w-full" data-testid="customer-search">
      <div className="flex items-center gap-2">
        <Input
          type="text"
          placeholder="Cari pelanggan (nama / telepon)..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            if (selected) {
              setSelected(null)
              onSelect(null)
            }
          }}
          data-testid="customer-search-input"
          disabled={loading}
        />
        {selected && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={handleClear}
            data-testid="btn-clear-customer"
            aria-label="Hapus pilihan pelanggan"
          >
            ✕
          </Button>
        )}
      </div>

      {/* Dropdown results */}
      {!selected && query.trim().length > 0 && (
        <ul className="absolute z-10 mt-1 w-full rounded border border-gray-200 bg-white shadow-lg">
          {hasResults ? (
            filtered.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50"
                  onClick={() => handleSelect(c)}
                  data-testid={`customer-result-${c.id}`}
                >
                  <span className="font-medium">{c.name}</span>
                  <span className="ml-2 text-gray-500">{c.phone}</span>
                </button>
              </li>
            ))
          ) : showAddButton ? (
            <li>
              <button
                type="button"
                className="w-full px-4 py-2 text-left text-sm text-blue-600 hover:bg-blue-50"
                onClick={() => {
                  /* Parent can handle this via a modal / form */
                }}
                data-testid="btn-add-new-customer"
              >
                + Tambah Pelanggan Baru
              </button>
            </li>
          ) : null}
        </ul>
      )}
    </div>
  )
}

export default CustomerSearch
