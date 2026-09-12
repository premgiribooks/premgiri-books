import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { toActionErrorMessage } from "@/lib/action-error";
import { getCurrentFinancialYear } from "@/lib/current-financial-year";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { ItemWiseSalesTable } from "@/modules/reports/sales/components/item-wise-sales-table";
import { SalesReportFilterBar } from "@/modules/reports/sales/components/sales-report-filter-bar";
import { salesReportService } from "@/modules/reports/sales/services/sales-report-service";
import { isValidCalendarDate, resolveDefaultAsOfDate, toCalendarDateString } from "@/modules/reports/validation/financial-report-filters-schema";
import type { ItemWiseSalesReport } from "@/types/sales-report";

interface ItemWiseSalesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ItemWiseSalesPage({ searchParams }: ItemWiseSalesPageProps) {
  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "reports", "view");
  if (!canView) {
    redirect("/");
  }

  const resolvedParams = await searchParams;
  const [isAdmin, financialYear, customers, products, warehouses] = await Promise.all([
    isCurrentUserCompanyAdmin(),
    getCurrentFinancialYear(),
    salesReportService.listCustomerOptions(),
    salesReportService.listProductOptions(),
    salesReportService.listWarehouseOptions(),
  ]);

  if (!financialYear) {
    return (
      <AppShell isAdmin={isAdmin}>
        <div className="flex flex-col gap-6 p-6">
          <h1 className="text-xl font-semibold text-foreground">Item-wise Sales</h1>
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
            <p className="text-sm text-muted-foreground">Select an active financial year to view Item-wise Sales.</p>
          </div>
        </div>
      </AppShell>
    );
  }

  const dateFromParam = firstValue(resolvedParams.dateFrom);
  const dateFrom = dateFromParam && isValidCalendarDate(dateFromParam) ? dateFromParam : toCalendarDateString(financialYear.startDate);
  const dateToParam = firstValue(resolvedParams.dateTo);
  const dateTo = dateToParam && isValidCalendarDate(dateToParam) ? dateToParam : resolveDefaultAsOfDate(financialYear);
  const customerId = firstValue(resolvedParams.customerId);
  const productId = firstValue(resolvedParams.productId);
  const warehouseId = firstValue(resolvedParams.warehouseId);

  let report: ItemWiseSalesReport | null = null;
  let errorMessage: string | null = null;
  try {
    report = await salesReportService.getItemWiseSalesReport({ dateFrom, dateTo, customerId, productId, warehouseId });
  } catch (error) {
    errorMessage = toActionErrorMessage(error);
  }

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Item-wise Sales</h1>
          <p className="text-sm text-muted-foreground">
            Quantity and value sold, grouped by product, across every POSTED Sales Invoice in the selected range.
          </p>
        </div>

        <SalesReportFilterBar
          customers={customers}
          products={products.map((product) => ({ id: product.id, name: `${product.name} (${product.productCode})` }))}
          warehouses={warehouses}
        />

        {errorMessage ? (
          <div className="rounded-2xl border border-dashed border-error/40 bg-error/5 p-4 text-sm text-error">{errorMessage}</div>
        ) : (
          <ItemWiseSalesTable report={report!} />
        )}
      </div>
    </AppShell>
  );
}
