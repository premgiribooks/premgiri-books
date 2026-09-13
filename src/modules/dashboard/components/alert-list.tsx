import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AlertItem, DashboardWidget } from "@/types/dashboard";

interface AlertSection {
  label: string;
  widget: DashboardWidget<AlertItem[]>;
}

interface AlertListProps {
  sections: AlertSection[];
}

/** 85-dashboard.md's Alerts & Exceptions section — low stock, overdue
 * receivables, GST filing due, negative-stock risk. Unlike KpiTile, a
 * section with nothing to report is simply omitted (an "all clear" alert
 * section is not the same "no misleading zeroes" case as a KPI's zero
 * value — there is no invented figure here, just nothing needing attention),
 * with a single reassuring line only when every section is clear. A
 * `no-permission` section is always omitted. */
export function AlertList({ sections }: AlertListProps) {
  const visible = sections.filter((section) => section.widget.state === "ok");

  if (visible.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          No alerts — everything looks clear.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {visible.map((section) => {
        if (section.widget.state !== "ok") {
          return null;
        }
        return (
          <Card key={section.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-foreground">{section.label}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {section.widget.data.map((alert) => (
                <Link
                  key={alert.id}
                  href={alert.href}
                  className="rounded-lg border border-border px-3 py-2 text-sm text-foreground transition-colors hover:border-primary/50 hover:bg-muted/50"
                >
                  {alert.message}
                </Link>
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
