import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { PurchaseOrderForm } from "@/modules/purchase-orders/components/purchase-order-form";
import { purchaseOrderService } from "@/modules/purchase-orders/services/purchase-order-service";

interface EditPurchaseOrderPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditPurchaseOrderPage({ params }: EditPurchaseOrderPageProps) {
  const { id } = await params;

  const user = await getCurrentCompanyUser();
  const canEdit = await hasPermission(user, "purchase", "edit");
  if (!canEdit) {
    redirect(`/purchase/orders/${id}`);
  }

  const purchaseOrder = await purchaseOrderService.getPurchaseOrder(id);
  if (!purchaseOrder) {
    notFound();
  }

  // Only reachable while DRAFT (42-purchase-orders.md's Business Rules) — the
  // service itself also rejects a non-DRAFT update, this just avoids
  // offering a doomed form.
  if (purchaseOrder.status !== "DRAFT") {
    redirect(`/purchase/orders/${id}`);
  }

  const [isAdmin, options] = await Promise.all([
    isCurrentUserCompanyAdmin(),
    purchaseOrderService.listPurchaseOrderFormOptions(),
  ]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Edit Purchase Order — {purchaseOrder.orderNumber}
          </h1>
          <p className="text-sm text-muted-foreground">
            Update the supplier, dates, place of supply, and lines.
          </p>
        </div>

        <PurchaseOrderForm options={options} purchaseOrder={purchaseOrder} />
      </div>
    </AppShell>
  );
}
