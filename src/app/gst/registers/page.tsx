import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { GstReportExportButton } from "@/modules/gst/components/gst-report-export-button";
import { GstReportFilterBar } from "@/modules/gst/components/gst-report-filter-bar";
import { GstRegisterTable } from "@/modules/gst/components/gst-register-table";
import { GstRegisterTypeToggle } from "@/modules/gst/components/gst-register-type-toggle";
import { gstRegisterService } from "@/modules/gst/services/gst-register-service";
import { isValidCalendarDate, toUtcDate } from "@/modules/gst/validation/gst-report-filters-schema";
import type { GstRegisterResult, GstRegisterType, GstReportFilters } from "@/types/gst-report";

interface GstRegistersPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const ZERO_TOTALS = { taxableAmount: 0, cgst: 0, sgst: 0, igst: 0, cess: 0, totalAmount: 0 };

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseFilters(params: Record<string, string | string[] | undefined>): GstReportFilters | null {
  const from = firstValue(params.from);
  const to = firstValue(params.to);
  if (!from || !to || !isValidCalendarDate(from) || !isValidCalendarDate(to)) {
    return null;
  }
  if (toUtcDate(to).getTime() < toUtcDate(from).getTime()) {
    return null;
  }

  const filters: GstReportFilters = { from: toUtcDate(from), to: toUtcDate(to) };

  const partyId = firstValue(params.partyId);
  if (partyId) {
    filters.partyId = partyId;
  }

  const hsnCode = firstValue(params.hsnCode);
  if (hsnCode) {
    filters.hsnCode = hsnCode;
  }

  const ratePercentRaw = firstValue(params.ratePercent);
  if (ratePercentRaw) {
    const ratePercent = Number(ratePercentRaw);
    if (Number.isFinite(ratePercent)) {
      filters.ratePercent = ratePercent;
    }
  }

  const pageRaw = firstValue(params.page);
  if (pageRaw) {
    const page = Number(pageRaw);
    if (Number.isInteger(page) && page > 0) {
      filters.page = page;
    }
  }

  return filters;
}

function toQueryString(params: Record<string, string | string[] | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "type") {
      continue;
    }
    const first = firstValue(value);
    if (first) {
      search.set(key, first);
    }
  }
  return search.toString();
}

export default async function GstRegistersPage({ searchParams }: GstRegistersPageProps) {
  const user = await getCurrentCompanyUser();
  const canView = await hasPermission(user, "gst", "view");
  if (!canView) {
    redirect("/");
  }

  const resolvedParams = await searchParams;
  const isAdmin = await isCurrentUserCompanyAdmin();

  const registerType: GstRegisterType = firstValue(resolvedParams.type) === "INWARD" ? "INWARD" : "OUTWARD";
  const filters = parseFilters(resolvedParams);

  let result: GstRegisterResult | null = null;
  if (filters) {
    result =
      registerType === "OUTWARD"
        ? await gstRegisterService.getOutwardRegister(filters)
        : await gstRegisterService.getInwardRegister(filters);
  }

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-foreground">GST Registers</h1>
            <p className="text-sm text-muted-foreground">
              Line-level outward and inward supply registers for every posted GST document.
            </p>
          </div>
          <GstReportExportButton />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <GstRegisterTypeToggle active={registerType} queryString={toQueryString(resolvedParams)} />
        </div>

        <GstReportFilterBar />

        {filters ? (
          <GstRegisterTable lines={result?.lines ?? []} totals={result?.totals ?? ZERO_TOTALS} />
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
            <p className="text-sm text-muted-foreground">Select a From and To date to view the register.</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
