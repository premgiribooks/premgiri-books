"use client";

import Link from "next/link";

import { InfiniteScrollSentinel } from "@/components/common/infinite-scroll-sentinel";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useInfiniteList } from "@/hooks/use-infinite-list";
import type { Page } from "@/lib/pagination";
import { PurchaseCreditNoteStatusBadge } from "@/modules/purchase-credit-notes/components/purchase-credit-note-status-badge";
import { formatPurchaseCreditNoteDate } from "@/modules/purchase-credit-notes/utils/format-purchase-credit-note-date";
import type { ActionResult } from "@/types/api";
import type { PurchaseCreditNoteListRow } from "@/types/purchase-credit-note";

interface PurchaseCreditNoteTableProps {
  purchaseCreditNotes: PurchaseCreditNoteListRow[];
  initialHasMore?: boolean;
  loadMore?: (
    skip: number,
    take: number
  ) => Promise<ActionResult<Page<PurchaseCreditNoteListRow>>>;
}

export function PurchaseCreditNoteTable({
  purchaseCreditNotes: initialPurchaseCreditNotes,
  initialHasMore = false,
  loadMore,
}: PurchaseCreditNoteTableProps) {
  const {
    items: purchaseCreditNotes,
    hasMore,
    isLoading,
    sentinelRef,
  } = useInfiniteList({
    initialItems: initialPurchaseCreditNotes,
    initialHasMore,
    loadMore,
  });

  if (purchaseCreditNotes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">No purchase credit notes found.</p>
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
          <TableHead>Linked Invoice</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Grand Total</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {purchaseCreditNotes.map((purchaseCreditNote) => (
          <TableRow key={purchaseCreditNote.id}>
            <TableCell>
              <Link href={`/purchase/credit-notes/${purchaseCreditNote.id}`} className="font-medium text-foreground hover:underline">
                {purchaseCreditNote.noteNumber ?? "Draft"}
              </Link>
            </TableCell>
            <TableCell>{purchaseCreditNote.supplier.name}</TableCell>
            <TableCell>{purchaseCreditNote.purchaseInvoice?.invoiceNumber ?? "—"}</TableCell>
            <TableCell className="font-financial">{formatPurchaseCreditNoteDate(purchaseCreditNote.noteDate)}</TableCell>
            <TableCell>
              <PurchaseCreditNoteStatusBadge status={purchaseCreditNote.status} />
            </TableCell>
            <TableCell className="text-right font-financial">{purchaseCreditNote.grandTotal.toFixed(2)}</TableCell>
            <TableCell className="text-right">
              <Link href={`/purchase/credit-notes/${purchaseCreditNote.id}`} className="text-sm text-primary hover:underline">
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
