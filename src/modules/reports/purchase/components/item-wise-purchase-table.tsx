import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ItemWisePurchaseReport } from "@/types/purchase-report";

interface ItemWisePurchaseTableProps {
  report: ItemWisePurchaseReport;
}

export function ItemWisePurchaseTable({ report }: ItemWisePurchaseTableProps) {
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
          <TableHead>Product</TableHead>
          <TableHead className="text-right">Quantity Purchased</TableHead>
          <TableHead className="text-right">Taxable Value</TableHead>
          <TableHead className="text-right">Total Tax</TableHead>
          <TableHead className="text-right">Total Value</TableHead>
          <TableHead className="text-right">Invoice Count</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {report.rows.map((row) => (
          <TableRow key={row.productId}>
            <TableCell>
              <div className="font-medium text-foreground">{row.productName}</div>
              <div className="text-xs text-muted-foreground">{row.productCode}</div>
            </TableCell>
            <TableCell className="text-right font-financial">{row.quantity.toFixed(2)}</TableCell>
            <TableCell className="text-right font-financial">{row.taxableAmount.toFixed(2)}</TableCell>
            <TableCell className="text-right font-financial">{row.totalTax.toFixed(2)}</TableCell>
            <TableCell className="text-right font-financial font-medium">{row.totalValue.toFixed(2)}</TableCell>
            <TableCell className="text-right font-financial">{row.invoiceCount}</TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell className="text-right font-medium">Period Total</TableCell>
          <TableCell className="text-right font-financial font-medium">{report.totals.quantity.toFixed(2)}</TableCell>
          <TableCell className="text-right font-financial font-medium">{report.totals.taxableAmount.toFixed(2)}</TableCell>
          <TableCell className="text-right font-financial font-medium">{report.totals.totalTax.toFixed(2)}</TableCell>
          <TableCell className="text-right font-financial font-medium">{report.totals.totalValue.toFixed(2)}</TableCell>
          <TableCell />
        </TableRow>
      </TableFooter>
    </Table>
  );
}
