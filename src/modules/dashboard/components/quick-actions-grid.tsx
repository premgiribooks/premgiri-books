import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import type { QuickAction } from "@/types/dashboard";

interface QuickActionsGridProps {
  actions: QuickAction[];
}

/** 85-dashboard.md's Quick Actions grid — every entry is an existing
 * create-route the dashboard service has already permission-filtered
 * (create/approve, per the destination screen's own gate); this component
 * only lays them out. */
export function QuickActionsGrid({ actions }: QuickActionsGridProps) {
  if (actions.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {actions.map((action) => (
        <Link key={action.href} href={action.href}>
          <Card className="h-full transition-colors hover:border-primary/50">
            <CardContent className="flex h-full items-center justify-center px-3 py-4 text-center text-sm font-medium text-foreground">
              {action.label}
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
