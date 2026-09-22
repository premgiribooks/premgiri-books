"use client";

import { InfiniteScrollSentinel } from "@/components/common/infinite-scroll-sentinel";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useInfiniteList } from "@/hooks/use-infinite-list";
import type { Page } from "@/lib/pagination";
import { AttendanceStatusBadge } from "@/modules/attendance/components/attendance-status-badge";
import type { ActionResult } from "@/types/api";
import type { AttendanceWithRelations } from "@/types/attendance";

interface AttendanceHistoryTableProps {
  records: AttendanceWithRelations[];
  initialHasMore?: boolean;
  loadMore?: (skip: number, take: number) => Promise<ActionResult<Page<AttendanceWithRelations>>>;
}

function toDisplayDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function AttendanceHistoryTable({
  records: initialRecords,
  initialHasMore = false,
  loadMore,
}: AttendanceHistoryTableProps) {
  const { items: records, hasMore, isLoading, sentinelRef } = useInfiniteList({
    initialItems: initialRecords,
    initialHasMore,
    loadMore,
  });
  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">No attendance records found.</p>
      </div>
    );
  }

  return (
    <>
      <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Code</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Remarks</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {records.map((record) => (
          <TableRow key={record.id}>
            <TableCell>{toDisplayDate(record.date)}</TableCell>
            <TableCell>{record.employee.employeeCode}</TableCell>
            <TableCell>
              <span className="font-medium text-foreground">{record.employee.fullName}</span>
            </TableCell>
            <TableCell>
              <AttendanceStatusBadge status={record.status} />
            </TableCell>
            <TableCell>
              {record.remarks ?? <span className="text-muted-foreground">—</span>}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
      </Table>
      <InfiniteScrollSentinel hasMore={hasMore} isLoading={isLoading} sentinelRef={sentinelRef} />
    </>
  );
}
