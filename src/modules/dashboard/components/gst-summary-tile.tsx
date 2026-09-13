import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardEmptyState } from "@/modules/dashboard/components/dashboard-empty-state";
import type { DashboardWidget, GstSummaryData } from "@/types/dashboard";

interface GstSummaryTileProps {
  widget: DashboardWidget<GstSummaryData>;
}

/** Compact embed of 74-gst-reports.md's own dashboard output for the current
 * period — zero new GST aggregation, only current-period totals + the
 * latest bucketed month's Filed/Open badge. */
export function GstSummaryTile({ widget }: GstSummaryTileProps) {
  if (widget.state === "no-permission") {
    return null;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">GST Summary</CardTitle>
        {widget.state === "ok" && widget.data.latestMonthStatus ? (
          <Badge variant={widget.data.latestMonthStatus === "FILED" ? "default" : "secondary"}>
            {widget.data.latestMonthStatus === "FILED" ? "Filed" : "Open"}
          </Badge>
        ) : null}
      </CardHeader>
      <CardContent>
        {widget.state === "empty" || widget.state === "unavailable" ? (
          <DashboardEmptyState message={widget.message} />
        ) : (
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="font-financial text-lg font-semibold text-foreground">{widget.data.outputTax.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">Output Tax</p>
            </div>
            <div>
              <p className="font-financial text-lg font-semibold text-foreground">{widget.data.inputTax.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">Input Tax</p>
            </div>
            <div>
              <p className={`font-financial text-lg font-semibold ${widget.data.netLiability < 0 ? "text-error" : "text-foreground"}`}>
                {widget.data.netLiability.toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">Net Liability</p>
            </div>
          </div>
        )}
        <div className="mt-3 flex justify-end">
          <Link href="/reports/gst" className="text-xs text-muted-foreground hover:underline">
            View GST Reports →
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
