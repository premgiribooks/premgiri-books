import Link from "next/link";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Gstr1DocumentGroup } from "@/types/gstr1";

const DOCUMENT_DETAIL_HREF: Record<Gstr1DocumentGroup["documentType"], (id: string) => string> = {
  SALES_INVOICE: (id) => `/sales/invoices/${id}`,
  SALES_RETURN: (id) => `/sales/returns/${id}`,
  CREDIT_NOTE: (id) => `/sales/credit-notes/${id}`,
  DEBIT_NOTE: (id) => `/sales/debit-notes/${id}`,
};

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "2-digit" });
}

interface Gstr1DocumentGroupTableProps {
  title: string;
  groups: Gstr1DocumentGroup[];
  emptyMessage: string;
}

/** Invoice-wise groups, one row per document — shared rendering for Table 4
 * (B2B), Table 5 (B2C Large), and Table 9B/9C's registered rows
 * (58-gstr-1.md), since all three share this exact row shape. Each
 * document's own rate-wise breakup is summed onto one row (a real GSTR-1
 * filer works from the taxable/tax totals per invoice, not the underlying
 * line detail — the source document's own detail page, linked here, is
 * the drill-down for that). */
export function Gstr1DocumentGroupTable({ title, groups, emptyMessage }: Gstr1DocumentGroupTableProps) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {groups.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Document Number</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Party</TableHead>
              <TableHead>GSTIN</TableHead>
              <TableHead>Place of Supply</TableHead>
              <TableHead className="text-right">Taxable Amount</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map((group) => (
              <TableRow key={`${group.documentType}-${group.documentId}`}>
                <TableCell>
                  <Link
                    href={DOCUMENT_DETAIL_HREF[group.documentType](group.documentId)}
                    className="font-medium text-foreground hover:underline"
                  >
                    {group.documentNumber || "Draft"}
                  </Link>
                </TableCell>
                <TableCell className="font-financial">{formatDate(group.documentDate)}</TableCell>
                <TableCell className="text-muted-foreground">{group.partyName}</TableCell>
                <TableCell className="text-muted-foreground">{group.partyGstin ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{group.placeOfSupplyStateCode}</TableCell>
                <TableCell className="text-right font-financial">{group.taxableAmount.toFixed(2)}</TableCell>
                <TableCell className="text-right font-financial font-medium">{group.totalAmount.toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
