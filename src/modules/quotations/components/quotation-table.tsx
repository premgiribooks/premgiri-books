import Link from "next/link";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { QuotationStatusBadge } from "@/modules/quotations/components/quotation-status-badge";
import { formatQuotationDate } from "@/modules/quotations/utils/format-quotation-date";
import type { QuotationListRow } from "@/types/quotation";

interface QuotationTableProps {
  quotations: QuotationListRow[];
}

export function QuotationTable({ quotations }: QuotationTableProps) {
  if (quotations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">No quotations found.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Number</TableHead>
          <TableHead>Customer</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Valid Until</TableHead>
          <TableHead className="text-right">Grand Total</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {quotations.map((quotation) => (
          <TableRow key={quotation.id}>
            <TableCell>
              <Link
                href={`/sales/quotations/${quotation.id}`}
                className="font-medium text-foreground hover:underline"
              >
                {quotation.quotationNumber}
              </Link>
            </TableCell>
            <TableCell>{quotation.customer.name}</TableCell>
            <TableCell className="font-financial">{formatQuotationDate(quotation.quotationDate)}</TableCell>
            <TableCell className="font-financial">
              {quotation.validUntil ? (
                formatQuotationDate(quotation.validUntil)
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell className="text-right font-financial">
              {quotation.grandTotal.toFixed(2)}
            </TableCell>
            <TableCell>
              <QuotationStatusBadge status={quotation.status} />
            </TableCell>
            <TableCell className="text-right">
              <Link href={`/sales/quotations/${quotation.id}`} className="text-sm text-primary hover:underline">
                View
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
