import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { CurrentStockReport } from "@/types/inventory-report";

interface CurrentStockTableProps {
  report: CurrentStockReport;
}

export function CurrentStockTable({ report }: CurrentStockTableProps) {
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
          <TableHead>Warehouse</TableHead>
          <TableHead className="text-right">Current Stock</TableHead>
          <TableHead>Unit</TableHead>
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
            <TableCell className="text-right font-financial">{row.quantity.toFixed(2)}</TableCell>
            <TableCell>{row.unitName}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
