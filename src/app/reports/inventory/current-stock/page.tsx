import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { toActionErrorMessage } from "@/lib/action-error";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { ReportExportButton } from "@/modules/reports/components/report-export-button";
import { CurrentStockTable } from "@/modules/reports/inventory/components/current-stock-table";
import { InventoryReportFilterBar } from "@/modules/reports/inventory/components/inventory-report-filter-bar";
import { inventoryReportService } from "@/modules/reports/inventory/services/inventory-report-service";
import type { CurrentStockReport } from "@/types/inventory-report";

interface CurrentStockPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CurrentStockPage({ searchParams }: CurrentStockPageProps) {
  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "reports", "view");
  if (!canView) {
    redirect("/");
  }

  const resolvedParams = await searchParams;
  const [isAdmin, products, warehouses] = await Promise.all([
    isCurrentUserCompanyAdmin(),
    inventoryReportService.listProductOptions(),
    inventoryReportService.listWarehouseOptions(),
  ]);

  const productId = firstValue(resolvedParams.productId);
  const warehouseId = firstValue(resolvedParams.warehouseId);
  const includeZeroStock = firstValue(resolvedParams.includeZeroStock) === "true";

  let report: CurrentStockReport | null = null;
  let errorMessage: string | null = null;
  try {
    report = await inventoryReportService.getCurrentStockReport({ productId, warehouseId, includeZeroStock });
  } catch (error) {
    errorMessage = toActionErrorMessage(error);
  }

  const exportParams = new URLSearchParams();
  if (productId) exportParams.set("productId", productId);
  if (warehouseId) exportParams.set("warehouseId", warehouseId);
  if (includeZeroStock) exportParams.set("includeZeroStock", "true");

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Current Stock</h1>
            <p className="text-sm text-muted-foreground">Stock on hand (Σ IN − Σ OUT), by product and warehouse.</p>
          </div>
          <ReportExportButton
            downloadUrl={`/reports/inventory/current-stock/export?${exportParams.toString()}`}
            pdfDownloadUrl={`/reports/inventory/current-stock/export?${exportParams.toString()}&format=pdf`}
          />
        </div>

        <InventoryReportFilterBar
          products={products.map((product) => ({ id: product.id, name: `${product.name} (${product.productCode})` }))}
          warehouses={warehouses}
          showZeroStockToggle
        />

        {errorMessage ? (
          <div className="rounded-2xl border border-dashed border-error/40 bg-error/5 p-4 text-sm text-error">{errorMessage}</div>
        ) : (
          <CurrentStockTable report={report!} />
        )}
      </div>
    </AppShell>
  );
}
