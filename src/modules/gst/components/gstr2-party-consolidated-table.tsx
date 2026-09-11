import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Gstr3bRowNote } from "@/modules/gst/components/gstr3b-row-note";
import type { Gstr2PartyConsolidatedGroup } from "@/types/gstr2";

interface Gstr2PartyConsolidatedTableProps {
  groups: Gstr2PartyConsolidatedGroup[];
  caveat: string;
}

/**
 * Table 7 — no-GSTIN-supplier and nil-rated lines, consolidated by supplier
 * (Business Rules), unlike GSTR-1's own Table 7 which consolidates by place
 * of supply + rate — a different grouping key needs its own table shape
 * rather than reusing Gstr1ConsolidatedTable's (place, rate) columns.
 */
export function Gstr2PartyConsolidatedTable({ groups, caveat }: Gstr2PartyConsolidatedTableProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-foreground">
          Table 7 — Supplies from Composition Taxpayers and Other Exempt/Nil-Rated/Non-GST Inward Supplies
        </h3>
        <Gstr3bRowNote reason={caveat} variant="note" />
      </div>
      {groups.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          No no-GSTIN-supplier or nil-rated purchases in this period.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Supplier</TableHead>
              <TableHead>GSTIN</TableHead>
              <TableHead className="text-right">Taxable Amount</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map((group) => (
              <TableRow key={group.partyId || group.partyName}>
                <TableCell className="text-muted-foreground">{group.partyName}</TableCell>
                <TableCell className="text-muted-foreground">{group.partyGstin ?? "—"}</TableCell>
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
