import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentFinancialYear } from "@/lib/current-financial-year";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { companySettingsService } from "@/modules/company/services/company-settings-service";
import { GstReportExportButton } from "@/modules/gst/components/gst-report-export-button";
import { markGstr3BPeriodFiledAction, reopenGstr3BPeriodAction } from "@/modules/gst/actions/gstr3b-actions";
import { Gstr1FilingStatusBanner } from "@/modules/gst/components/gstr1-filing-status-banner";
import { Gstr1PeriodSelector } from "@/modules/gst/components/gstr1-period-selector";
import { Gstr3bEligibleItcTable } from "@/modules/gst/components/gstr3b-eligible-itc-table";
import { Gstr3bExemptInwardTable } from "@/modules/gst/components/gstr3b-exempt-inward-table";
import { Gstr3bInterestLateFeeNote } from "@/modules/gst/components/gstr3b-interest-late-fee-note";
import { Gstr3bInterStateSuppliesTable } from "@/modules/gst/components/gstr3b-inter-state-supplies-table";
import { Gstr3bOutwardSuppliesTable } from "@/modules/gst/components/gstr3b-outward-supplies-table";
import { gstr3bService } from "@/modules/gst/services/gstr3b-service";
import { getMonthlyPeriodOptions, getQuarterlyPeriodOptions } from "@/modules/gst/utils/gst-filing-periods";
import { isValidCalendarDate, toUtcDate } from "@/modules/gst/validation/gst-report-filters-schema";
import type { GstFilingRecord } from "@/types/gstr1";
import type { Gstr3bReturn } from "@/types/gstr3b";

interface Gstr3bPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function Gstr3bPage({ searchParams }: Gstr3bPageProps) {
  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "gst", "view");
  if (!canView) {
    redirect("/");
  }

  const resolvedParams = await searchParams;
  const [isAdmin, canApprove, financialYear, settings] = await Promise.all([
    isCurrentUserCompanyAdmin(),
    hasPermission(user, "gst", "approve"),
    getCurrentFinancialYear(),
    companySettingsService.getSettings(user.companyId),
  ]);

  if (!financialYear) {
    return (
      <AppShell isAdmin={isAdmin}>
        <div className="flex flex-col gap-6 p-6">
          <h1 className="text-xl font-semibold text-foreground">GSTR-3B</h1>
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
            <p className="text-sm text-muted-foreground">Select a financial year to view GSTR-3B.</p>
          </div>
        </div>
      </AppShell>
    );
  }

  const frequency = settings?.gstFilingFrequency ?? "MONTHLY";
  const periodOptions =
    frequency === "MONTHLY"
      ? getMonthlyPeriodOptions(financialYear.startDate, financialYear.endDate)
      : getQuarterlyPeriodOptions(financialYear.startDate, financialYear.endDate);

  const fromParam = firstValue(resolvedParams.from);
  const toParam = firstValue(resolvedParams.to);
  const hasValidPeriod = fromParam && toParam && isValidCalendarDate(fromParam) && isValidCalendarDate(toParam);
  const selectedPeriod = hasValidPeriod ? { from: fromParam, to: toParam } : periodOptions[0];

  let gstr3bReturn: Gstr3bReturn | null = null;
  let filingRecord: GstFilingRecord | null = null;

  if (selectedPeriod) {
    const periodStart = toUtcDate(selectedPeriod.from);
    const periodEnd = toUtcDate(selectedPeriod.to);
    [gstr3bReturn, filingRecord] = await Promise.all([
      gstr3bService.getGstr3BReturn({ from: periodStart, to: periodEnd }),
      gstr3bService.getFilingRecord(periodStart, periodEnd),
    ]);
  }

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-foreground">GSTR-3B</h1>
            <p className="text-sm text-muted-foreground">
              Summary outward tax liability and Input Tax Credit, derived from the GST Registers.
            </p>
          </div>
          <GstReportExportButton />
        </div>

        {selectedPeriod ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Gstr1PeriodSelector options={periodOptions} />
            </div>

            <Gstr1FilingStatusBanner
              periodStart={selectedPeriod.from}
              periodEnd={selectedPeriod.to}
              filingRecord={filingRecord}
              canApprove={canApprove}
              onMarkFiled={markGstr3BPeriodFiledAction}
              onReopen={reopenGstr3BPeriodAction}
            />

            {gstr3bReturn ? (
              <div className="flex flex-col gap-8">
                <Gstr3bOutwardSuppliesTable outwardSupplies={gstr3bReturn.outwardSupplies} />
                <Gstr3bInterStateSuppliesTable interStateSupplies={gstr3bReturn.interStateSupplies} />
                <Gstr3bEligibleItcTable eligibleItc={gstr3bReturn.eligibleItc} />
                <Gstr3bExemptInwardTable exemptInwardSupplies={gstr3bReturn.exemptInwardSupplies} />
                <Gstr3bInterestLateFeeNote interestLateFee={gstr3bReturn.interestLateFee} />
              </div>
            ) : null}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
            <p className="text-sm text-muted-foreground">No filing period available for the active financial year.</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
