"use client";

import Link from "next/link";

import { InfiniteScrollSentinel } from "@/components/common/infinite-scroll-sentinel";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useInfiniteList } from "@/hooks/use-infinite-list";
import type { Page } from "@/lib/pagination";
import { PayrollRunStatusBadge } from "@/modules/payroll/components/payroll-run-status-badge";
import { formatPayrollRunDate } from "@/modules/payroll/utils/format-payroll-run-date";
import type { ActionResult } from "@/types/api";
import type { PayrollRunListRow } from "@/types/payroll-run";

interface PayrollRunTableProps {
  payrollRuns: PayrollRunListRow[];
  initialHasMore?: boolean;
  loadMore?: (skip: number, take: number) => Promise<ActionResult<Page<PayrollRunListRow>>>;
}

export function PayrollRunTable({
  payrollRuns: initialPayrollRuns,
  initialHasMore = false,
  loadMore,
}: PayrollRunTableProps) {
  const { items: payrollRuns, hasMore, isLoading, sentinelRef } = useInfiniteList({
    initialItems: initialPayrollRuns,
    initialHasMore,
    loadMore,
  });

  if (payrollRuns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">No payroll runs found.</p>
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Number</TableHead>
            <TableHead>Period</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Total Net Salary</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payrollRuns.map((run) => (
            <TableRow key={run.id}>
              <TableCell>
                <Link href={`/employees/payroll/${run.id}`} className="font-medium text-foreground hover:underline">
                  {run.payrollNumber ?? "—"}
                </Link>
              </TableCell>
              <TableCell className="font-financial">
                {formatPayrollRunDate(run.periodStart)} – {formatPayrollRunDate(run.periodEnd)}
              </TableCell>
              <TableCell>
                <PayrollRunStatusBadge status={run.status} />
              </TableCell>
              <TableCell className="text-right font-financial">{run.totalNetSalary.toFixed(2)}</TableCell>
              <TableCell className="text-right">
                <Link href={`/employees/payroll/${run.id}`} className="text-sm text-primary hover:underline">
                  View
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <InfiniteScrollSentinel hasMore={hasMore} isLoading={isLoading} sentinelRef={sentinelRef} />
    </>
  );
}
