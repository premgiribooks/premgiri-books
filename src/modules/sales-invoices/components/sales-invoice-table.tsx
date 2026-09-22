"use client";

import Link from "next/link";

import { InfiniteScrollSentinel } from "@/components/common/infinite-scroll-sentinel";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useInfiniteList } from "@/hooks/use-infinite-list";
import type { Page } from "@/lib/pagination";
import { SalesInvoiceStatusBadge } from "@/modules/sales-invoices/components/sales-invoice-status-badge";
import { formatSalesInvoiceDate } from "@/modules/sales-invoices/utils/format-sales-invoice-date";
import type { ActionResult } from "@/types/api";
import type { SalesInvoiceListRow } from "@/types/sales-invoice";

interface SalesInvoiceTableProps {
  salesInvoices: SalesInvoiceListRow[];
  initialHasMore?: boolean;
  loadMore?: (skip: number, take: number) => Promise<ActionResult<Page<SalesInvoiceListRow>>>;
}

function customerLabel(invoice: SalesInvoiceListRow): string {
  if (invoice.customer) {
    return invoice.customer.name;
  }
  if (invoice.customerMode === "QUICK") {
    return invoice.quickCustomerName ?? "Quick Customer";
  }
  return invoice.quickCustomerName ? `Walk-in — ${invoice.quickCustomerName}` : "Walk-in";
}

export function SalesInvoiceTable({
  salesInvoices: initialSalesInvoices,
  initialHasMore = false,
  loadMore,
}: SalesInvoiceTableProps) {
  const { items: salesInvoices, hasMore, isLoading, sentinelRef } = useInfiniteList({
    initialItems: initialSalesInvoices,
    initialHasMore,
    loadMore,
  });

  if (salesInvoices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">No sales invoices found.</p>
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
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Grand Total</TableHead>
          <TableHead className="text-right">Paid</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {salesInvoices.map((invoice) => (
          <TableRow key={invoice.id}>
            <TableCell>
              <Link href={`/sales/invoices/${invoice.id}`} className="font-medium text-foreground hover:underline">
                {invoice.invoiceNumber}
              </Link>
            </TableCell>
            <TableCell>{customerLabel(invoice)}</TableCell>
            <TableCell className="font-financial">{formatSalesInvoiceDate(invoice.invoiceDate)}</TableCell>
            <TableCell>
              <SalesInvoiceStatusBadge status={invoice.status} />
            </TableCell>
            <TableCell className="text-right font-financial">{invoice.grandTotal.toFixed(2)}</TableCell>
            <TableCell className="text-right font-financial">{invoice.amountPaid.toFixed(2)}</TableCell>
            <TableCell className="text-right">
              <Link href={`/sales/invoices/${invoice.id}`} className="text-sm text-primary hover:underline">
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
