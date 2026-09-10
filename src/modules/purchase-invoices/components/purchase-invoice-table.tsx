import Link from "next/link";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PurchaseInvoiceStatusBadge } from "@/modules/purchase-invoices/components/purchase-invoice-status-badge";
import { formatPurchaseInvoiceDate } from "@/modules/purchase-invoices/utils/format-purchase-invoice-date";
import type { PurchaseInvoiceListRow } from "@/types/purchase-invoice";

interface PurchaseInvoiceTableProps {
  purchaseInvoices: PurchaseInvoiceListRow[];
}

export function PurchaseInvoiceTable({ purchaseInvoices }: PurchaseInvoiceTableProps) {
  if (purchaseInvoices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">No purchase invoices found.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Number</TableHead>
          <TableHead>Supplier Invoice No.</TableHead>
          <TableHead>Supplier</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Grand Total</TableHead>
          <TableHead className="text-right">Paid</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {purchaseInvoices.map((invoice) => (
          <TableRow key={invoice.id}>
            <TableCell>
              <Link href={`/purchase/invoices/${invoice.id}`} className="font-medium text-foreground hover:underline">
                {invoice.invoiceNumber ?? "—"}
              </Link>
            </TableCell>
            <TableCell>{invoice.supplierInvoiceNumber}</TableCell>
            <TableCell>{invoice.supplier.name}</TableCell>
            <TableCell className="font-financial">{formatPurchaseInvoiceDate(invoice.invoiceDate)}</TableCell>
            <TableCell>
              <PurchaseInvoiceStatusBadge status={invoice.status} />
            </TableCell>
            <TableCell className="text-right font-financial">{invoice.grandTotal.toFixed(2)}</TableCell>
            <TableCell className="text-right font-financial">{invoice.amountPaid.toFixed(2)}</TableCell>
            <TableCell className="text-right">
              <Link href={`/purchase/invoices/${invoice.id}`} className="text-sm text-primary hover:underline">
                View
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
