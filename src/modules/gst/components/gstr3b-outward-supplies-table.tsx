import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Gstr3bRowNote } from "@/modules/gst/components/gstr3b-row-note";
import type { Gstr3bOutwardSupplies, Gstr3bTaxRow } from "@/types/gstr3b";

interface Gstr3bOutwardSuppliesTableProps {
  outwardSupplies: Gstr3bOutwardSupplies;
}

interface RowSpec {
  code: string;
  label: string;
  row: Gstr3bTaxRow;
}

function toRows(outwardSupplies: Gstr3bOutwardSupplies): RowSpec[] {
  return [
    {
      code: "(a)",
      label: "Outward taxable supplies (other than zero rated, nil rated, exempt)",
      row: outwardSupplies.taxableOutwardSupplies,
    },
    { code: "(b)", label: "Outward taxable supplies (zero rated)", row: outwardSupplies.zeroRatedOutwardSupplies },
    { code: "(c)", label: "Other outward supplies (nil rated, exempt)", row: outwardSupplies.nilRatedExemptOutwardSupplies },
    { code: "(d)", label: "Inward supplies liable to reverse charge", row: outwardSupplies.inwardReverseChargeSupplies },
    { code: "(e)", label: "Non-GST outward supplies", row: outwardSupplies.nonGstOutwardSupplies },
  ];
}

/**
 * Table 3.1 — Outward supplies and inward supplies liable to reverse
 * charge. Every statutory row renders regardless of `computed` — a
 * not-computed row shows a muted figure plus a "Not tracked" badge naming
 * its reason, never silently blank or indistinguishable from a genuine ₹0
 * (59-gstr-3b.md's UI section).
 */
export function Gstr3bOutwardSuppliesTable({ outwardSupplies }: Gstr3bOutwardSuppliesTableProps) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-foreground">
        Table 3.1 — Outward Supplies and Inward Supplies Liable to Reverse Charge
      </h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nature of Supplies</TableHead>
            <TableHead className="text-right">Taxable Amount</TableHead>
            <TableHead className="text-right">CGST</TableHead>
            <TableHead className="text-right">SGST</TableHead>
            <TableHead className="text-right">IGST</TableHead>
            <TableHead className="text-right">CESS</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {toRows(outwardSupplies).map(({ code, label, row }) => (
            <TableRow key={code} className={row.computed ? undefined : "bg-muted/30"}>
              <TableCell>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-muted-foreground">
                    <span className="font-medium text-foreground">{code}</span> {label}
                  </span>
                  <Gstr3bRowNote reason={row.reason} variant={row.computed ? "note" : "not-tracked"} />
                </div>
              </TableCell>
              <TableCell className={row.computed ? "text-right font-financial" : "text-right font-financial text-muted-foreground"}>
                {row.taxableAmount.toFixed(2)}
              </TableCell>
              <TableCell className={row.computed ? "text-right font-financial" : "text-right font-financial text-muted-foreground"}>
                {row.cgst.toFixed(2)}
              </TableCell>
              <TableCell className={row.computed ? "text-right font-financial" : "text-right font-financial text-muted-foreground"}>
                {row.sgst.toFixed(2)}
              </TableCell>
              <TableCell className={row.computed ? "text-right font-financial" : "text-right font-financial text-muted-foreground"}>
                {row.igst.toFixed(2)}
              </TableCell>
              <TableCell className={row.computed ? "text-right font-financial" : "text-right font-financial text-muted-foreground"}>
                {row.cess.toFixed(2)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
