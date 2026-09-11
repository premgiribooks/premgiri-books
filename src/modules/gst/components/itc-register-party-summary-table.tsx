import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { GstRegisterTotals } from "@/types/gst-report";
import type { ItcRegisterPartyGroup } from "@/types/itc-register";

interface ItcRegisterPartySummaryTableProps {
  groups: ItcRegisterPartyGroup[];
  totals: GstRegisterTotals;
}

/**
 * Party-wise (supplier-wise) summary (83-itc-register.md Business Rules) —
 * grouped by `partyId`, sorted by total ITC descending so the largest
 * sources of credit surface first. A new component (no existing sibling
 * groups by party alone) — `Gstr2PartyConsolidatedTable` is the closest
 * precedent but only carries Taxable Amount/Total, not the full CGST/SGST/
 * IGST/CESS breakup this spec requires.
 */
export function ItcRegisterPartySummaryTable({ groups, totals }: ItcRegisterPartySummaryTableProps) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-foreground">Party-wise (Supplier-wise) Summary</h3>
      {groups.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          No eligible inward ITC found for the selected period.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Supplier</TableHead>
              <TableHead className="text-right">Taxable Amount</TableHead>
              <TableHead className="text-right">CGST</TableHead>
              <TableHead className="text-right">SGST</TableHead>
              <TableHead className="text-right">IGST</TableHead>
              <TableHead className="text-right">CESS</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map((group) => (
              <TableRow key={group.partyId ?? group.partyName}>
                <TableCell className="text-muted-foreground">{group.partyName}</TableCell>
                <TableCell className="text-right font-financial">{group.taxableAmount.toFixed(2)}</TableCell>
                <TableCell className="text-right font-financial">{group.cgst.toFixed(2)}</TableCell>
                <TableCell className="text-right font-financial">{group.sgst.toFixed(2)}</TableCell>
                <TableCell className="text-right font-financial">{group.igst.toFixed(2)}</TableCell>
                <TableCell className="text-right font-financial">{group.cess.toFixed(2)}</TableCell>
                <TableCell className="text-right font-financial font-medium">{group.totalAmount.toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell className="text-right font-medium">Grand Total</TableCell>
              <TableCell className="text-right font-financial font-medium">{totals.taxableAmount.toFixed(2)}</TableCell>
              <TableCell className="text-right font-financial font-medium">{totals.cgst.toFixed(2)}</TableCell>
              <TableCell className="text-right font-financial font-medium">{totals.sgst.toFixed(2)}</TableCell>
              <TableCell className="text-right font-financial font-medium">{totals.igst.toFixed(2)}</TableCell>
              <TableCell className="text-right font-financial font-medium">{totals.cess.toFixed(2)}</TableCell>
              <TableCell className="text-right font-financial font-medium">{totals.totalAmount.toFixed(2)}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      )}
    </div>
  );
}
