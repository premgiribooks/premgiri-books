import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { toActionErrorMessage } from "@/lib/action-error";
import { getCurrentFinancialYear } from "@/lib/current-financial-year";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import type { BalanceSheetReport } from "@/engines/reporting/types";
import { financialYearService } from "@/modules/financial-year/services/financial-year-service";
import { BalanceSheetStatement } from "@/modules/reports/components/balance-sheet-statement";
import { FinancialYearAsOfDateFilterBar } from "@/modules/reports/components/financial-year-as-of-date-filter-bar";
import { ReportExportButton } from "@/modules/reports/components/report-export-button";
import { balanceSheetService } from "@/modules/reports/services/balance-sheet-service";
import { isValidCalendarDate, resolveDefaultAsOfDate } from "@/modules/reports/validation/financial-report-filters-schema";

interface BalanceSheetPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function BalanceSheetPage({ searchParams }: BalanceSheetPageProps) {
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
          <h1 className="text-xl font-semibold text-foreground">Balance Sheet</h1>
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
            <p className="text-sm text-muted-foreground">Create a financial year before viewing the Balance Sheet.</p>
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

  let report: BalanceSheetReport | null = null;
  let errorMessage: string | null = null;
  try {
    report = await balanceSheetService.getBalanceSheet({
      financialYearId: selectedFinancialYear.id,
      asOfDate,
    });
  } catch (error) {
    errorMessage = toActionErrorMessage(error);
  }

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Balance Sheet</h1>
            <p className="text-sm text-muted-foreground">
              Assets, Liabilities, and Equity as of the selected date, including the current period&apos;s Profit &amp;
              Loss plug.
            </p>
          </div>
          <ReportExportButton />
        </div>

        <FinancialYearAsOfDateFilterBar
          financialYears={financialYears}
          selectedFinancialYearId={selectedFinancialYear.id}
          asOfDate={asOfDate}
        />

        {errorMessage ? (
          <div className="rounded-2xl border border-dashed border-error/40 bg-error/5 p-4 text-sm text-error">{errorMessage}</div>
        ) : (
          <BalanceSheetStatement report={report!} />
        )}
      </div>
    </AppShell>
  );
}
