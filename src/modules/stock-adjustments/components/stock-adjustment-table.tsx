import Link from "next/link";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StockAdjustmentStatusBadge } from "@/modules/stock-adjustments/components/stock-adjustment-status-badge";
import { formatStockAdjustmentDate } from "@/modules/stock-adjustments/utils/format-stock-adjustment-date";
import type { StockAdjustmentListRow } from "@/types/stock-adjustment";

interface StockAdjustmentTableProps {
  stockAdjustments: StockAdjustmentListRow[];
}

export function StockAdjustmentTable({ stockAdjustments }: StockAdjustmentTableProps) {
  if (stockAdjustments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">No stock adjustments found.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Number</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Reason</TableHead>
          <TableHead className="text-right">Lines</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {stockAdjustments.map((adjustment) => (
          <TableRow key={adjustment.id}>
            <TableCell>
              <Link href={`/inventory/adjustments/${adjustment.id}`} className="font-medium text-foreground hover:underline">
                {adjustment.adjustmentNumber ?? "Draft"}
              </Link>
            </TableCell>
            <TableCell className="font-financial">{formatStockAdjustmentDate(adjustment.adjustmentDate)}</TableCell>
            <TableCell className="max-w-xs truncate text-muted-foreground">{adjustment.reason}</TableCell>
            <TableCell className="text-right font-financial">{adjustment.lineCount}</TableCell>
            <TableCell>
              <StockAdjustmentStatusBadge status={adjustment.status} />
            </TableCell>
            <TableCell className="text-right">
              <Link href={`/inventory/adjustments/${adjustment.id}`} className="text-sm text-primary hover:underline">
                View
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
