import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Pencil } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { SalesOrderDetailContent } from "@/modules/sales-orders/components/sales-order-detail-content";
import { SalesOrderDownloadPdfButton } from "@/modules/sales-orders/components/sales-order-download-pdf-button";
import { SalesOrderStatusActions } from "@/modules/sales-orders/components/sales-order-status-actions";
import { SalesOrderStatusBadge } from "@/modules/sales-orders/components/sales-order-status-badge";
import { formatSalesOrderDate } from "@/modules/sales-orders/utils/format-sales-order-date";
import { salesOrderService } from "@/modules/sales-orders/services/sales-order-service";

interface SalesOrderDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function SalesOrderDetailPage({ params }: SalesOrderDetailPageProps) {
  const { id } = await params;

  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "sales", "view");
  if (!canView) {
    redirect("/");
  }

  const salesOrder = await salesOrderService.getSalesOrder(id);
  if (!salesOrder) {
    notFound();
  }

  const [isAdmin, canEdit, canApprove, canCreateDeliveryChallan] = await Promise.all([
    isCurrentUserCompanyAdmin(),
    hasPermission(user, "sales", "edit"),
    hasPermission(user, "sales", "approve"),
    hasPermission(user, "sales", "create"),
  ]);

  const isEditable = salesOrder.status === "DRAFT";

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-foreground">{salesOrder.orderNumber}</h1>
              <SalesOrderStatusBadge status={salesOrder.status} />
            </div>
            <p className="text-sm text-muted-foreground">{salesOrder.customer.name}</p>
          </div>

          <div className="flex items-center gap-2">
            {canEdit && isEditable ? (
              <Button
                variant="outline"
                nativeButton={false}
                render={
                  <Link href={`/sales/orders/${salesOrder.id}/edit`}>
                    <Pencil size={16} />
                    Edit
                  </Link>
                }
              />
            ) : null}
            <SalesOrderDownloadPdfButton salesOrderId={salesOrder.id} />
            <SalesOrderStatusActions
              salesOrder={salesOrder}
              canEdit={canEdit}
              canApprove={canApprove}
              canCreateDeliveryChallan={canCreateDeliveryChallan}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 rounded-2xl border border-border p-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Order Date</p>
            <p className="font-financial text-sm text-foreground">{formatSalesOrderDate(salesOrder.orderDate)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Expected Delivery Date</p>
            <p className="font-financial text-sm text-foreground">
              {salesOrder.expectedDeliveryDate ? formatSalesOrderDate(salesOrder.expectedDeliveryDate) : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Place of Supply</p>
            <p className="text-sm text-foreground">{salesOrder.placeOfSupplyStateCode}</p>
          </div>
        </div>

        {salesOrder.narration ? (
          <p className="text-sm text-muted-foreground">{salesOrder.narration}</p>
        ) : null}

        <SalesOrderDetailContent salesOrder={salesOrder} />
      </div>
    </AppShell>
  );
}
