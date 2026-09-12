import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { toActionErrorMessage } from "@/lib/action-error";
import { getCurrentFinancialYear } from "@/lib/current-financial-year";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { CustomerOutstandingTable } from "@/modules/reports/customers/components/customer-outstanding-table";
import { CustomerReportFilterBar } from "@/modules/reports/customers/components/customer-report-filter-bar";
import { customerReportService } from "@/modules/reports/customers/services/customer-report-service";
import { financialYearService } from "@/modules/financial-year/services/financial-year-service";
import { isValidCalendarDate, resolveDefaultAsOfDate } from "@/modules/reports/validation/financial-report-filters-schema";
import type { CustomerOutstandingReport } from "@/types/customer-report";

interface CustomerOutstandingPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CustomerOutstandingPage({ searchParams }: CustomerOutstandingPageProps) {
  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "reports", "view");
  if (!canView) {
    redirect("/");
  }

  const resolvedParams = await searchParams;
  const [isAdmin, financialYears, activeFinancialYear] = await Promise.all([
    isCurrentUserCompanyAdmin(),
    financialYearService.listFinancialYears(user.companyId),
    getCurrentFinancialYear(),
  ]);

  if (financialYears.length === 0) {
    return (
      <AppShell isAdmin={isAdmin}>
        <div className="flex flex-col gap-6 p-6">
          <h1 className="text-xl font-semibold text-foreground">Customer Outstanding</h1>
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
            <p className="text-sm text-muted-foreground">Create a financial year before viewing the Customer Outstanding Report.</p>
          </div>
        </div>
      </AppShell>
    );
  }

  const financialYearIdParam = firstValue(resolvedParams.financialYearId);
  const selectedFinancialYear =
    financialYears.find((financialYear) => financialYear.id === financialYearIdParam) ??
    financialYears.find((financialYear) => financialYear.id === activeFinancialYear?.id) ??
    financialYears.find((financialYear) => financialYear.isCurrent) ??
    financialYears[0];

  const asOfDateParam = firstValue(resolvedParams.asOfDate);
  const asOfDate =
    asOfDateParam && isValidCalendarDate(asOfDateParam) ? asOfDateParam : resolveDefaultAsOfDate(selectedFinancialYear);

  const statusParam = firstValue(resolvedParams.status);
  const status = statusParam === "all" || statusParam === "inactive" ? statusParam : "active";

  let report: CustomerOutstandingReport | null = null;
  let errorMessage: string | null = null;
  try {
    report = await customerReportService.getCustomerOutstandingReport({
      financialYearId: selectedFinancialYear.id,
      asOfDate,
      status,
    });
  } catch (error) {
    errorMessage = toActionErrorMessage(error);
  }

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Customer Outstanding</h1>
          <p className="text-sm text-muted-foreground">Balance owed by each customer as of the selected date, compared against their credit limit.</p>
        </div>

        <CustomerReportFilterBar
          financialYears={financialYears}
          selectedFinancialYearId={selectedFinancialYear.id}
          asOfDate={asOfDate}
          showStatus
        />

        {errorMessage ? (
          <div className="rounded-2xl border border-dashed border-error/40 bg-error/5 p-4 text-sm text-error">{errorMessage}</div>
        ) : (
          <CustomerOutstandingTable report={report!} />
        )}
      </div>
    </AppShell>
  );
}
