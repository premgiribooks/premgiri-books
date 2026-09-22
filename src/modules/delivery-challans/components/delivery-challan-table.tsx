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
import { DeliveryChallanStatusBadge } from "@/modules/delivery-challans/components/delivery-challan-status-badge";
import { formatDeliveryChallanDate } from "@/modules/delivery-challans/utils/format-delivery-challan-date";
import type { ActionResult } from "@/types/api";
import type { DeliveryChallanListRow } from "@/types/delivery-challan";

interface DeliveryChallanTableProps {
  deliveryChallans: DeliveryChallanListRow[];
  initialHasMore?: boolean;
  loadMore?: (skip: number, take: number) => Promise<ActionResult<Page<DeliveryChallanListRow>>>;
}

export function DeliveryChallanTable({
  deliveryChallans: initialDeliveryChallans,
  initialHasMore = false,
  loadMore,
}: DeliveryChallanTableProps) {
  const {
    items: deliveryChallans,
    hasMore,
    isLoading,
    sentinelRef,
  } = useInfiniteList({ initialItems: initialDeliveryChallans, initialHasMore, loadMore });

  if (deliveryChallans.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">No delivery challans found.</p>
      </div>
    );
  }

  return (
    <>
      <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Number</TableHead>
          <TableHead>Customer</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Linked Order</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Lines</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {deliveryChallans.map((deliveryChallan) => (
          <TableRow key={deliveryChallan.id}>
            <TableCell>
              <Link
                href={`/sales/challans/${deliveryChallan.id}`}
                className="font-medium text-foreground hover:underline"
              >
                {deliveryChallan.challanNumber}
              </Link>
            </TableCell>
            <TableCell>{deliveryChallan.customer.name}</TableCell>
            <TableCell className="font-financial">{formatDeliveryChallanDate(deliveryChallan.challanDate)}</TableCell>
            <TableCell>
              {deliveryChallan.salesOrder ? (
                <Link
                  href={`/sales/orders/${deliveryChallan.salesOrder.id}`}
                  className="text-primary hover:underline"
                >
                  {deliveryChallan.salesOrder.orderNumber}
                </Link>
              ) : (
                "—"
              )}
            </TableCell>
            <TableCell>
              <DeliveryChallanStatusBadge status={deliveryChallan.status} />
            </TableCell>
            <TableCell className="text-right font-financial">{deliveryChallan.lineCount}</TableCell>
            <TableCell className="text-right">
              <Link href={`/sales/challans/${deliveryChallan.id}`} className="text-sm text-primary hover:underline">
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
