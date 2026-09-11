import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Gstr3bRowNote } from "@/modules/gst/components/gstr3b-row-note";
import type { Gstr3bEligibleItc, Gstr3bItcRow } from "@/types/gstr3b";

interface Gstr3bEligibleItcTableProps {
  eligibleItc: Gstr3bEligibleItc;
}

interface RowSpec {
  code: string;
  label: string;
  row: Gstr3bItcRow;
}

function toRows(eligibleItc: Gstr3bEligibleItc): RowSpec[] {
  return [
    { code: "(A)(1)", label: "Import of goods", row: eligibleItc.importOfGoods },
    { code: "(A)(2)", label: "Import of services", row: eligibleItc.importOfServices },
    {
      code: "(A)(3)",
      label: "Inward supplies liable to reverse charge (other than (1) and (2) above)",
      row: eligibleItc.inwardReverseChargeItc,
    },
    { code: "(A)(4)", label: "Inward supplies from ISD", row: eligibleItc.isdCredit },
    { code: "(A)(5)", label: "All other ITC", row: eligibleItc.allOtherItc },
    { code: "(B)", label: "ITC Reversed", row: eligibleItc.itcReversed },
    { code: "(C)", label: "Net ITC Available (A) − (B)", row: eligibleItc.netItcAvailable },
    { code: "(D)", label: "Ineligible ITC", row: eligibleItc.ineligibleItc },
  ];
}

/**
 * Table 4 — Eligible ITC. No taxable-value column here — the statutory
 * form itself is tax-only for this table. (A)(5) is the only computed
 * sub-row; (C) reuses its figures with a "Note" badge (not "Not tracked" —
 * it IS computed, just carries a caveat about (B) being untracked).
 */
export function Gstr3bEligibleItcTable({ eligibleItc }: Gstr3bEligibleItcTableProps) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-foreground">Table 4 — Eligible ITC</h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Details</TableHead>
            <TableHead className="text-right">CGST</TableHead>
            <TableHead className="text-right">SGST</TableHead>
            <TableHead className="text-right">IGST</TableHead>
            <TableHead className="text-right">CESS</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {toRows(eligibleItc).map(({ code, label, row }) => (
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
