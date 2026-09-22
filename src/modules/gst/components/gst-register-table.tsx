import Link from "next/link";

import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { GstSupplyLine, GstSupplyLineDocumentType } from "@/engines/gst/gst-report-types";
import type { GstRegisterTotals } from "@/types/gst-report";

const DOCUMENT_TYPE_LABELS: Record<GstSupplyLineDocumentType, string> = {
  SALES_INVOICE: "Sales Invoice",
  SALES_RETURN: "Sales Return",
  CREDIT_NOTE: "Credit Note",
  DEBIT_NOTE: "Debit Note",
  PURCHASE_INVOICE: "Purchase Invoice",
  PURCHASE_RETURN: "Purchase Return",
  PURCHASE_CREDIT_NOTE: "Purchase Credit Note",
};

/** Each document type's own detail-page route — the drill-down this report exists to provide. */
const DOCUMENT_DETAIL_HREF: Record<GstSupplyLineDocumentType, (id: string) => string> = {
  SALES_INVOICE: (id) => `/sales/invoices/${id}`,
  SALES_RETURN: (id) => `/sales/returns/${id}`,
  CREDIT_NOTE: (id) => `/sales/credit-notes/${id}`,
  DEBIT_NOTE: (id) => `/sales/debit-notes/${id}`,
  PURCHASE_INVOICE: (id) => `/purchase/invoices/${id}`,
  PURCHASE_RETURN: (id) => `/purchase/returns/${id}`,
  PURCHASE_CREDIT_NOTE: (id) => `/purchase/credit-notes/${id}`,
};

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "2-digit" });
}

interface GstRegisterTableProps {
  lines: GstSupplyLine[];
  totals: GstRegisterTotals;
}

export function GstRegisterTable({ lines, totals }: GstRegisterTableProps) {
  if (lines.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">No GST transactions found for the selected filters.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Document Type</TableHead>
          <TableHead>Document Number</TableHead>
          <TableHead>Party</TableHead>
          <TableHead>Place of Supply</TableHead>
          <TableHead>HSN</TableHead>
          <TableHead className="text-right">Rate %</TableHead>
          <TableHead className="text-right">Taxable Amount</TableHead>
          <TableHead className="text-right">CGST</TableHead>
          <TableHead className="text-right">SGST</TableHead>
          <TableHead className="text-right">IGST</TableHead>
          <TableHead className="text-right">CESS</TableHead>
          <TableHead className="text-right">Total</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {lines.map((line, index) => (
          <TableRow key={`${line.documentType}-${line.documentId}-${index}`}>
            <TableCell className="font-financial">{formatDate(line.documentDate)}</TableCell>
            <TableCell>{DOCUMENT_TYPE_LABELS[line.documentType]}</TableCell>
            <TableCell>
              <Link
                href={DOCUMENT_DETAIL_HREF[line.documentType](line.documentId)}
                className="font-medium text-foreground hover:underline"
              >
                {line.documentNumber || "Draft"}
              </Link>
            </TableCell>
            <TableCell className="text-muted-foreground">{line.partyName}</TableCell>
            <TableCell className="text-muted-foreground">{line.placeOfSupplyStateCode}</TableCell>
            <TableCell className="text-muted-foreground">{line.hsnCode ?? "—"}</TableCell>
            <TableCell className="text-right font-financial">{line.ratePercent.toFixed(2)}</TableCell>
            <TableCell className="text-right font-financial">{line.taxableAmount.toFixed(2)}</TableCell>
            <TableCell className="text-right font-financial">{line.cgst.toFixed(2)}</TableCell>
            <TableCell className="text-right font-financial">{line.sgst.toFixed(2)}</TableCell>
            <TableCell className="text-right font-financial">{line.igst.toFixed(2)}</TableCell>
            <TableCell className="text-right font-financial">{line.cess.toFixed(2)}</TableCell>
            <TableCell className="text-right font-financial font-medium">{line.totalAmount.toFixed(2)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={7} className="text-right font-medium">
            Period Total
          </TableCell>
          <TableCell className="text-right font-financial font-medium">{totals.taxableAmount.toFixed(2)}</TableCell>
          <TableCell className="text-right font-financial font-medium">{totals.cgst.toFixed(2)}</TableCell>
          <TableCell className="text-right font-financial font-medium">{totals.sgst.toFixed(2)}</TableCell>
          <TableCell className="text-right font-financial font-medium">{totals.igst.toFixed(2)}</TableCell>
          <TableCell className="text-right font-financial font-medium">{totals.cess.toFixed(2)}</TableCell>
          <TableCell className="text-right font-financial font-medium">{totals.totalAmount.toFixed(2)}</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}
