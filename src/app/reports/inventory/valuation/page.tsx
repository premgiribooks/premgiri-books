import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { toActionErrorMessage } from "@/lib/action-error";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { ReportExportButton } from "@/modules/reports/components/report-export-button";
import { InventoryReportFilterBar } from "@/modules/reports/inventory/components/inventory-report-filter-bar";
import { StockValuationTable } from "@/modules/reports/inventory/components/stock-valuation-table";
import { inventoryReportService } from "@/modules/reports/inventory/services/inventory-report-service";
import type { StockValuationReport } from "@/types/inventory-report";

interface StockValuationPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function StockValuationPage({ searchParams }: StockValuationPageProps) {
  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "reports", "view");
  if (!canView) {
    redirect("/");
  }

  const resolvedParams = await searchParams;
  const [isAdmin, warehouses] = await Promise.all([isCurrentUserCompanyAdmin(), inventoryReportService.listWarehouseOptions()]);

  const warehouseId = firstValue(resolvedParams.warehouseId);

  let report: StockValuationReport | null = null;
  let errorMessage: string | null = null;
  try {
    report = await inventoryReportService.getStockValuationReport({ warehouseId });
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
            <h1 className="text-xl font-semibold text-foreground">Stock Valuation</h1>
            <p className="text-sm text-muted-foreground">Stock valued at Latest Purchase Cost. Products with no cost set are flagged.</p>
          </div>
          <ReportExportButton downloadUrl={`/reports/inventory/valuation/export?${exportParams.toString()}`} />
        </div>

        <InventoryReportFilterBar warehouses={warehouses} />

        {errorMessage ? (
          <div className="rounded-2xl border border-dashed border-error/40 bg-error/5 p-4 text-sm text-error">{errorMessage}</div>
        ) : (
          <StockValuationTable report={report!} />
        )}
      </div>
    </AppShell>
  );
}
