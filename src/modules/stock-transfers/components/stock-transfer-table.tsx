"use client";

import Link from "next/link";

import { InfiniteScrollSentinel } from "@/components/common/infinite-scroll-sentinel";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useInfiniteList } from "@/hooks/use-infinite-list";
import type { Page } from "@/lib/pagination";
import { StockTransferStatusBadge } from "@/modules/stock-transfers/components/stock-transfer-status-badge";
import { formatStockTransferDate } from "@/modules/stock-transfers/utils/format-stock-transfer-date";
import type { ActionResult } from "@/types/api";
import type { StockTransferListRow } from "@/types/stock-transfer";

interface StockTransferTableProps {
  stockTransfers: StockTransferListRow[];
  initialHasMore?: boolean;
  loadMore?: (skip: number, take: number) => Promise<ActionResult<Page<StockTransferListRow>>>;
}

export function StockTransferTable({
  stockTransfers: initialStockTransfers,
  initialHasMore = false,
  loadMore,
}: StockTransferTableProps) {
  const { items: stockTransfers, hasMore, isLoading, sentinelRef } = useInfiniteList({
    initialItems: initialStockTransfers,
    initialHasMore,
    loadMore,
  });

  if (stockTransfers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">No stock transfers found.</p>
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Number</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Destination</TableHead>
            <TableHead className="text-right">Lines</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stockTransfers.map((transfer) => (
            <TableRow key={transfer.id}>
              <TableCell>
                <Link href={`/inventory/transfers/${transfer.id}`} className="font-medium text-foreground hover:underline">
                  {transfer.transferNumber ?? "Draft"}
                </Link>
              </TableCell>
              <TableCell className="font-financial">{formatStockTransferDate(transfer.transferDate)}</TableCell>
              <TableCell className="text-muted-foreground">{transfer.sourceWarehouseName}</TableCell>
              <TableCell className="text-muted-foreground">{transfer.destinationWarehouseName}</TableCell>
              <TableCell className="text-right font-financial">{transfer.lineCount}</TableCell>
              <TableCell>
                <StockTransferStatusBadge status={transfer.status} />
              </TableCell>
              <TableCell className="text-right">
                <Link href={`/inventory/transfers/${transfer.id}`} className="text-sm text-primary hover:underline">
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
