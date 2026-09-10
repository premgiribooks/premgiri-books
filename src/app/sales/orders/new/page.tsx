import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { SalesOrderForm } from "@/modules/sales-orders/components/sales-order-form";
import { salesOrderService } from "@/modules/sales-orders/services/sales-order-service";

export default async function NewSalesOrderPage() {
  const user = await getCurrentCompanyUser();
  const canCreate = await hasPermission(user, "sales", "create");
  if (!canCreate) {
    redirect("/sales/orders");
  }

  const [isAdmin, options] = await Promise.all([
    isCurrentUserCompanyAdmin(),
    salesOrderService.listSalesOrderFormOptions(),
  ]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Create Sales Order</h1>
          <p className="text-sm text-muted-foreground">
            Record a confirmed customer commitment for an existing customer.
          </p>
        </div>

        <SalesOrderForm options={options} />
      </div>
    </AppShell>
  );
}
