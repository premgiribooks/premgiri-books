import { redirect } from "next/navigation";
import { Info } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentFinancialYear } from "@/lib/current-financial-year";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { companySettingsService } from "@/modules/company/services/company-settings-service";
import { GstReportExportButton } from "@/modules/gst/components/gst-report-export-button";
import { Gstr1PeriodSelector } from "@/modules/gst/components/gstr1-period-selector";
import { Gstr2DocumentGroupTable } from "@/modules/gst/components/gstr2-document-group-table";
import { Gstr2NotTrackedSection } from "@/modules/gst/components/gstr2-not-tracked-section";
import { Gstr2PartyConsolidatedTable } from "@/modules/gst/components/gstr2-party-consolidated-table";
import { gstr2Service } from "@/modules/gst/services/gstr2-service";
import { getMonthlyPeriodOptions, getQuarterlyPeriodOptions } from "@/modules/gst/utils/gst-filing-periods";
import { isValidCalendarDate, toUtcDate } from "@/modules/gst/validation/gst-report-filters-schema";
import type { Gstr2Return } from "@/types/gstr2";

interface Gstr2PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function Gstr2Page({ searchParams }: Gstr2PageProps) {
  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "gst", "view");
  if (!canView) {
    redirect("/");
  }

  const resolvedParams = await searchParams;
  const [isAdmin, financialYear, settings] = await Promise.all([
    isCurrentUserCompanyAdmin(),
    getCurrentFinancialYear(),
    companySettingsService.getSettings(user.companyId),
  ]);

  if (!financialYear) {
    return (
      <AppShell isAdmin={isAdmin}>
        <div className="flex flex-col gap-6 p-6">
          <h1 className="text-xl font-semibold text-foreground">GSTR-2</h1>
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
            <p className="text-sm text-muted-foreground">Select a financial year to view GSTR-2.</p>
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

  let gstr2Return: Gstr2Return | null = null;
  if (selectedPeriod) {
    gstr2Return = await gstr2Service.getGstr2Return({
      from: toUtcDate(selectedPeriod.from),
      to: toUtcDate(selectedPeriod.to),
    });
  }

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-foreground">GSTR-2</h1>
            <p className="text-sm text-muted-foreground">
              Read-only reporting view in the original (suspended) GSTR-2 return&apos;s table shape, derived entirely from
              this company&apos;s own posted purchases.
            </p>
          </div>
          <GstReportExportButton />
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-3">
          <Info size={16} className="mt-0.5 shrink-0 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            This view is derived entirely from this company&apos;s own posted Purchase Invoices/Returns. It does not reflect
            GSTR-2A/2B or any GST-portal data — GSTR-2 was suspended by the GST department in 2017, and no GST Portal
            Integration exists in this codebase. There is no &quot;mark period filed&quot; workflow for this report.
          </p>
        </div>

        {selectedPeriod ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Gstr1PeriodSelector options={periodOptions} />
            </div>

            {gstr2Return ? (
              <div className="flex flex-col gap-8">
                <Gstr2DocumentGroupTable
                  groups={gstr2Return.registeredSupplies}
                  caveat={gstr2Return.registeredSuppliesCaveat}
                />
                <Gstr2NotTrackedSection
                  title="Table 4 — Inward Supplies on which Tax is to be Paid on Reverse Charge"
                  row={gstr2Return.reverseChargeSupplies}
                />
                <Gstr2NotTrackedSection
                  title="Table 5 — Inputs/Capital Goods Received from Overseas or from SEZ Units (Bill of Entry)"
                  row={gstr2Return.importsOverseasOrSez}
                />
                <Gstr2PartyConsolidatedTable
                  groups={gstr2Return.compositionAndExemptSupplies}
                  caveat={gstr2Return.compositionAndExemptCaveat}
                />
                <Gstr2NotTrackedSection title="Table 8 — ISD Credit Received" row={gstr2Return.isdCredit} />
                <Gstr2NotTrackedSection title="Table 9 — TDS and TCS Credit Received" row={gstr2Return.tdsTcsCredit} />
                <Gstr2NotTrackedSection title="Table 11 — Input Tax Credit Reversal/Reclaim" row={gstr2Return.itcReversal} />
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
