import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { DashboardEmptyState } from "@/modules/dashboard/components/dashboard-empty-state";
import type { DashboardWidget, RecentActivityItem } from "@/types/dashboard";

interface RecentActivityFeedProps {
  widget: DashboardWidget<RecentActivityItem[]>;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

/** 85-dashboard.md's Recent Activity — latest documents by `createdAt`,
 * explicitly labeled "Recent Documents" (never "Activity Log"/"Audit
 * Trail" — this is not AuditLog-backed, see the service's own note). */
export function RecentActivityFeed({ widget }: RecentActivityFeedProps) {
  if (widget.state === "no-permission") {
    return null;
  }

  if (widget.state === "empty" || widget.state === "unavailable") {
    return <DashboardEmptyState message={widget.message} />;
  }

  return (
    <Card>
      <CardContent className="flex flex-col divide-y divide-border py-0">
        {widget.data.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className="flex items-center justify-between gap-3 py-3 text-sm transition-colors hover:bg-muted/50"
          >
            <div className="flex flex-col">
              <span className="font-medium text-foreground">
                {item.label} {item.documentNumber}
              </span>
              {item.partyName ? <span className="text-xs text-muted-foreground">{item.partyName}</span> : null}
            </div>
            <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(item.createdAt)}</span>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
