"use client";

import Link from "next/link";
import { Eye } from "lucide-react";

import { InfiniteScrollSentinel } from "@/components/common/infinite-scroll-sentinel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { PostedVoucher } from "@/engines/voucher/types";
import { useInfiniteList } from "@/hooks/use-infinite-list";
import type { Page } from "@/lib/pagination";
import type { ActionResult } from "@/types/api";

interface JournalVoucherTableProps {
  vouchers: PostedVoucher[];
  initialHasMore?: boolean;
  loadMore?: (skip: number, take: number) => Promise<ActionResult<Page<PostedVoucher>>>;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(
    date
  );
}

export function JournalVoucherTable({
  vouchers: initialVouchers,
  initialHasMore = false,
  loadMore,
}: JournalVoucherTableProps) {
  const { items: vouchers, hasMore, isLoading, sentinelRef } = useInfiniteList({
    initialItems: initialVouchers,
    initialHasMore,
    loadMore,
  });
  if (vouchers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">No journal vouchers found.</p>
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
          <TableHead>Narration</TableHead>
          <TableHead className="text-right">Total Amount</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {vouchers.map((voucher) => (
          <TableRow key={voucher.id}>
            <TableCell className="font-medium text-foreground">{voucher.voucherNumber}</TableCell>
            <TableCell className="text-muted-foreground">{formatDate(voucher.voucherDate)}</TableCell>
            <TableCell className="text-muted-foreground">{voucher.narration ?? "—"}</TableCell>
            <TableCell className="text-right font-financial">{voucher.totalAmount.toFixed(2)}</TableCell>
            <TableCell>
              <Badge
                variant="outline"
                className={
                  voucher.status === "POSTED"
                    ? "border-success/30 bg-success/10 text-success"
                    : "border-muted-foreground/20 bg-muted text-muted-foreground"
                }
              >
                {voucher.status === "POSTED" ? "Posted" : "Cancelled"}
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              <Button
                variant="ghost"
                size="icon-sm"
                nativeButton={false}
                render={
                  <Link href={`/accounting/journal-vouchers/${voucher.id}`} aria-label="View journal voucher">
                    <Eye size={16} />
                  </Link>
                }
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
      </Table>
      <InfiniteScrollSentinel hasMore={hasMore} isLoading={isLoading} sentinelRef={sentinelRef} />
    </>
  );
}
