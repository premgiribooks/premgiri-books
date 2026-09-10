import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { PurchaseOrderForm } from "@/modules/purchase-orders/components/purchase-order-form";
import { purchaseOrderService } from "@/modules/purchase-orders/services/purchase-order-service";

export default async function NewPurchaseOrderPage() {
  const user = await getCurrentCompanyUser();
  const canCreate = await hasPermission(user, "purchase", "create");
  if (!canCreate) {
    redirect("/purchase/orders");
  }

  const [isAdmin, options] = await Promise.all([
    isCurrentUserCompanyAdmin(),
    purchaseOrderService.listPurchaseOrderFormOptions(),
  ]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Create Purchase Order</h1>
          <p className="text-sm text-muted-foreground">
            Record a commitment to buy from an existing supplier.
          </p>
        </div>

        <PurchaseOrderForm options={options} />
      </div>
    </AppShell>
  );
}
