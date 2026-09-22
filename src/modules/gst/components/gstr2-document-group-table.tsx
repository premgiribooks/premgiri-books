import Link from "next/link";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Gstr3bRowNote } from "@/modules/gst/components/gstr3b-row-note";
import type { Gstr2DocumentGroup } from "@/types/gstr2";

const DOCUMENT_DETAIL_HREF: Record<Gstr2DocumentGroup["documentType"], (id: string) => string> = {
  PURCHASE_INVOICE: (id) => `/purchase/invoices/${id}`,
  PURCHASE_RETURN: (id) => `/purchase/returns/${id}`,
  PURCHASE_CREDIT_NOTE: (id) => `/purchase/credit-notes/${id}`,
};

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "2-digit" });
}

interface Gstr2DocumentGroupTableProps {
  groups: Gstr2DocumentGroup[];
  caveat: string;
}

/**
 * Table 3 — invoice-wise groups for registered (GSTIN-present) suppliers, one
 * row per Purchase Invoice/Purchase Return, each linking to its own source
 * document's detail page (the drill-down 57-gst-registers.md's registers
 * exist to provide). Shares 58-gstr-1.md's Gstr1DocumentGroupTable row shape
 * (invoice-wise, rate-breakup summed onto one row), reimplemented here rather
 * than reused directly since this table's own document-type/href set is the
 * inward pair (Purchase Invoice/Purchase Return), not GSTR-1's outward one.
 */
export function Gstr2DocumentGroupTable({ groups, caveat }: Gstr2DocumentGroupTableProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-foreground">
          Table 3 — Inward Supplies from a Registered Person (Other than Reverse Charge)
        </h3>
        <Gstr3bRowNote reason={caveat} variant="note" />
      </div>
      {groups.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          No registered-supplier purchases in this period.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Document Number</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Supplier</TableHead>
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
