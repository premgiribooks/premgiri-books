import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { GstRegisterTotals } from "@/types/gst-report";
import type { ItcRegisterRateGroup } from "@/types/itc-register";

interface ItcRegisterRateSummaryTableProps {
  groups: ItcRegisterRateGroup[];
  totals: GstRegisterTotals;
}

/** Rate-wise summary (83-itc-register.md Business Rules) — grouped by `ratePercent` alone, no place-of-supply dimension. */
export function ItcRegisterRateSummaryTable({ groups, totals }: ItcRegisterRateSummaryTableProps) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-foreground">Rate-wise Summary</h3>
      {groups.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          No eligible inward ITC found for the selected period.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
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
            {groups.map((group) => (
              <TableRow key={group.ratePercent}>
                <TableCell className="text-right font-financial">{group.ratePercent.toFixed(2)}</TableCell>
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
