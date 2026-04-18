/**
 * ReceiptModal.tsx — Receipt preview and WhatsApp share (T033).
 *
 * Renders the receipt text and provides a "Share via WhatsApp" button.
 * The cashier can also just close the modal without sharing.
 */
import { X, Share2, CheckCircle } from 'lucide-react'
import { generateReceiptText, generateWhatsAppLink } from './receipt.service'
import type { Transaction, TransactionItem } from './cashier.service'

interface Props {
  transaction: Transaction
  items: TransactionItem[]
  businessName: string
  receiptFooter?: string
  timezone: string
  customerPhone?: string
  onClose: () => void
}

export function ReceiptModal({
  transaction,
  items,
  businessName,
  receiptFooter,
  timezone,
  customerPhone = '',
  onClose,
}: Props) {
  const receiptText = generateReceiptText(transaction, items, {
    businessName,
    receiptFooter,
    timezone,
  })

  const waLink = generateWhatsAppLink(customerPhone, receiptText)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle className="h-5 w-5" />
            <h2 className="font-semibold" data-testid="receipt-success">Transaksi Berhasil</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>

        {/* Receipt preview */}
        <div className="flex-1 overflow-y-auto p-4">
          <pre className="text-xs font-mono whitespace-pre-wrap bg-gray-50 rounded-lg p-3 border" data-testid="receipt-preview">
            {receiptText}
          </pre>
        </div>

        {/* Actions */}
        <div className="p-4 border-t flex flex-col gap-2 shrink-0">
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 py-2.5 bg-green-500 text-white rounded-xl font-semibold hover:bg-green-600 transition-colors"
            aria-label="Kirim via WhatsApp"
            data-testid="btn-whatsapp-share"
          >
            <Share2 className="h-4 w-4" />
            Kirim via WhatsApp
          </a>
          <button
            onClick={onClose}
            className="py-2.5 border rounded-xl text-sm hover:bg-gray-50 font-medium"
            data-testid="btn-receipt-close"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}
