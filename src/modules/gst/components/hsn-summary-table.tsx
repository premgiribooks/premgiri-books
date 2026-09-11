import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { GstRegisterTotals } from "@/types/gst-report";
import type { HsnSummaryRow } from "@/types/hsn-summary";

interface HsnSummaryTableProps {
  rows: HsnSummaryRow[];
  totals: GstRegisterTotals;
}

/**
 * GSTR-1 Table 12 (60-hsn-summary.md) — the single rendering of
 * hsnSummaryService.getHsnSummary's output, embedded unmodified by both
 * `/gst/hsn-summary` and 58-gstr-1.md's own Table 12 section (no
 * independent aggregation query in either caller).
 */
export function HsnSummaryTable({ rows, totals }: HsnSummaryTableProps) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">No HSN-wise outward supplies found for the selected period.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>HSN/SAC Code</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Description</TableHead>
          <TableHead className="text-right">Rate %</TableHead>
          <TableHead>UQC</TableHead>
          <TableHead className="text-right">Total Quantity</TableHead>
          <TableHead className="text-right">Taxable Value</TableHead>
          <TableHead className="text-right">CGST</TableHead>
          <TableHead className="text-right">SGST</TableHead>
          <TableHead className="text-right">IGST</TableHead>
          <TableHead className="text-right">CESS</TableHead>
          <TableHead className="text-right">Total Value</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, index) => (
          <TableRow key={`${row.hsnCode ?? "no-hsn"}-${row.ratePercent ?? "mixed"}-${index}`}>
            <TableCell className="font-medium text-foreground">
              {row.hsnCode ?? <span className="italic text-muted-foreground">No HSN Assigned</span>}
            </TableCell>
            <TableCell>{row.codeType ? <Badge variant="outline">{row.codeType}</Badge> : "—"}</TableCell>
            <TableCell className="text-muted-foreground">{row.description ?? "—"}</TableCell>
            <TableCell className="text-right font-financial">{row.ratePercent !== null ? row.ratePercent.toFixed(2) : "—"}</TableCell>
            <TableCell className="text-muted-foreground">{row.uqcCode ?? "—"}</TableCell>
            <TableCell className="text-right font-financial">
              <span className="inline-flex items-center gap-1.5">
                {row.quantity.toFixed(2)}
                {row.isMixedUnit ? (
                  <Badge variant="secondary" title="This group sums quantities from more than one unit of measure">
                    Mixed unit
                  </Badge>
                ) : null}
              </span>
            </TableCell>
            <TableCell className="text-right font-financial">{row.taxableAmount.toFixed(2)}</TableCell>
            <TableCell className="text-right font-financial">{row.cgst.toFixed(2)}</TableCell>
            <TableCell className="text-right font-financial">{row.sgst.toFixed(2)}</TableCell>
            <TableCell className="text-right font-financial">{row.igst.toFixed(2)}</TableCell>
            <TableCell className="text-right font-financial">{row.cess.toFixed(2)}</TableCell>
            <TableCell className="text-right font-financial font-medium">{row.totalAmount.toFixed(2)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={6} className="text-right font-medium">
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
