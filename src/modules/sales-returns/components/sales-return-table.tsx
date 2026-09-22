"use client";

import Link from "next/link";

import { InfiniteScrollSentinel } from "@/components/common/infinite-scroll-sentinel";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useInfiniteList } from "@/hooks/use-infinite-list";
import type { Page } from "@/lib/pagination";
import { SalesReturnStatusBadge } from "@/modules/sales-returns/components/sales-return-status-badge";
import { formatSalesReturnDate } from "@/modules/sales-returns/utils/format-sales-return-date";
import type { ActionResult } from "@/types/api";
import type { SalesReturnListRow } from "@/types/sales-return";

interface SalesReturnTableProps {
  salesReturns: SalesReturnListRow[];
  initialHasMore?: boolean;
  loadMore?: (skip: number, take: number) => Promise<ActionResult<Page<SalesReturnListRow>>>;
}

export function SalesReturnTable({
  salesReturns: initialSalesReturns,
  initialHasMore = false,
  loadMore,
}: SalesReturnTableProps) {
  const { items: salesReturns, hasMore, isLoading, sentinelRef } = useInfiniteList({
    initialItems: initialSalesReturns,
    initialHasMore,
    loadMore,
  });

  if (salesReturns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">No sales returns found.</p>
      </div>
    );
  }

  return (
    <>
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Number</TableHead>
          <TableHead>Invoice Number</TableHead>
          <TableHead>Customer</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Grand Total</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {salesReturns.map((salesReturn) => (
          <TableRow key={salesReturn.id}>
            <TableCell>
              <Link href={`/sales/returns/${salesReturn.id}`} className="font-medium text-foreground hover:underline">
                {salesReturn.returnNumber ?? "Draft"}
              </Link>
            </TableCell>
            <TableCell>{salesReturn.salesInvoice.invoiceNumber}</TableCell>
            <TableCell>{salesReturn.salesInvoice.customerName ?? "—"}</TableCell>
            <TableCell className="font-financial">{formatSalesReturnDate(salesReturn.returnDate)}</TableCell>
            <TableCell>
              <SalesReturnStatusBadge status={salesReturn.status} />
            </TableCell>
            <TableCell className="text-right font-financial">{salesReturn.grandTotal.toFixed(2)}</TableCell>
            <TableCell className="text-right">
              <Link href={`/sales/returns/${salesReturn.id}`} className="text-sm text-primary hover:underline">
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
