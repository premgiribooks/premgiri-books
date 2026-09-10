import Link from "next/link";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PurchaseOrderFulfillmentProgress } from "@/modules/purchase-orders/components/purchase-order-fulfillment-progress";
import { PurchaseOrderStatusBadge } from "@/modules/purchase-orders/components/purchase-order-status-badge";
import { formatPurchaseOrderDate } from "@/modules/purchase-orders/utils/format-purchase-order-date";
import type { PurchaseOrderListRow } from "@/types/purchase-order";

interface PurchaseOrderTableProps {
  purchaseOrders: PurchaseOrderListRow[];
}

export function PurchaseOrderTable({ purchaseOrders }: PurchaseOrderTableProps) {
  if (purchaseOrders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">No purchase orders found.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Number</TableHead>
          <TableHead>Supplier</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Fulfillment</TableHead>
          <TableHead className="text-right">Grand Total</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {purchaseOrders.map((purchaseOrder) => (
          <TableRow key={purchaseOrder.id}>
            <TableCell>
              <Link
                href={`/purchase/orders/${purchaseOrder.id}`}
                className="font-medium text-foreground hover:underline"
              >
                {purchaseOrder.orderNumber}
              </Link>
            </TableCell>
            <TableCell>{purchaseOrder.supplier.name}</TableCell>
            <TableCell className="font-financial">{formatPurchaseOrderDate(purchaseOrder.orderDate)}</TableCell>
            <TableCell>
              <PurchaseOrderStatusBadge status={purchaseOrder.status} />
            </TableCell>
            <TableCell>
              <PurchaseOrderFulfillmentProgress
                receivedLineCount={purchaseOrder.receivedLineCount}
                totalLineCount={purchaseOrder.totalLineCount}
              />
            </TableCell>
            <TableCell className="text-right font-financial">
              {purchaseOrder.grandTotal.toFixed(2)}
            </TableCell>
            <TableCell className="text-right">
              <Link href={`/purchase/orders/${purchaseOrder.id}`} className="text-sm text-primary hover:underline">
                View
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
