import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { toActionErrorMessage } from "@/lib/action-error";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { ReportExportButton } from "@/modules/reports/components/report-export-button";
import { InventoryReportFilterBar } from "@/modules/reports/inventory/components/inventory-report-filter-bar";
import { LowStockTable } from "@/modules/reports/inventory/components/low-stock-table";
import { inventoryReportService } from "@/modules/reports/inventory/services/inventory-report-service";
import type { LowStockReport } from "@/types/inventory-report";

interface LowStockPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LowStockPage({ searchParams }: LowStockPageProps) {
  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "reports", "view");
  if (!canView) {
    redirect("/");
  }

  const resolvedParams = await searchParams;
  const [isAdmin, warehouses] = await Promise.all([isCurrentUserCompanyAdmin(), inventoryReportService.listWarehouseOptions()]);

  const warehouseId = firstValue(resolvedParams.warehouseId);

  let report: LowStockReport | null = null;
  let errorMessage: string | null = null;
  try {
    report = await inventoryReportService.getLowStockReport({ warehouseId });
  } catch (error) {
    errorMessage = toActionErrorMessage(error);
  }

  const exportParams = new URLSearchParams();
  if (warehouseId) exportParams.set("warehouseId", warehouseId);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Low Stock / Reorder</h1>
            <p className="text-sm text-muted-foreground">
              Products below their own configured minimum stock level. Products with no minimum set are excluded.
            </p>
          </div>
          <ReportExportButton downloadUrl={`/reports/inventory/low-stock/export?${exportParams.toString()}`} />
        </div>

        <InventoryReportFilterBar warehouses={warehouses} />

        {errorMessage ? (
          <div className="rounded-2xl border border-dashed border-error/40 bg-error/5 p-4 text-sm text-error">{errorMessage}</div>
        ) : (
          <LowStockTable report={report!} />
        )}
      </div>
    </AppShell>
  );
}
