import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Gstr3bRowNote, gstr3bFinancialCellClass } from "@/modules/gst/components/gstr3b-row-note";
import type { Gstr3bExemptInwardSupplies } from "@/types/gstr3b";

interface Gstr3bExemptInwardTableProps {
  exemptInwardSupplies: Gstr3bExemptInwardSupplies;
}

/**
 * Table 5 — Exempt, nil-rated, and non-GST inward supplies. Nil-rated/exempt
 * is computed and split Inter-State/Intra-State; Non-GST is always a
 * visible, not-computed row (59-gstr-3b.md Business Rules).
 */
export function Gstr3bExemptInwardTable({ exemptInwardSupplies }: Gstr3bExemptInwardTableProps) {
  const { intraState, interState, nonGst } = exemptInwardSupplies;
  const nilRatedComputed = intraState.computed && interState.computed;
  const nilRatedReason = interState.reason || intraState.reason;

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-foreground">Table 5 — Exempt, Nil-Rated, and Non-GST Inward Supplies</h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nature of Supplies</TableHead>
            <TableHead className="text-right">Inter-State Supplies</TableHead>
            <TableHead className="text-right">Intra-State Supplies</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow className={nilRatedComputed ? undefined : "bg-muted/30"}>
            <TableCell>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground">Composition scheme, exempt, and nil-rated supply</span>
                {!nilRatedComputed ? <Gstr3bRowNote reason={nilRatedReason} /> : null}
              </div>
            </TableCell>
            <TableCell className={gstr3bFinancialCellClass(nilRatedComputed)}>{interState.amount.toFixed(2)}</TableCell>
            <TableCell className={gstr3bFinancialCellClass(nilRatedComputed)}>{intraState.amount.toFixed(2)}</TableCell>
          </TableRow>
          <TableRow className="bg-muted/30">
            <TableCell>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground">Non-GST supply</span>
                <Gstr3bRowNote reason={nonGst.reason} />
              </div>
            </TableCell>
            <TableCell className={gstr3bFinancialCellClass(false)}>{nonGst.amount.toFixed(2)}</TableCell>
            <TableCell className={gstr3bFinancialCellClass(false)}>{nonGst.amount.toFixed(2)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
