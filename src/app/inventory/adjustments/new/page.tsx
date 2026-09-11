import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { StockAdjustmentForm } from "@/modules/stock-adjustments/components/stock-adjustment-form";
import { stockAdjustmentService } from "@/modules/stock-adjustments/services/stock-adjustment-service";

export default async function NewStockAdjustmentPage() {
  const user = await getCurrentCompanyUser();
  const canCreate = await hasPermission(user, "inventory", "create");
  if (!canCreate) {
    redirect("/inventory/adjustments");
  }

  const [options, isAdmin] = await Promise.all([stockAdjustmentService.listFormOptions(), isCurrentUserCompanyAdmin()]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">New Stock Adjustment</h1>
          <p className="text-sm text-muted-foreground">
            Record found stock (IN) or a write-off (OUT) per line, with a reason for the correction. Saved as a draft until posted.
          </p>
        </div>

        <StockAdjustmentForm options={options} />
      </div>
    </AppShell>
  );
}
