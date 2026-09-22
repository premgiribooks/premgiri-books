"use client";

import Link from "next/link";

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
import { GoodsReceiptNoteStatusBadge } from "@/modules/goods-receipt-notes/components/goods-receipt-note-status-badge";
import { formatGoodsReceiptNoteDate } from "@/modules/goods-receipt-notes/utils/format-goods-receipt-note-date";
import type { ActionResult } from "@/types/api";
import type { GoodsReceiptNoteListRow } from "@/types/goods-receipt-note";

interface GoodsReceiptNoteTableProps {
  goodsReceiptNotes: GoodsReceiptNoteListRow[];
  initialHasMore?: boolean;
  loadMore?: (skip: number, take: number) => Promise<ActionResult<Page<GoodsReceiptNoteListRow>>>;
}

export function GoodsReceiptNoteTable({
  goodsReceiptNotes: initialGoodsReceiptNotes,
  initialHasMore = false,
  loadMore,
}: GoodsReceiptNoteTableProps) {
  const {
    items: goodsReceiptNotes,
    hasMore,
    isLoading,
    sentinelRef,
  } = useInfiniteList({
    initialItems: initialGoodsReceiptNotes,
    initialHasMore,
    loadMore,
  });

  if (goodsReceiptNotes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">No goods receipt notes found.</p>
      </div>
    );
  }

  return (
    <>
      <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Number</TableHead>
          <TableHead>Supplier</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Linked Order</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Lines</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {goodsReceiptNotes.map((goodsReceiptNote) => (
          <TableRow key={goodsReceiptNote.id}>
            <TableCell>
              <Link
                href={`/purchase/receipts/${goodsReceiptNote.id}`}
                className="font-medium text-foreground hover:underline"
              >
                {goodsReceiptNote.grnNumber}
              </Link>
            </TableCell>
            <TableCell>{goodsReceiptNote.supplier.name}</TableCell>
            <TableCell className="font-financial">{formatGoodsReceiptNoteDate(goodsReceiptNote.grnDate)}</TableCell>
            <TableCell>
              {goodsReceiptNote.purchaseOrder ? (
                <Link
                  href={`/purchase/orders/${goodsReceiptNote.purchaseOrder.id}`}
                  className="text-primary hover:underline"
                >
                  {goodsReceiptNote.purchaseOrder.orderNumber}
                </Link>
              ) : (
                "—"
              )}
            </TableCell>
            <TableCell>
              <GoodsReceiptNoteStatusBadge status={goodsReceiptNote.status} />
            </TableCell>
            <TableCell className="text-right font-financial">{goodsReceiptNote.lineCount}</TableCell>
            <TableCell className="text-right">
              <Link href={`/purchase/receipts/${goodsReceiptNote.id}`} className="text-sm text-primary hover:underline">
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
