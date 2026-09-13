import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardEmptyState } from "@/modules/dashboard/components/dashboard-empty-state";
import type { DashboardWidget } from "@/types/dashboard";

interface KpiTileProps {
  title: string;
  href: string;
  widget: DashboardWidget<{ today?: number; monthToDate?: number; balance?: number; total?: number; netProfit?: number }>;
  /** Which field of the widget's data to render as the tile's primary figure. */
  primaryField: "today" | "monthToDate" | "balance" | "total" | "netProfit";
  primaryLabel: string;
  secondary?: { field: "monthToDate"; label: string };
}

/** 85-dashboard.md's KPI row tile — tabular-numeric, right-aligned monetary
 * value per ui-context.md's Typography rule, negative figures in `text-error`
 * (mirrors gst-summary-tiles.tsx's own convention). Every tile is a link to
 * its source report (Drill-down rule) — `no-permission` widgets are never
 * passed to this component at all (the page filters them out before render). */
export function KpiTile({ title, href, widget, primaryField, primaryLabel, secondary }: KpiTileProps) {
  if (widget.state === "no-permission") {
    return null;
  }

  return (
    <Link href={href} className="block">
      <Card className="transition-colors hover:border-primary/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          {widget.state === "empty" || widget.state === "unavailable" ? (
            <DashboardEmptyState message={widget.message} />
          ) : (
            <div className="flex flex-col gap-1">
              <p className="text-right font-financial text-2xl font-semibold text-foreground">
                {(widget.data[primaryField] ?? 0).toFixed(2)}
              </p>
              <p className="text-right text-xs text-muted-foreground">{primaryLabel}</p>
              {secondary ? (
                <p className="text-right font-financial text-sm text-muted-foreground">
                  {secondary.label}: {(widget.data[secondary.field] ?? 0).toFixed(2)}
                </p>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
