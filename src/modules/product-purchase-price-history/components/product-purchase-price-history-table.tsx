import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatPurchasePriceHistoryDate } from "@/modules/product-purchase-price-history/utils/format-purchase-price-history-date";
import type { ProductPurchasePriceHistoryRow } from "@/types/product-purchase-price-history";

interface ProductPurchasePriceHistoryTableProps {
  rows: ProductPurchasePriceHistoryRow[];
}

function money(value: number | null): string {
  return value === null ? "—" : value.toFixed(2);
}

const SOURCE_DOCUMENT_LABEL: Record<ProductPurchasePriceHistoryRow["sourceDocumentType"], string> = {
  PURCHASE_INVOICE: "Purchase Invoice",
  PURCHASE_ORDER: "Purchase Order",
};

/**
 * 95-purchase-price-sync.md's Purchase Price History tab — plain read-only
 * Server Component (no create/update/delete affordance anywhere: history
 * rows are system-generated only). Mirrors product-batch-table.tsx's shape,
 * minus any action column.
 */
export function ProductPurchasePriceHistoryTable({ rows }: ProductPurchasePriceHistoryTableProps) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">No purchase price changes recorded yet.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Source Document</TableHead>
          <TableHead className="text-right">Old Cost</TableHead>
          <TableHead className="text-right">New Cost</TableHead>
          <TableHead>Changed By</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="text-muted-foreground">{formatPurchasePriceHistoryDate(row.createdAt)}</TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{SOURCE_DOCUMENT_LABEL[row.sourceDocumentType]}</Badge>
                <span className="text-foreground">{row.sourceDocumentNumber ?? "—"}</span>
              </div>
            </TableCell>
            <TableCell className="text-right font-financial text-muted-foreground">
              {money(row.oldPurchasePrice)}
            </TableCell>
            <TableCell className="text-right font-financial font-medium text-foreground">
              {money(row.newPurchasePrice)}
            </TableCell>
            <TableCell className="text-muted-foreground">{row.changedByUserName ?? "—"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
