import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { GstRegisterTotals } from "@/types/gst-report";
import type { ItcRegisterHsnGroup } from "@/types/itc-register";

interface ItcRegisterHsnSummaryTableProps {
  groups: ItcRegisterHsnGroup[];
  totals: GstRegisterTotals;
}

/**
 * HSN-wise summary (83-itc-register.md Business Rules) — grouped by
 * `hsnCode` alone (no rate dimension, unlike `60-hsn-summary.md`'s own
 * outward-side (hsnCode, ratePercent) grouping). A rate/HSN breakdown scoped
 * specifically to eligible ITC, not a reuse of `HsnSummaryTable` — that
 * component's shape (codeType, description, UQC, quantity) reflects
 * GSTR-1 Table 12's inventory-style reporting, which has no meaning for an
 * inward tax-credit report.
 */
export function ItcRegisterHsnSummaryTable({ groups, totals }: ItcRegisterHsnSummaryTableProps) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-foreground">HSN-wise Summary</h3>
      {groups.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          No eligible inward ITC found for the selected period.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>HSN Code</TableHead>
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
              <TableRow key={group.hsnCode ?? "no-hsn"}>
                <TableCell className="font-medium text-foreground">
                  {group.hsnCode ?? <span className="italic text-muted-foreground">No HSN Assigned</span>}
                </TableCell>
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
