import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DashboardEmptyState } from "@/modules/dashboard/components/dashboard-empty-state";
import type { MonthBucket } from "@/engines/reporting/dashboard-summary";
import type { DashboardWidget } from "@/types/dashboard";

interface SalesPurchaseTrendTableProps {
  sales: DashboardWidget<MonthBucket[]>;
  purchase: DashboardWidget<MonthBucket[]>;
}

function formatMonthLabel(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber - 1, 1)).toLocaleDateString("en-IN", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * 85-dashboard.md's Monthly Sales/Purchase trend — a proportional-bar
 * `<table>`, not a chart: this codebase depends on no charting library
 * (verified — `gst-trend-table.tsx`, spec 74's own "Trend Chart", is itself
 * this same pattern, not a real chart), and the spec's own Do Not forbids
 * adding one. Named `-table`, matching what it actually is.
 *
 * A `no-permission` series is dropped from the table entirely (its whole
 * column is omitted) rather than defaulting its months to 0 — a fabricated
 * zero for a module the caller cannot view would violate this feature's own
 * "no misleading zeroes" / "omitted entirely, never rendered" rules just as
 * much as an `empty`/`unavailable` series would if silently treated as data.
 */
export function SalesPurchaseTrendTable({ sales, purchase }: SalesPurchaseTrendTableProps) {
  const showSales = sales.state !== "no-permission";
  const showPurchase = purchase.state !== "no-permission";

  if (!showSales && !showPurchase) {
    return null;
  }

  const salesMonths = sales.state === "ok" ? sales.data : [];
  const purchaseMonths = purchase.state === "ok" ? purchase.data : [];
  const allMonths = [...new Set([...salesMonths.map((m) => m.month), ...purchaseMonths.map((m) => m.month)])].sort();

  if (allMonths.length === 0) {
    const message =
      sales.state === "empty" || sales.state === "unavailable"
        ? sales.message
        : purchase.state === "empty" || purchase.state === "unavailable"
          ? purchase.message
          : "No sales or purchases recorded yet this financial year.";
    return <DashboardEmptyState message={message} />;
  }

  const salesByMonth = new Map(salesMonths.map((m) => [m.month, m.total]));
  const purchaseByMonth = new Map(purchaseMonths.map((m) => [m.month, m.total]));
  const maxAbs = Math.max(
    1,
    ...allMonths.map((month) => Math.max(showSales ? (salesByMonth.get(month) ?? 0) : 0, showPurchase ? (purchaseByMonth.get(month) ?? 0) : 0))
  );

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Month</TableHead>
          {showSales ? <TableHead className="text-right">Sales</TableHead> : null}
          {showPurchase ? <TableHead className="text-right">Purchase</TableHead> : null}
          <TableHead>Trend</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {allMonths.map((month) => {
          const salesTotal = salesByMonth.get(month) ?? 0;
          const purchaseTotal = purchaseByMonth.get(month) ?? 0;
          return (
            <TableRow key={month}>
              <TableCell className="font-medium text-foreground">{formatMonthLabel(month)}</TableCell>
              {showSales ? <TableCell className="text-right font-financial">{salesTotal.toFixed(2)}</TableCell> : null}
              {showPurchase ? <TableCell className="text-right font-financial">{purchaseTotal.toFixed(2)}</TableCell> : null}
              <TableCell>
                <div className="flex w-32 flex-col gap-1">
                  {showSales ? (
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${(salesTotal / maxAbs) * 100}%` }} />
                    </div>
                  ) : null}
                  {showPurchase ? (
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-secondary-foreground/50"
                        style={{ width: `${(purchaseTotal / maxAbs) * 100}%` }}
                      />
                    </div>
                  ) : null}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
