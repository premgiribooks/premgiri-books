import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { toActionErrorMessage } from "@/lib/action-error";
import { getCurrentFinancialYear } from "@/lib/current-financial-year";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { ReportExportButton } from "@/modules/reports/components/report-export-button";
import { ItemWisePurchaseTable } from "@/modules/reports/purchase/components/item-wise-purchase-table";
import { PurchaseReportFilterBar } from "@/modules/reports/purchase/components/purchase-report-filter-bar";
import { purchaseReportService } from "@/modules/reports/purchase/services/purchase-report-service";
import { isValidCalendarDate, resolveDefaultAsOfDate, toCalendarDateString } from "@/modules/reports/validation/financial-report-filters-schema";
import type { ItemWisePurchaseReport } from "@/types/purchase-report";

interface ItemWisePurchasePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ItemWisePurchasePage({ searchParams }: ItemWisePurchasePageProps) {
  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "reports", "view");
  if (!canView) {
    redirect("/");
  }

  const resolvedParams = await searchParams;
  const [isAdmin, financialYear, suppliers, products, warehouses] = await Promise.all([
    isCurrentUserCompanyAdmin(),
    getCurrentFinancialYear(),
    purchaseReportService.listSupplierOptions(),
    purchaseReportService.listProductOptions(),
    purchaseReportService.listWarehouseOptions(),
  ]);

  if (!financialYear) {
    return (
      <AppShell isAdmin={isAdmin}>
        <div className="flex flex-col gap-6 p-6">
          <h1 className="text-xl font-semibold text-foreground">Item-wise Purchases</h1>
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
            <p className="text-sm text-muted-foreground">Select an active financial year to view Item-wise Purchases.</p>
          </div>
        </div>
      </AppShell>
    );
  }

  const dateFromParam = firstValue(resolvedParams.dateFrom);
  const dateFrom = dateFromParam && isValidCalendarDate(dateFromParam) ? dateFromParam : toCalendarDateString(financialYear.startDate);
  const dateToParam = firstValue(resolvedParams.dateTo);
  const dateTo = dateToParam && isValidCalendarDate(dateToParam) ? dateToParam : resolveDefaultAsOfDate(financialYear);
  const supplierId = firstValue(resolvedParams.supplierId);
  const productId = firstValue(resolvedParams.productId);
  const warehouseId = firstValue(resolvedParams.warehouseId);

  let report: ItemWisePurchaseReport | null = null;
  let errorMessage: string | null = null;
  try {
    report = await purchaseReportService.getItemWisePurchaseReport({ dateFrom, dateTo, supplierId, productId, warehouseId });
  } catch (error) {
    errorMessage = toActionErrorMessage(error);
  }

  const exportParams = new URLSearchParams({ dateFrom, dateTo });
  if (supplierId) exportParams.set("supplierId", supplierId);
  if (productId) exportParams.set("productId", productId);
  if (warehouseId) exportParams.set("warehouseId", warehouseId);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Item-wise Purchases</h1>
            <p className="text-sm text-muted-foreground">
              Quantity and value purchased, grouped by product, across every POSTED Purchase Invoice in the selected range.
            </p>
          </div>
          <ReportExportButton downloadUrl={`/reports/purchase/item-wise/export?${exportParams.toString()}`} />
        </div>

        <PurchaseReportFilterBar
          suppliers={suppliers}
          products={products.map((product) => ({ id: product.id, name: `${product.name} (${product.productCode})` }))}
          warehouses={warehouses}
        />

        {errorMessage ? (
          <div className="rounded-2xl border border-dashed border-error/40 bg-error/5 p-4 text-sm text-error">{errorMessage}</div>
        ) : (
          <ItemWisePurchaseTable report={report!} />
        )}
      </div>
    </AppShell>
  );
}
