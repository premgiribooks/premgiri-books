import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardEmptyState } from "@/modules/dashboard/components/dashboard-empty-state";
import type { DashboardWidget, OutstandingData } from "@/types/dashboard";

interface OutstandingTileProps {
  title: string;
  href: string;
  widget: DashboardWidget<OutstandingData>;
}

/** Receivables/Payables — grand total + top-N by amount, per 85-dashboard.md's
 * deliberate "no aging" scope (this codebase's outstanding reports carry no
 * aging-bucket data). */
export function OutstandingTile({ title, href, widget }: OutstandingTileProps) {
  if (widget.state === "no-permission") {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {widget.state === "empty" || widget.state === "unavailable" ? (
          <DashboardEmptyState message={widget.message} />
        ) : (
          <>
            <Link href={href} className="text-right font-financial text-2xl font-semibold text-foreground hover:underline">
              {widget.data.total.toFixed(2)}
            </Link>
            <div className="flex flex-col gap-1">
              {widget.data.top.map((row) => (
                <div key={row.id} className="flex items-center justify-between text-xs text-muted-foreground">
                  {row.href ? (
                    <Link href={row.href} className="hover:underline">
                      {row.name}
                    </Link>
                  ) : (
                    <span>{row.name}</span>
                  )}
                  <span className="font-financial">{row.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
