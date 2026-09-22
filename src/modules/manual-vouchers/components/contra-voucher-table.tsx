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

interface ContraVoucherTableProps {
  vouchers: PostedVoucher[];
  ledgerNameById: ReadonlyMap<string, string>;
  initialHasMore?: boolean;
  loadMore?: (skip: number, take: number) => Promise<ActionResult<Page<PostedVoucher>>>;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(
    date
  );
}

/** The single Credit entry's ledger name — "From" (funds' source). */
function fromLedgerName(voucher: PostedVoucher, ledgerNameById: ReadonlyMap<string, string>): string {
  const creditEntry = voucher.entries.find((entry) => entry.entryType === "CREDIT");
  return creditEntry ? (ledgerNameById.get(creditEntry.ledgerId) ?? "—") : "—";
}

/** The single Debit entry's ledger name — "To" (funds' destination). */
function toLedgerName(voucher: PostedVoucher, ledgerNameById: ReadonlyMap<string, string>): string {
  const debitEntry = voucher.entries.find((entry) => entry.entryType === "DEBIT");
  return debitEntry ? (ledgerNameById.get(debitEntry.ledgerId) ?? "—") : "—";
}

export function ContraVoucherTable({
  vouchers: initialVouchers,
  ledgerNameById,
  initialHasMore = false,
  loadMore,
}: ContraVoucherTableProps) {
  const { items: vouchers, hasMore, isLoading, sentinelRef } = useInfiniteList({
    initialItems: initialVouchers,
    initialHasMore,
    loadMore,
  });
  if (vouchers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">No contra vouchers found.</p>
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
          <TableHead>From</TableHead>
          <TableHead>To</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {vouchers.map((voucher) => (
          <TableRow key={voucher.id}>
            <TableCell className="font-medium text-foreground">{voucher.voucherNumber}</TableCell>
            <TableCell className="text-muted-foreground">{formatDate(voucher.voucherDate)}</TableCell>
            <TableCell className="text-muted-foreground">{fromLedgerName(voucher, ledgerNameById)}</TableCell>
            <TableCell className="text-muted-foreground">{toLedgerName(voucher, ledgerNameById)}</TableCell>
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
                  <Link href={`/accounting/contra-vouchers/${voucher.id}`} aria-label="View contra voucher">
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
