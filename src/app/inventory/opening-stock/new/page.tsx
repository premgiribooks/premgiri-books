import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { OpeningStockForm } from "@/modules/opening-stock/components/opening-stock-form";
import { openingStockService } from "@/modules/opening-stock/services/opening-stock-service";

export default async function NewOpeningStockPage() {
  const user = await getCurrentCompanyUser();
  const canCreate = await hasPermission(user, "inventory", "create");
  if (!canCreate) {
    redirect("/inventory/opening-stock");
  }

  const [options, isAdmin] = await Promise.all([openingStockService.listFormOptions(), isCurrentUserCompanyAdmin()]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Record Opening Stock</h1>
          <p className="text-sm text-muted-foreground">
            Record each product/warehouse pair&apos;s starting quantity and cost. Each pair can receive Opening Stock only once,
            ever — use Stock Adjustment to correct a mistaken entry.
          </p>
        </div>

        <OpeningStockForm options={options} />
      </div>
    </AppShell>
  );
}
