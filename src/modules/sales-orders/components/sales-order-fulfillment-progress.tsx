interface SalesOrderFulfillmentProgressProps {
  deliveredLineCount: number;
  totalLineCount: number;
}

/** The list screen's "3/5 lines delivered" indicator
 * (36-sales-orders.md's UI) — a line counts as delivered once its
 * deliveredQuantity reaches its quantity (see sales-order-repository.ts's
 * toSalesOrderListRow). Presentational only. */
export function SalesOrderFulfillmentProgress({
  deliveredLineCount,
  totalLineCount,
}: SalesOrderFulfillmentProgressProps) {
  if (totalLineCount === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <span className="font-financial text-xs text-muted-foreground">
      {deliveredLineCount}/{totalLineCount} lines delivered
    </span>
  );
}
