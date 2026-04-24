/**
 * ReceiptModal.tsx — Receipt preview and WhatsApp share (T033).
 *
 * Renders the receipt text and provides a "Share via WhatsApp" button.
 * The cashier can also just close the modal without sharing.
 */
import { Share2, CheckCircle } from "lucide-react";
import { generateReceiptText, generateWhatsAppLink } from "./receipt.service";
import type { Transaction, TransactionItem } from "./cashier.service";
import { Button } from "../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { ScrollArea } from "../../components/ui/scroll-area";

interface Props {
  transaction: Transaction;
  items: TransactionItem[];
  businessName: string;
  receiptFooter?: string;
  timezone: string;
  customerPhone?: string;
  onClose: () => void;
}

export function ReceiptModal({
  transaction,
  items,
  businessName,
  receiptFooter,
  timezone,
  customerPhone = "",
  onClose,
}: Props) {
  const receiptText = generateReceiptText(transaction, items, {
    businessName,
    receiptFooter,
    timezone,
  });

  const waLink = generateWhatsAppLink(customerPhone, receiptText);

  return (
    <Dialog
      open={true}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="max-w-sm flex flex-col max-h-[90vh]"
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle>
            <span className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              <span data-testid="receipt-success">Transaksi Berhasil</span>
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* Receipt preview */}
        <ScrollArea className="flex-1 max-h-64">
          <pre
            className="text-xs font-mono whitespace-pre-wrap bg-gray-50 rounded-lg p-3 border"
            data-testid="receipt-preview"
          >
            {receiptText}
          </pre>
        </ScrollArea>

        {/* Actions */}
        <div className="flex flex-col gap-2">
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
          <Button
            variant="outline"
            onClick={onClose}
            data-testid="btn-receipt-close"
          >
            Tutup
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
