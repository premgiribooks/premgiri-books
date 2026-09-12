import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { toActionErrorMessage } from "@/lib/action-error";
import { getCurrentFinancialYear } from "@/lib/current-financial-year";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { PartyWisePurchaseTable } from "@/modules/reports/purchase/components/party-wise-purchase-table";
import { SupplierReportFilterBar } from "@/modules/reports/suppliers/components/supplier-report-filter-bar";
import { supplierReportService } from "@/modules/reports/suppliers/services/supplier-report-service";
import { isValidCalendarDate, resolveDefaultAsOfDate, toCalendarDateString } from "@/modules/reports/validation/financial-report-filters-schema";
import type { PartyWisePurchaseReport } from "@/types/purchase-report";

interface SupplierPurchaseSummaryPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SupplierPurchaseSummaryPage({ searchParams }: SupplierPurchaseSummaryPageProps) {
  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "reports", "view");
  if (!canView) {
    redirect("/");
  }

  const resolvedParams = await searchParams;
  const [isAdmin, financialYear] = await Promise.all([isCurrentUserCompanyAdmin(), getCurrentFinancialYear()]);

  if (!financialYear) {
    return (
      <AppShell isAdmin={isAdmin}>
        <div className="flex flex-col gap-6 p-6">
          <h1 className="text-xl font-semibold text-foreground">Supplier Purchase Summary</h1>
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
            <p className="text-sm text-muted-foreground">Select an active financial year to view the Supplier Purchase Summary.</p>
          </div>
        </div>
      </AppShell>
    );
  }

  const dateFromParam = firstValue(resolvedParams.dateFrom);
  const dateFrom = dateFromParam && isValidCalendarDate(dateFromParam) ? dateFromParam : toCalendarDateString(financialYear.startDate);
  const dateToParam = firstValue(resolvedParams.dateTo);
  const dateTo = dateToParam && isValidCalendarDate(dateToParam) ? dateToParam : resolveDefaultAsOfDate(financialYear);

  let report: PartyWisePurchaseReport | null = null;
  let errorMessage: string | null = null;
  try {
    report = await supplierReportService.getSupplierPurchaseSummary({ dateFrom, dateTo });
  } catch (error) {
    errorMessage = toActionErrorMessage(error);
  }

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Supplier Purchase Summary</h1>
          <p className="text-sm text-muted-foreground">Purchase value grouped by supplier, for the selected period.</p>
        </div>

        <SupplierReportFilterBar showDateRange />

        {errorMessage ? (
          <div className="rounded-2xl border border-dashed border-error/40 bg-error/5 p-4 text-sm text-error">{errorMessage}</div>
        ) : (
          <PartyWisePurchaseTable report={report!} />
        )}
      </div>
    </AppShell>
  );
}
