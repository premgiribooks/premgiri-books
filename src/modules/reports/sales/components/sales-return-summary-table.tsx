import Link from "next/link";

import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SalesReturnStatusBadge } from "@/modules/sales-returns/components/sales-return-status-badge";
import { formatSalesReturnDate } from "@/modules/sales-returns/utils/format-sales-return-date";
import type { SalesReturnSummaryReport } from "@/types/sales-report";

interface SalesReturnSummaryTableProps {
  report: SalesReturnSummaryReport;
}

const REFUND_MODE_LABEL: Record<string, string> = {
  LEDGER_ADJUSTMENT: "Ledger Adjustment",
  CASH_REFUND: "Cash Refund",
};

export function SalesReturnSummaryTable({ report }: SalesReturnSummaryTableProps) {
  if (report.rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">No sales returns found for the selected filters.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Return Number</TableHead>
          <TableHead>Source Invoice</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Customer</TableHead>
          <TableHead className="text-right">Grand Total</TableHead>
          <TableHead>Refund Mode</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {report.rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>
              <Link href={`/sales/returns/${row.id}`} className="font-medium text-foreground hover:underline">
                {row.returnNumber ?? "Draft"}
              </Link>
            </TableCell>
            <TableCell>
              <Link href={`/sales/invoices/${row.salesInvoice.id}`} className="text-primary hover:underline">
                {row.salesInvoice.invoiceNumber}
              </Link>
            </TableCell>
            <TableCell className="font-financial">{formatSalesReturnDate(row.returnDate)}</TableCell>
            <TableCell>{row.salesInvoice.customerName ?? "—"}</TableCell>
            <TableCell className="text-right font-financial">{row.grandTotal.toFixed(2)}</TableCell>
            <TableCell>{REFUND_MODE_LABEL[row.refundMode] ?? row.refundMode}</TableCell>
            <TableCell>
              <SalesReturnStatusBadge status={row.status} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={4} className="text-right font-medium">
            Period Total
          </TableCell>
          <TableCell className="text-right font-financial font-medium">{report.totalGrandTotal.toFixed(2)}</TableCell>
          <TableCell colSpan={2} />
        </TableRow>
      </TableFooter>
    </Table>
  );
}
