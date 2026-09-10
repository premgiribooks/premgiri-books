interface PurchaseOrderFulfillmentProgressProps {
  receivedLineCount: number;
  totalLineCount: number;
}

/** The list screen's "3/5 lines received" indicator
 * (42-purchase-orders.md's UI) — a line counts as received once its
 * receivedQuantity reaches its quantity (see purchase-order-repository.ts's
 * toPurchaseOrderListRow). Presentational only. */
export function PurchaseOrderFulfillmentProgress({
  receivedLineCount,
  totalLineCount,
}: PurchaseOrderFulfillmentProgressProps) {
  if (totalLineCount === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <span className="font-financial text-xs text-muted-foreground">
      {receivedLineCount}/{totalLineCount} lines received
    </span>
  );
}
