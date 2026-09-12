import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { GstDashboardTotals } from "@/types/gst-dashboard";

interface GstSummaryTilesProps {
  totals: GstDashboardTotals;
}

/** 74-gst-reports.md's summary tiles — total Output/Input/Net Liability for the whole selected range, copied straight from the dashboard's own per-month totals (no independent recomputation). */
export function GstSummaryTiles({ totals }: GstSummaryTilesProps) {
  const tiles = [
    { label: "Total Output Tax", value: totals.outputTax },
    { label: "Total Input Tax", value: totals.inputTax },
    { label: "Net Liability", value: totals.netLiability },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {tiles.map((tile) => (
        <Card key={tile.label}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{tile.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-financial font-semibold ${tile.value < 0 ? "text-error" : "text-foreground"}`}>
              {tile.value.toFixed(2)}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
