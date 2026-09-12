import Link from "next/link";

import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SalesInvoiceStatusBadge } from "@/modules/sales-invoices/components/sales-invoice-status-badge";
import { formatSalesInvoiceDate } from "@/modules/sales-invoices/utils/format-sales-invoice-date";
import type { SalesInvoiceListRow } from "@/types/sales-invoice";
import type { SalesRegisterTotals } from "@/types/sales-report";

interface SalesRegisterTableProps {
  rows: SalesInvoiceListRow[];
  totals: SalesRegisterTotals;
}

/** Resolved display name per Business Rules #1 — mirrors
 * sales-invoice-table.tsx's own `customerLabel` exactly. */
function customerLabel(invoice: SalesInvoiceListRow): string {
  if (invoice.customer) {
    return invoice.customer.name;
  }
  if (invoice.customerMode === "QUICK") {
    return invoice.quickCustomerName ?? "Quick Customer";
  }
  return invoice.quickCustomerName ? `Walk-in — ${invoice.quickCustomerName}` : "Walk-in";
}

export function SalesRegisterTable({ rows, totals }: SalesRegisterTableProps) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">No sales invoices found for the selected filters.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Invoice Number</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Customer</TableHead>
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
              <Link href={`/sales/invoices/${row.id}`} className="font-medium text-foreground hover:underline">
                {row.invoiceNumber}
              </Link>
            </TableCell>
            <TableCell className="font-financial">{formatSalesInvoiceDate(row.invoiceDate)}</TableCell>
            <TableCell>{customerLabel(row)}</TableCell>
            <TableCell className="text-right font-financial">{row.taxableAmount.toFixed(2)}</TableCell>
            <TableCell className="text-right font-financial">
              {(row.totalCgst + row.totalSgst + row.totalIgst + row.totalCess).toFixed(2)}
            </TableCell>
            <TableCell className="text-right font-financial">{row.grandTotal.toFixed(2)}</TableCell>
            <TableCell className="text-right font-financial">{row.amountPaid.toFixed(2)}</TableCell>
            <TableCell>
              <SalesInvoiceStatusBadge status={row.status} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={3} className="text-right font-medium">
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
