import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { SalesOrderForm } from "@/modules/sales-orders/components/sales-order-form";
import { salesOrderService } from "@/modules/sales-orders/services/sales-order-service";

interface EditSalesOrderPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditSalesOrderPage({ params }: EditSalesOrderPageProps) {
  const { id } = await params;

  const user = await getCurrentCompanyUser();
  const canEdit = await hasPermission(user, "sales", "edit");
  if (!canEdit) {
    redirect(`/sales/orders/${id}`);
  }

  const salesOrder = await salesOrderService.getSalesOrder(id);
  if (!salesOrder) {
    notFound();
  }

  // Only reachable while DRAFT (36-sales-orders.md's Business Rules) — the
  // service itself also rejects a non-DRAFT update, this just avoids
  // offering a doomed form.
  if (salesOrder.status !== "DRAFT") {
    redirect(`/sales/orders/${id}`);
  }

  const [isAdmin, options] = await Promise.all([
    isCurrentUserCompanyAdmin(),
    salesOrderService.listSalesOrderFormOptions(),
  ]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Edit Sales Order — {salesOrder.orderNumber}
          </h1>
          <p className="text-sm text-muted-foreground">
            Update the customer, dates, place of supply, and lines.
          </p>
        </div>

        <SalesOrderForm options={options} salesOrder={salesOrder} />
      </div>
    </AppShell>
  );
}
