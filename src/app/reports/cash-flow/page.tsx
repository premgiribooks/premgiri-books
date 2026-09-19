import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { toActionErrorMessage } from "@/lib/action-error";
import { getCurrentFinancialYear } from "@/lib/current-financial-year";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import type { CashFlowReport } from "@/engines/reporting/types";
import { financialYearService } from "@/modules/financial-year/services/financial-year-service";
import { CashFlowStatement } from "@/modules/reports/components/cash-flow-statement";
import { FinancialYearDateRangeFilterBar } from "@/modules/reports/components/financial-year-date-range-filter-bar";
import { ReportExportButton } from "@/modules/reports/components/report-export-button";
import { cashFlowService } from "@/modules/reports/services/cash-flow-service";
import { isValidCalendarDate, resolveDefaultAsOfDate, toCalendarDateString } from "@/modules/reports/validation/financial-report-filters-schema";

interface CashFlowPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CashFlowPage({ searchParams }: CashFlowPageProps) {
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
          <h1 className="text-xl font-semibold text-foreground">Cash Flow</h1>
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
            <p className="text-sm text-muted-foreground">Create a financial year before viewing Cash Flow.</p>
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

  const fromParam = firstValue(resolvedParams.from);
  const from = fromParam && isValidCalendarDate(fromParam) ? fromParam : toCalendarDateString(selectedFinancialYear.startDate);

  const toParam = firstValue(resolvedParams.to);
  const to = toParam && isValidCalendarDate(toParam) ? toParam : resolveDefaultAsOfDate(selectedFinancialYear);

  let report: CashFlowReport | null = null;
  let errorMessage: string | null = null;
  try {
    report = await cashFlowService.getCashFlow({
      financialYearId: selectedFinancialYear.id,
      from,
      to,
    });
  } catch (error) {
    errorMessage = toActionErrorMessage(error);
  }

  const exportParams = new URLSearchParams({ financialYearId: selectedFinancialYear.id, from, to });

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Cash Flow</h1>
            <p className="text-sm text-muted-foreground">
              Net change in cash and cash equivalents for the selected period, by Operating, Investing, and Financing
              activity.
            </p>
          </div>
          <ReportExportButton
            downloadUrl={`/reports/cash-flow/export?${exportParams.toString()}`}
            pdfDownloadUrl={`/reports/cash-flow/export?${exportParams.toString()}&format=pdf`}
          />
        </div>

        <FinancialYearDateRangeFilterBar
          financialYears={financialYears}
          selectedFinancialYearId={selectedFinancialYear.id}
          from={from}
          to={to}
        />

        {errorMessage ? (
          <div className="rounded-2xl border border-dashed border-error/40 bg-error/5 p-4 text-sm text-error">{errorMessage}</div>
        ) : (
          <CashFlowStatement report={report!} />
        )}
      </div>
    </AppShell>
  );
}
