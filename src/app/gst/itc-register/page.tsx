import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { GstRegisterTable } from "@/modules/gst/components/gst-register-table";
import { GstReportExportButton } from "@/modules/gst/components/gst-report-export-button";
import { GstReportFilterBar } from "@/modules/gst/components/gst-report-filter-bar";
import { ItcRegisterEligibilityDisclaimer } from "@/modules/gst/components/itc-register-eligibility-disclaimer";
import { ItcRegisterHsnSummaryTable } from "@/modules/gst/components/itc-register-hsn-summary-table";
import { ItcRegisterPartySummaryTable } from "@/modules/gst/components/itc-register-party-summary-table";
import { ItcRegisterRateSummaryTable } from "@/modules/gst/components/itc-register-rate-summary-table";
import { ItcRegisterReconciliationTotal } from "@/modules/gst/components/itc-register-reconciliation-total";
import { gstRegisterService } from "@/modules/gst/services/gst-register-service";
import { itcRegisterService } from "@/modules/gst/services/itc-register-service";
import { gstReportFiltersSchema, toUtcDate } from "@/modules/gst/validation/gst-report-filters-schema";
import { ZERO_GST_REGISTER_TOTALS } from "@/types/gst-report";
import type { GstReportFilters } from "@/types/gst-report";
import type { ItcRegisterResult } from "@/types/itc-register";

interface ItcRegisterPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Same coercion convention as `/gst/registers` and `/gst/hsn-summary` — raw
 * query-string values in, every validation rule delegated to the shared
 * gstReportFiltersSchema. */
function parseFilters(params: Record<string, string | string[] | undefined>): GstReportFilters | null {
  const raw: Record<string, unknown> = {};

  const from = firstValue(params.from);
  if (from) {
    raw.from = from;
  }
  const to = firstValue(params.to);
  if (to) {
    raw.to = to;
  }
  const partyId = firstValue(params.partyId);
  if (partyId) {
    raw.partyId = partyId;
  }
  const hsnCode = firstValue(params.hsnCode);
  if (hsnCode) {
    raw.hsnCode = hsnCode;
  }
  const ratePercentRaw = firstValue(params.ratePercent);
  if (ratePercentRaw) {
    const ratePercent = Number(ratePercentRaw);
    if (Number.isFinite(ratePercent)) {
      raw.ratePercent = ratePercent;
    }
  }

  const result = gstReportFiltersSchema.safeParse(raw);
  if (!result.success) {
    return null;
  }

  const data = result.data;
  return {
    from: toUtcDate(data.from),
    to: toUtcDate(data.to),
    partyId: data.partyId,
    hsnCode: data.hsnCode,
    ratePercent: data.ratePercent,
  };
}

export default async function ItcRegisterPage({ searchParams }: ItcRegisterPageProps) {
  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "gst", "view");
  if (!canView) {
    redirect("/");
  }

  const resolvedParams = await searchParams;
  const isAdmin = await isCurrentUserCompanyAdmin();
  const filters = parseFilters(resolvedParams);

  const [result, partyOptions] = await Promise.all([
    filters ? itcRegisterService.getItcRegister(filters) : Promise.resolve(null as ItcRegisterResult | null),
    gstRegisterService.listPartyOptions("INWARD"),
  ]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-foreground">ITC Register</h1>
            <p className="text-sm text-muted-foreground">
              Rate-wise, party-wise, and HSN-wise breakdown of GSTR-3B&apos;s Table 4(A)(5) lump ITC figure.
            </p>
          </div>
          <GstReportExportButton />
        </div>

        <ItcRegisterEligibilityDisclaimer />

        <GstReportFilterBar partyOptions={partyOptions} partyLabel="Supplier" />

        {filters ? (
          <>
            <ItcRegisterReconciliationTotal totals={result?.totals ?? ZERO_GST_REGISTER_TOTALS} />
            <ItcRegisterRateSummaryTable groups={result?.rateWise ?? []} totals={result?.totals ?? ZERO_GST_REGISTER_TOTALS} />
            <ItcRegisterPartySummaryTable groups={result?.partyWise ?? []} totals={result?.totals ?? ZERO_GST_REGISTER_TOTALS} />
            <ItcRegisterHsnSummaryTable groups={result?.hsnWise ?? []} totals={result?.totals ?? ZERO_GST_REGISTER_TOTALS} />
            <GstRegisterTable lines={result?.lines ?? []} totals={result?.totals ?? ZERO_GST_REGISTER_TOTALS} />
          </>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
            <p className="text-sm text-muted-foreground">Select a From and To date to view the ITC Register.</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
