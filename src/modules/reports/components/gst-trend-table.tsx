import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { GstDashboardMonthRow, GstDashboardTotals } from "@/types/gst-dashboard";

interface GstTrendTableProps {
  months: GstDashboardMonthRow[];
  totals: GstDashboardTotals;
}

function formatMonthLabel(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber - 1, 1)).toLocaleDateString("en-IN", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatFilingPeriod(row: GstDashboardMonthRow): string | null {
  if (!row.periodStart || !row.periodEnd) {
    return null;
  }
  const format = (date: Date) => date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "UTC" });
  return `${format(row.periodStart)} – ${format(row.periodEnd)}`;
}

/** Combined month-bucketed trend + per-month Filed/Open status strip
 * (74-gst-reports.md's UI section) — one row per month rather than two
 * separate widgets, since every figure a "status strip" would show is
 * already keyed by the same month this table already renders. A relative
 * bar (width proportional to the range's largest absolute figure) stands in
 * for a full charting library, none of which this codebase depends on yet. */
export function GstTrendTable({ months, totals }: GstTrendTableProps) {
  if (months.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">No outward or inward supplies found for the selected period.</p>
      </div>
    );
  }

  const maxAbs = Math.max(1, ...months.flatMap((month) => [Math.abs(month.outputTax), Math.abs(month.inputTax)]));

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Month</TableHead>
          <TableHead className="text-right">Output Tax</TableHead>
          <TableHead className="text-right">Input Tax</TableHead>
          <TableHead className="text-right">Net Liability</TableHead>
          <TableHead>Trend</TableHead>
          <TableHead>Filing Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {months.map((month) => (
          <TableRow key={month.month}>
            <TableCell className="font-medium text-foreground">{formatMonthLabel(month.month)}</TableCell>
            <TableCell className="text-right font-financial">{month.outputTax.toFixed(2)}</TableCell>
            <TableCell className="text-right font-financial">{month.inputTax.toFixed(2)}</TableCell>
            <TableCell className={`text-right font-financial ${month.netLiability < 0 ? "text-error" : ""}`}>
              {month.netLiability.toFixed(2)}
            </TableCell>
            <TableCell>
              <div className="flex w-32 flex-col gap-1">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${(Math.abs(month.outputTax) / maxAbs) * 100}%` }}
                  />
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-secondary-foreground/50"
                    style={{ width: `${(Math.abs(month.inputTax) / maxAbs) * 100}%` }}
                  />
                </div>
              </div>
            </TableCell>
            <TableCell>
              <div className="flex flex-col gap-1">
                <Badge variant={month.status === "FILED" ? "default" : month.status === "OPEN" ? "secondary" : "outline"}>
                  {month.status === "FILED" ? "Filed" : month.status === "OPEN" ? "Open" : "Not tracked"}
                </Badge>
                {formatFilingPeriod(month) ? (
                  <span className="text-xs text-muted-foreground">{formatFilingPeriod(month)}</span>
                ) : null}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell className="text-right font-medium">Period Total</TableCell>
          <TableCell className="text-right font-financial font-medium">{totals.outputTax.toFixed(2)}</TableCell>
          <TableCell className="text-right font-financial font-medium">{totals.inputTax.toFixed(2)}</TableCell>
          <TableCell className={`text-right font-financial font-medium ${totals.netLiability < 0 ? "text-error" : ""}`}>
            {totals.netLiability.toFixed(2)}
          </TableCell>
          <TableCell />
          <TableCell />
        </TableRow>
      </TableFooter>
    </Table>
  );
}
