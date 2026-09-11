import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { StockTransferForm } from "@/modules/stock-transfers/components/stock-transfer-form";
import { stockTransferService } from "@/modules/stock-transfers/services/stock-transfer-service";

export default async function NewStockTransferPage() {
  const user = await getCurrentCompanyUser();
  const canCreate = await hasPermission(user, "inventory", "create");
  if (!canCreate) {
    redirect("/inventory/transfers");
  }

  const [options, isAdmin] = await Promise.all([stockTransferService.listFormOptions(), isCurrentUserCompanyAdmin()]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">New Stock Transfer</h1>
          <p className="text-sm text-muted-foreground">
            Move one or more products from a source warehouse to a destination warehouse. Saved as a draft until posted.
          </p>
        </div>

        <StockTransferForm options={options} />
      </div>
    </AppShell>
  );
}
