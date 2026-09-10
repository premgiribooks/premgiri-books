import Link from "next/link";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SalesOrderFulfillmentProgress } from "@/modules/sales-orders/components/sales-order-fulfillment-progress";
import { SalesOrderStatusBadge } from "@/modules/sales-orders/components/sales-order-status-badge";
import { formatSalesOrderDate } from "@/modules/sales-orders/utils/format-sales-order-date";
import type { SalesOrderListRow } from "@/types/sales-order";

interface SalesOrderTableProps {
  salesOrders: SalesOrderListRow[];
}

export function SalesOrderTable({ salesOrders }: SalesOrderTableProps) {
  if (salesOrders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">No sales orders found.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Number</TableHead>
          <TableHead>Customer</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Fulfillment</TableHead>
          <TableHead className="text-right">Grand Total</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {salesOrders.map((salesOrder) => (
          <TableRow key={salesOrder.id}>
            <TableCell>
              <Link
                href={`/sales/orders/${salesOrder.id}`}
                className="font-medium text-foreground hover:underline"
              >
                {salesOrder.orderNumber}
              </Link>
            </TableCell>
            <TableCell>{salesOrder.customer.name}</TableCell>
            <TableCell className="font-financial">{formatSalesOrderDate(salesOrder.orderDate)}</TableCell>
            <TableCell>
              <SalesOrderStatusBadge status={salesOrder.status} />
            </TableCell>
            <TableCell>
              <SalesOrderFulfillmentProgress
                deliveredLineCount={salesOrder.deliveredLineCount}
                totalLineCount={salesOrder.totalLineCount}
              />
            </TableCell>
            <TableCell className="text-right font-financial">
              {salesOrder.grandTotal.toFixed(2)}
            </TableCell>
            <TableCell className="text-right">
              <Link href={`/sales/orders/${salesOrder.id}`} className="text-sm text-primary hover:underline">
                View
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
