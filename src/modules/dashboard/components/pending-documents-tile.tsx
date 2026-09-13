import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardEmptyState } from "@/modules/dashboard/components/dashboard-empty-state";
import type { DashboardWidget, PendingDocumentsData } from "@/types/dashboard";

interface PendingDocumentsTileProps {
  widget: DashboardWidget<PendingDocumentsData>;
}

const ROWS: { key: keyof PendingDocumentsData; label: string; href: string }[] = [
  { key: "sales", label: "Sales Invoices", href: "/sales/invoices?status=DRAFT" },
  { key: "purchase", label: "Purchase Invoices", href: "/purchase/invoices?status=DRAFT" },
  { key: "inventory", label: "Stock Adjustments/Transfers", href: "/inventory/adjustments?status=DRAFT" },
];

/** 85-dashboard.md's "Pending Documents" (renamed from the spec's own
 * "Pending Approvals" — this codebase has no approval workflow or `SAVED`
 * status on any document; every status enum is DRAFT/POSTED/CANCELLED only,
 * see the dashboard service's own note). Counts DRAFT rows only, per
 * permitted source module. */
export function PendingDocumentsTile({ widget }: PendingDocumentsTileProps) {
  if (widget.state === "no-permission") {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-foreground">Pending Documents</CardTitle>
      </CardHeader>
      <CardContent>
        {widget.state === "empty" || widget.state === "unavailable" ? (
          <DashboardEmptyState message={widget.message} />
        ) : (
          <div className="flex flex-col gap-2">
            {ROWS.filter((row) => widget.data[row.key] > 0).map((row) => (
              <Link key={row.key} href={row.href} className="flex items-center justify-between text-sm hover:underline">
                <span className="text-foreground">{row.label}</span>
                <span className="font-financial text-muted-foreground">{widget.data[row.key]}</span>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
