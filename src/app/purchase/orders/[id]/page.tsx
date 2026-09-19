import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Pencil } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { PurchaseOrderDownloadPdfButton } from "@/modules/purchase-orders/components/purchase-order-download-pdf-button";
import { PurchaseOrderStatusActions } from "@/modules/purchase-orders/components/purchase-order-status-actions";
import { PurchaseOrderStatusBadge } from "@/modules/purchase-orders/components/purchase-order-status-badge";
import { PurchaseOrderTotalsSummary } from "@/modules/purchase-orders/components/purchase-order-totals-summary";
import { formatPurchaseOrderDate } from "@/modules/purchase-orders/utils/format-purchase-order-date";
import { purchaseOrderService } from "@/modules/purchase-orders/services/purchase-order-service";

interface PurchaseOrderDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function PurchaseOrderDetailPage({ params }: PurchaseOrderDetailPageProps) {
  const { id } = await params;

  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "purchase", "view");
  if (!canView) {
    redirect("/");
  }

  const purchaseOrder = await purchaseOrderService.getPurchaseOrder(id);
  if (!purchaseOrder) {
    notFound();
  }

  const [isAdmin, canEdit, canApprove, canCreateReceipt] = await Promise.all([
    isCurrentUserCompanyAdmin(),
    hasPermission(user, "purchase", "edit"),
    hasPermission(user, "purchase", "approve"),
    hasPermission(user, "purchase", "create"),
  ]);

  const isEditable = purchaseOrder.status === "DRAFT";

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-foreground">{purchaseOrder.orderNumber}</h1>
              <PurchaseOrderStatusBadge status={purchaseOrder.status} />
            </div>
            <p className="text-sm text-muted-foreground">{purchaseOrder.supplier.name}</p>
          </div>

          <div className="flex items-center gap-2">
            {canEdit && isEditable ? (
              <Button
                variant="outline"
                nativeButton={false}
                render={
                  <Link href={`/purchase/orders/${purchaseOrder.id}/edit`}>
                    <Pencil size={16} />
                    Edit
                  </Link>
                }
              />
            ) : null}
            <PurchaseOrderDownloadPdfButton purchaseOrderId={purchaseOrder.id} />
            <PurchaseOrderStatusActions
              purchaseOrder={purchaseOrder}
              canEdit={canEdit}
              canApprove={canApprove}
              canCreateReceipt={canCreateReceipt}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 rounded-2xl border border-border p-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Order Date</p>
            <p className="font-financial text-sm text-foreground">{formatPurchaseOrderDate(purchaseOrder.orderDate)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Expected Delivery Date</p>
            <p className="font-financial text-sm text-foreground">
              {purchaseOrder.expectedDeliveryDate ? formatPurchaseOrderDate(purchaseOrder.expectedDeliveryDate) : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Place of Supply</p>
            <p className="text-sm text-foreground">{purchaseOrder.placeOfSupplyStateCode}</p>
          </div>
        </div>

        {purchaseOrder.narration ? (
          <p className="text-sm text-muted-foreground">{purchaseOrder.narration}</p>
        ) : null}

        <div className="overflow-x-auto rounded-2xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Received</TableHead>
                <TableHead className="text-right">Pending</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Discount</TableHead>
                <TableHead className="text-right">Taxable</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchaseOrder.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    {item.product.name} ({item.product.productCode})
                    {!item.product.isActive ? (
                      <span className="ml-1 text-xs text-muted-foreground">(Inactive)</span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right font-financial">{item.quantity}</TableCell>
                  <TableCell className="text-right font-financial">{item.receivedQuantity}</TableCell>
                  <TableCell className="text-right font-financial">{item.quantity - item.receivedQuantity}</TableCell>
                  <TableCell className="text-right font-financial">{item.rate.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-financial">
                    {item.discountAmount > 0 || item.discountPercent > 0
                      ? `${item.discountPercent}% + ${item.discountAmount.toFixed(2)}`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right font-financial">{item.taxableAmount.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-financial">{item.totalAmount.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <PurchaseOrderTotalsSummary
          totals={{
            subtotal: purchaseOrder.subtotal,
            totalDiscount: purchaseOrder.totalDiscount,
            taxableAmount: purchaseOrder.taxableAmount,
            totalCgst: purchaseOrder.totalCgst,
            totalSgst: purchaseOrder.totalSgst,
            totalIgst: purchaseOrder.totalIgst,
            totalCess: purchaseOrder.totalCess,
            grandTotal: purchaseOrder.grandTotal,
          }}
          groups={[]}
        />
      </div>
    </AppShell>
  );
}
