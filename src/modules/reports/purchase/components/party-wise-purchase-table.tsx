import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { PartyWisePurchaseReport } from "@/types/purchase-report";

interface PartyWisePurchaseTableProps {
  report: PartyWisePurchaseReport;
}

export function PartyWisePurchaseTable({ report }: PartyWisePurchaseTableProps) {
  if (report.rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">No posted purchases found for the selected filters.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Supplier</TableHead>
          <TableHead className="text-right">Invoice Count</TableHead>
          <TableHead className="text-right">Taxable Value</TableHead>
          <TableHead className="text-right">Total Tax</TableHead>
          <TableHead className="text-right">Grand Total</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {report.rows.map((row) => (
          <TableRow key={row.supplierId}>
            <TableCell>{row.supplierName}</TableCell>
            <TableCell className="text-right font-financial">{row.invoiceCount}</TableCell>
            <TableCell className="text-right font-financial">{row.taxableAmount.toFixed(2)}</TableCell>
            <TableCell className="text-right font-financial">{row.totalTax.toFixed(2)}</TableCell>
            <TableCell className="text-right font-financial font-medium">{row.grandTotal.toFixed(2)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell className="text-right font-medium">Period Total</TableCell>
          <TableCell className="text-right font-financial font-medium">{report.totals.invoiceCount}</TableCell>
          <TableCell className="text-right font-financial font-medium">{report.totals.taxableAmount.toFixed(2)}</TableCell>
          <TableCell className="text-right font-financial font-medium">{report.totals.totalTax.toFixed(2)}</TableCell>
          <TableCell className="text-right font-financial font-medium">{report.totals.grandTotal.toFixed(2)}</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}
