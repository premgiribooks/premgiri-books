import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { OpeningStockListRow } from "@/types/opening-stock";

interface OpeningStockTableProps {
  entries: OpeningStockListRow[];
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Read-only list — no Edit/Delete action exists for a recorded Opening
 * Stock entry (46-opening-stock.md's Data Model: "no update or delete API"),
 * so the Actions column carries nothing but is kept for layout consistency
 * with every other list table in this codebase. */
export function OpeningStockTable({ entries }: OpeningStockTableProps) {
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">No opening stock entries found.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Product</TableHead>
          <TableHead>Warehouse</TableHead>
          <TableHead className="text-right">Quantity</TableHead>
          <TableHead className="text-right">Unit Cost</TableHead>
          <TableHead>Date</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <TableRow key={entry.id}>
            <TableCell className="font-medium text-foreground">
              {entry.productName} <span className="text-muted-foreground">({entry.productCode})</span>
            </TableCell>
            <TableCell>{entry.warehouseName}</TableCell>
            <TableCell className="text-right font-financial">
              {entry.quantity} {entry.unitSymbol}
            </TableCell>
            <TableCell className="text-right font-financial">{entry.unitCost !== null ? entry.unitCost.toFixed(2) : "—"}</TableCell>
            <TableCell className="font-financial">{formatDate(entry.transactionDate)}</TableCell>
            <TableCell className="text-right text-muted-foreground">—</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
