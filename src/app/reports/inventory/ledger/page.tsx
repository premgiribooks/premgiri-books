import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { toActionErrorMessage } from "@/lib/action-error";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { ReportExportButton } from "@/modules/reports/components/report-export-button";
import { InventoryReportFilterBar } from "@/modules/reports/inventory/components/inventory-report-filter-bar";
import { StockLedgerTable } from "@/modules/reports/inventory/components/stock-ledger-table";
import { inventoryReportService } from "@/modules/reports/inventory/services/inventory-report-service";
import type { StockLedgerReport } from "@/types/inventory-report";

interface StockLedgerPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function StockLedgerPage({ searchParams }: StockLedgerPageProps) {
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
  const dateFrom = firstValue(resolvedParams.dateFrom);
  const dateTo = firstValue(resolvedParams.dateTo);

  const filterBar = (
    <InventoryReportFilterBar
      products={products.map((product) => ({ id: product.id, name: `${product.name} (${product.productCode})` }))}
      productRequired
      warehouses={warehouses}
      showDateRange
    />
  );

  if (!productId) {
    return (
      <AppShell isAdmin={isAdmin}>
        <div className="flex flex-col gap-6 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-foreground">Stock Ledger</h1>
              <p className="text-sm text-muted-foreground">Dated movement history for one product, with a running balance.</p>
            </div>
            <ReportExportButton />
          </div>

          {filterBar}

          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
            <p className="text-sm text-muted-foreground">Select a product above to view its stock ledger.</p>
          </div>
        </div>
      </AppShell>
    );
  }

  let report: StockLedgerReport | null = null;
  let errorMessage: string | null = null;
  try {
    report = await inventoryReportService.getStockLedgerReport({ productId, warehouseId, dateFrom, dateTo });
  } catch (error) {
    errorMessage = toActionErrorMessage(error);
  }

  const exportParams = new URLSearchParams({ productId });
  if (warehouseId) exportParams.set("warehouseId", warehouseId);
  if (dateFrom) exportParams.set("dateFrom", dateFrom);
  if (dateTo) exportParams.set("dateTo", dateTo);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Stock Ledger{report ? ` — ${report.productName}` : ""}</h1>
            <p className="text-sm text-muted-foreground">Dated movement history for one product, with a running balance.</p>
          </div>
          {errorMessage ? (
            <ReportExportButton />
          ) : (
            <ReportExportButton downloadUrl={`/reports/inventory/ledger/export?${exportParams.toString()}`} />
          )}
        </div>

        {filterBar}

        {errorMessage ? (
          <div className="rounded-2xl border border-dashed border-error/40 bg-error/5 p-4 text-sm text-error">{errorMessage}</div>
        ) : (
          <StockLedgerTable report={report!} />
        )}
      </div>
    </AppShell>
  );
}
