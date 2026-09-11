import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Gstr1ConsolidatedGroup } from "@/types/gstr1";

interface Gstr1ConsolidatedTableProps {
  title: string;
  groups: Gstr1ConsolidatedGroup[];
  emptyMessage: string;
}

/** Consolidated by (place of supply, rate) — shared rendering for Table 7
 * (B2C Small) and Table 9B/9C's unregistered rows (58-gstr-1.md). */
export function Gstr1ConsolidatedTable({ title, groups, emptyMessage }: Gstr1ConsolidatedTableProps) {
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
              <TableHead>Place of Supply</TableHead>
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
              <TableRow key={`${group.placeOfSupplyStateCode}-${group.ratePercent}`}>
                <TableCell className="text-muted-foreground">{group.placeOfSupplyStateCode}</TableCell>
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
        </Table>
      )}
    </div>
  );
}
