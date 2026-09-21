import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { LowStockReport } from "@/types/inventory-report";

interface LowStockTableProps {
  report: LowStockReport;
}

export function LowStockTable({ report }: LowStockTableProps) {
  if (report.rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">No product is below its configured minimum stock level.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Product</TableHead>
          <TableHead>Warehouse</TableHead>
          <TableHead className="text-right">Current Stock</TableHead>
          <TableHead className="text-right">Minimum Stock Level</TableHead>
          <TableHead className="text-right">Shortfall</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {report.rows.map((row, index) => (
          <TableRow key={`${row.productId}-${row.warehouseId ?? "none"}-${index}`}>
            <TableCell>
              <div className="font-medium text-foreground">{row.productName}</div>
              <div className="text-xs text-muted-foreground">{row.productCode ?? "—"}</div>
            </TableCell>
            <TableCell>{row.warehouseName ?? "All Warehouses"}</TableCell>
            <TableCell className="text-right font-financial">{row.currentStock.toFixed(2)}</TableCell>
            <TableCell className="text-right font-financial">{row.minStockLevel.toFixed(2)}</TableCell>
            <TableCell className="text-right">
              <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive font-financial">
                {row.shortfall.toFixed(2)}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
