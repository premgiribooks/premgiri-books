import Link from "next/link";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DashboardEmptyState } from "@/modules/dashboard/components/dashboard-empty-state";
import type { DashboardWidget, TopPerformerRow } from "@/types/dashboard";

interface TopPerformersTableProps {
  title: string;
  valueLabel: string;
  widget: DashboardWidget<TopPerformerRow[]>;
}

/** 85-dashboard.md's Top Performers — one reusable table for Top Customers/
 * Products/Suppliers. A row with no `href` (e.g. Walk-in/Quick-customer
 * synthetic sales buckets, which have no detail page) renders unlinked
 * plain text, never a dead link. */
export function TopPerformersTable({ title, valueLabel, widget }: TopPerformersTableProps) {
  if (widget.state === "no-permission") {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {widget.state === "empty" || widget.state === "unavailable" ? (
        <DashboardEmptyState message={widget.message} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="text-right">{valueLabel}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {widget.data.map((row, index) => (
              <TableRow key={row.id ?? `${title}-${index}`}>
                <TableCell className="font-medium text-foreground">
                  {row.href ? (
                    <Link href={row.href} className="hover:underline">
                      {row.name}
                    </Link>
                  ) : (
                    row.name
                  )}
                </TableCell>
                <TableCell className="text-right font-financial">{row.value.toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
