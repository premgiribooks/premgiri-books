import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { GstReportExportButton } from "@/modules/gst/components/gst-report-export-button";
import { GstReportFilterBar } from "@/modules/gst/components/gst-report-filter-bar";
import { HsnSummaryTable } from "@/modules/gst/components/hsn-summary-table";
import { gstRegisterService } from "@/modules/gst/services/gst-register-service";
import { hsnSummaryService } from "@/modules/gst/services/hsn-summary-service";
import { gstReportFiltersSchema, toUtcDate } from "@/modules/gst/validation/gst-report-filters-schema";
import type { GstReportFilters } from "@/types/gst-report";
import type { HsnSummaryResult } from "@/types/hsn-summary";

interface HsnSummaryPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const ZERO_TOTALS = { taxableAmount: 0, cgst: 0, sgst: 0, igst: 0, cess: 0, totalAmount: 0 };

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Same coercion convention as `/gst/registers` — raw query-string values in,
 * every validation rule delegated to the shared gstReportFiltersSchema. */
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

export default async function HsnSummaryPage({ searchParams }: HsnSummaryPageProps) {
  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "gst", "view");
  if (!canView) {
    redirect("/");
  }

  const resolvedParams = await searchParams;
  const isAdmin = await isCurrentUserCompanyAdmin();
  const filters = parseFilters(resolvedParams);

  const [result, partyOptions] = await Promise.all([
    filters ? hsnSummaryService.getHsnSummary(filters) : Promise.resolve(null as HsnSummaryResult | null),
    gstRegisterService.listPartyOptions("OUTWARD"),
  ]);

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-foreground">HSN Summary</h1>
            <p className="text-sm text-muted-foreground">
              HSN/SAC-wise turnover and tax summary — the same data GSTR-1&apos;s Table 12 embeds.
            </p>
          </div>
          <GstReportExportButton />
        </div>

        <GstReportFilterBar partyOptions={partyOptions} partyLabel="Customer" />

        {filters ? (
          <HsnSummaryTable rows={result?.rows ?? []} totals={result?.totals ?? ZERO_TOTALS} />
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
            <p className="text-sm text-muted-foreground">Select a From and To date to view the HSN Summary.</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
