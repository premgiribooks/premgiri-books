import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getGstStateName } from "@/engines/gst/state-codes";
import { Gstr3bRowNote } from "@/modules/gst/components/gstr3b-row-note";
import type { Gstr3bInterStateSupplies } from "@/types/gstr3b";

interface Gstr3bInterStateSuppliesTableProps {
  interStateSupplies: Gstr3bInterStateSupplies;
}

/**
 * Table 3.2 — Inter-state supplies to unregistered persons, composition
 * taxpayers, and UIN holders. Only the unregistered-recipient sub-row is
 * computed (59-gstr-3b.md Business Rules) — composition/UIN rows always
 * render as visible, not-computed entries.
 */
export function Gstr3bInterStateSuppliesTable({ interStateSupplies }: Gstr3bInterStateSuppliesTableProps) {
  const { unregisteredRecipients, compositionTaxpayers, uinHolders } = interStateSupplies;

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-foreground">
        Table 3.2 — Inter-State Supplies to Unregistered Persons, Composition Taxpayers, and UIN Holders
      </h3>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-muted-foreground">Supplies to Unregistered Persons</p>
        {unregisteredRecipients.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            No inter-state supplies to unregistered persons for this period.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Place of Supply</TableHead>
                <TableHead className="text-right">Taxable Amount</TableHead>
                <TableHead className="text-right">IGST</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {unregisteredRecipients.map((group) => (
                <TableRow key={group.placeOfSupplyStateCode}>
                  <TableCell className="text-muted-foreground">
                    {getGstStateName(group.placeOfSupplyStateCode) ?? group.placeOfSupplyStateCode}
                  </TableCell>
                  <TableCell className="text-right font-financial">{group.taxableAmount.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-financial font-medium">{group.igst.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-3">
        <span className="text-sm text-muted-foreground">Supplies to Composition Taxpayers</span>
        <Gstr3bRowNote reason={compositionTaxpayers.reason} />
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-3">
        <span className="text-sm text-muted-foreground">Supplies to UIN Holders</span>
        <Gstr3bRowNote reason={uinHolders.reason} />
      </div>
    </div>
  );
}
