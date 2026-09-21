import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { StockValuationReport } from "@/types/inventory-report";

interface StockValuationTableProps {
  report: StockValuationReport;
}

export function StockValuationTable({ report }: StockValuationTableProps) {
  if (report.rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">No stock found for the selected filters.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Product</TableHead>
          <TableHead className="text-right">Current Stock</TableHead>
          <TableHead className="text-right">Unit Cost</TableHead>
          <TableHead className="text-right">Total Value</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {report.rows.map((row) => (
          <TableRow key={row.productId}>
            <TableCell>
              <div className="font-medium text-foreground">{row.productName}</div>
              <div className="text-xs text-muted-foreground">{row.productCode ?? "—"}</div>
            </TableCell>
            <TableCell className="text-right font-financial">{row.quantity.toFixed(2)}</TableCell>
            <TableCell className="text-right font-financial">
              {row.isUnvalued ? (
                <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning">
                  Cost not set
                </Badge>
              ) : (
                row.unitCost.toFixed(2)
              )}
            </TableCell>
            <TableCell className="text-right font-financial font-medium">{row.value.toFixed(2)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={3} className="text-right font-medium">
            Total Value
          </TableCell>
          <TableCell className="text-right font-financial font-medium">{report.totalValue.toFixed(2)}</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}
