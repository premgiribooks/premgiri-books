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
import { DeliveryChallanDownloadPdfButton } from "@/modules/delivery-challans/components/delivery-challan-download-pdf-button";
import { DeliveryChallanStatusActions } from "@/modules/delivery-challans/components/delivery-challan-status-actions";
import { DeliveryChallanStatusBadge } from "@/modules/delivery-challans/components/delivery-challan-status-badge";
import { formatDeliveryChallanDate } from "@/modules/delivery-challans/utils/format-delivery-challan-date";
import { deliveryChallanService } from "@/modules/delivery-challans/services/delivery-challan-service";

interface DeliveryChallanDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function DeliveryChallanDetailPage({ params }: DeliveryChallanDetailPageProps) {
  const { id } = await params;

  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "sales", "view");
  if (!canView) {
    redirect("/");
  }

  const deliveryChallan = await deliveryChallanService.getDeliveryChallan(id);
  if (!deliveryChallan) {
    notFound();
  }

  const [isAdmin, canEdit, canCreateInvoice] = await Promise.all([
    isCurrentUserCompanyAdmin(),
    hasPermission(user, "sales", "edit"),
    hasPermission(user, "sales", "create"),
  ]);

  const isEditable = deliveryChallan.status === "DRAFT";

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-foreground">{deliveryChallan.challanNumber}</h1>
              <DeliveryChallanStatusBadge status={deliveryChallan.status} />
            </div>
            <p className="text-sm text-muted-foreground">{deliveryChallan.customer.name}</p>
          </div>

          <div className="flex items-center gap-2">
            {canEdit && isEditable ? (
              <Button
                variant="outline"
                nativeButton={false}
                render={
                  <Link href={`/sales/challans/${deliveryChallan.id}/edit`}>
                    <Pencil size={16} />
                    Edit
                  </Link>
                }
              />
            ) : null}
            <DeliveryChallanDownloadPdfButton deliveryChallanId={deliveryChallan.id} />
            <DeliveryChallanStatusActions
              deliveryChallan={deliveryChallan}
              canEdit={canEdit}
              canCreateInvoice={canCreateInvoice}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 rounded-2xl border border-border p-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Challan Date</p>
            <p className="font-financial text-sm text-foreground">
              {formatDeliveryChallanDate(deliveryChallan.challanDate)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Linked Sales Order</p>
            <p className="text-sm text-foreground">
              {deliveryChallan.salesOrder ? (
                <Link href={`/sales/orders/${deliveryChallan.salesOrder.id}`} className="text-primary hover:underline">
                  {deliveryChallan.salesOrder.orderNumber}
                </Link>
              ) : (
                "—"
              )}
            </p>
          </div>
        </div>

        {deliveryChallan.narration ? (
          <p className="text-sm text-muted-foreground">{deliveryChallan.narration}</p>
        ) : null}

        <div className="overflow-x-auto rounded-2xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Warehouse</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deliveryChallan.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    {item.product.name} ({item.product.productCode})
                    {!item.product.isActive ? (
                      <span className="ml-1 text-xs text-muted-foreground">(Inactive)</span>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {item.warehouse.name} ({item.warehouse.code})
                    {!item.warehouse.isActive ? (
                      <span className="ml-1 text-xs text-muted-foreground">(Inactive)</span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right font-financial">{item.quantity}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </AppShell>
  );
}
