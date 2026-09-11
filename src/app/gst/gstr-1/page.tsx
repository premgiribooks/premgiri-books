import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentFinancialYear } from "@/lib/current-financial-year";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { companySettingsService } from "@/modules/company/services/company-settings-service";
import { GstReportExportButton } from "@/modules/gst/components/gst-report-export-button";
import { Gstr1B2bTable } from "@/modules/gst/components/gstr1-b2b-table";
import { Gstr1B2cTable } from "@/modules/gst/components/gstr1-b2c-table";
import { Gstr1CreditDebitNoteTable } from "@/modules/gst/components/gstr1-credit-debit-note-table";
import { markGstr1PeriodFiledAction, reopenGstr1PeriodAction } from "@/modules/gst/actions/gstr1-actions";
import { Gstr1FilingStatusBanner } from "@/modules/gst/components/gstr1-filing-status-banner";
import { Gstr1NilRatedTable } from "@/modules/gst/components/gstr1-nil-rated-table";
import { Gstr1PeriodSelector } from "@/modules/gst/components/gstr1-period-selector";
import { gstr1Service } from "@/modules/gst/services/gstr1-service";
import { HsnSummaryTable } from "@/modules/gst/components/hsn-summary-table";
import { hsnSummaryService } from "@/modules/gst/services/hsn-summary-service";
import { isValidCalendarDate, toUtcDate } from "@/modules/gst/validation/gst-report-filters-schema";
import { getMonthlyPeriodOptions, getQuarterlyPeriodOptions } from "@/modules/gst/utils/gst-filing-periods";
import type { GstFilingRecord, Gstr1Return } from "@/types/gstr1";
import type { HsnSummaryResult } from "@/types/hsn-summary";

interface Gstr1PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const ZERO_TOTALS = { taxableAmount: 0, cgst: 0, sgst: 0, igst: 0, cess: 0, totalAmount: 0 };

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function Gstr1Page({ searchParams }: Gstr1PageProps) {
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
          <h1 className="text-xl font-semibold text-foreground">GSTR-1</h1>
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
            <p className="text-sm text-muted-foreground">Select a financial year to view GSTR-1.</p>
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

  let gstr1Return: Gstr1Return | null = null;
  let filingRecord: GstFilingRecord | null = null;
  let hsnSummary: HsnSummaryResult | null = null;

  if (selectedPeriod) {
    const periodStart = toUtcDate(selectedPeriod.from);
    const periodEnd = toUtcDate(selectedPeriod.to);
    [gstr1Return, filingRecord, hsnSummary] = await Promise.all([
      gstr1Service.getGstr1Return({ from: periodStart, to: periodEnd }),
      gstr1Service.getFilingRecord(periodStart, periodEnd),
      // Table 12 delegates entirely to 60-hsn-summary.md's own output — no
      // independent HSN aggregation query here.
      hsnSummaryService.getHsnSummary({ from: periodStart, to: periodEnd }),
    ]);
  }

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-foreground">GSTR-1</h1>
            <p className="text-sm text-muted-foreground">Statutory outward-supply return, classified from the GST Registers.</p>
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
              onMarkFiled={markGstr1PeriodFiledAction}
              onReopen={reopenGstr1PeriodAction}
            />

            {gstr1Return ? (
              <div className="flex flex-col gap-8">
                <Gstr1B2bTable groups={gstr1Return.b2b} />
                <Gstr1B2cTable variant="large" groups={gstr1Return.b2cLarge} />
                <Gstr1B2cTable variant="small" groups={gstr1Return.b2cSmall} />
                <Gstr1NilRatedTable groups={gstr1Return.nilRated} />
                <Gstr1CreditDebitNoteTable
                  registered={gstr1Return.creditDebitNotesRegistered}
                  unregistered={gstr1Return.creditDebitNotesUnregistered}
                />

                <div className="flex flex-col gap-3">
                  <h3 className="text-sm font-semibold text-foreground">Table 12 — HSN Summary</h3>
                  <HsnSummaryTable rows={hsnSummary?.rows ?? []} totals={hsnSummary?.totals ?? ZERO_TOTALS} />
                </div>
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
