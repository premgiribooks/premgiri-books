import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { toActionErrorMessage } from "@/lib/action-error";
import { getCurrentFinancialYear } from "@/lib/current-financial-year";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import type { LiabilitySettlementReport } from "@/types/liability-settlement";
import { liabilitySettlementService } from "@/modules/liability-settlement/services/liability-settlement-service";
import { LiabilitySettlementTable } from "@/modules/liability-settlement/components/liability-settlement-table";
import { financialYearService } from "@/modules/financial-year/services/financial-year-service";
import { FinancialYearAsOfDateFilterBar } from "@/modules/reports/components/financial-year-as-of-date-filter-bar";
import { isValidCalendarDate, resolveDefaultAsOfDate } from "@/modules/reports/validation/financial-report-filters-schema";

interface LiabilitySettlementPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LiabilitySettlementPage({ searchParams }: LiabilitySettlementPageProps) {
  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "accounting", "view");
  if (!canView) {
    redirect("/");
  }

  const resolvedParams = await searchParams;
  const [isAdmin, canSettle, financialYears, activeFinancialYear] = await Promise.all([
    isCurrentUserCompanyAdmin(),
    hasPermission(user, "accounting", "create"),
    financialYearService.listFinancialYears(user.companyId),
    getCurrentFinancialYear(),
  ]);

  if (financialYears.length === 0) {
    return (
      <AppShell isAdmin={isAdmin}>
        <div className="flex flex-col gap-6 p-6">
          <h1 className="text-xl font-semibold text-foreground">Liability Settlement</h1>
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
            <p className="text-sm text-muted-foreground">Create a financial year before viewing Liability Settlement.</p>
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

  let report: LiabilitySettlementReport | null = null;
  let errorMessage: string | null = null;
  try {
    report = await liabilitySettlementService.getOutstandingLiabilities({
      financialYearId: selectedFinancialYear.id,
      asOfDate,
    });
  } catch (error) {
    errorMessage = toActionErrorMessage(error);
  }

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Liability Settlement</h1>
          <p className="text-sm text-muted-foreground">
            Every liability ledger with an outstanding balance as of the selected date — settle one straight into Payment
            Voucher.
          </p>
        </div>

        <FinancialYearAsOfDateFilterBar
          financialYears={financialYears}
          selectedFinancialYearId={selectedFinancialYear.id}
          asOfDate={asOfDate}
        />

        {errorMessage ? (
          <div className="rounded-2xl border border-dashed border-error/40 bg-error/5 p-4 text-sm text-error">{errorMessage}</div>
        ) : (
          <LiabilitySettlementTable report={report!} canSettle={canSettle} />
        )}
      </div>
    </AppShell>
  );
}
