import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Gstr1NilRatedGroup } from "@/types/gstr1";

interface Gstr1NilRatedTableProps {
  groups: Gstr1NilRatedGroup[];
}

/** Table 8 — Nil-rated/Exempt outward supplies, consolidated by place of supply only (rate is always 0). */
export function Gstr1NilRatedTable({ groups }: Gstr1NilRatedTableProps) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-foreground">Table 8 — Nil-Rated / Exempt</h3>
      {groups.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          No nil-rated or exempt supplies for this period.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Place of Supply</TableHead>
              <TableHead className="text-right">Taxable Amount</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map((group) => (
              <TableRow key={group.placeOfSupplyStateCode}>
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
