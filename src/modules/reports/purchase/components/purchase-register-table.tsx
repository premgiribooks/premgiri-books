import Link from "next/link";

import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PurchaseInvoiceStatusBadge } from "@/modules/purchase-invoices/components/purchase-invoice-status-badge";
import { formatPurchaseInvoiceDate } from "@/modules/purchase-invoices/utils/format-purchase-invoice-date";
import type { PurchaseInvoiceListRow } from "@/types/purchase-invoice";
import type { PurchaseRegisterTotals } from "@/types/purchase-report";

interface PurchaseRegisterTableProps {
  rows: PurchaseInvoiceListRow[];
  totals: PurchaseRegisterTotals;
}

export function PurchaseRegisterTable({ rows, totals }: PurchaseRegisterTableProps) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">No purchase invoices found for the selected filters.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Invoice Number</TableHead>
          <TableHead>Supplier Invoice No.</TableHead>
          <TableHead>Supplier</TableHead>
          <TableHead>Date</TableHead>
          <TableHead className="text-right">Taxable Amount</TableHead>
          <TableHead className="text-right">Total Tax</TableHead>
          <TableHead className="text-right">Grand Total</TableHead>
          <TableHead className="text-right">Amount Paid</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>
              <Link href={`/purchase/invoices/${row.id}`} className="font-medium text-foreground hover:underline">
                {row.invoiceNumber ?? "—"}
              </Link>
            </TableCell>
            <TableCell>{row.supplierInvoiceNumber}</TableCell>
            <TableCell>{row.supplier.name}</TableCell>
            <TableCell className="font-financial">{formatPurchaseInvoiceDate(row.invoiceDate)}</TableCell>
            <TableCell className="text-right font-financial">{row.taxableAmount.toFixed(2)}</TableCell>
            <TableCell className="text-right font-financial">
              {(row.totalCgst + row.totalSgst + row.totalIgst + row.totalCess).toFixed(2)}
            </TableCell>
            <TableCell className="text-right font-financial">{row.grandTotal.toFixed(2)}</TableCell>
            <TableCell className="text-right font-financial">{row.amountPaid.toFixed(2)}</TableCell>
            <TableCell>
              <PurchaseInvoiceStatusBadge status={row.status} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={4} className="text-right font-medium">
            Period Total
          </TableCell>
          <TableCell className="text-right font-financial font-medium">{totals.taxableAmount.toFixed(2)}</TableCell>
          <TableCell className="text-right font-financial font-medium">{totals.totalTax.toFixed(2)}</TableCell>
          <TableCell className="text-right font-financial font-medium">{totals.grandTotal.toFixed(2)}</TableCell>
          <TableCell className="text-right font-financial font-medium">{totals.amountPaid.toFixed(2)}</TableCell>
          <TableCell />
        </TableRow>
      </TableFooter>
    </Table>
  );
}
