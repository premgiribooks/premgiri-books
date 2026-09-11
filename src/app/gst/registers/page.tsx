import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { GstReportExportButton } from "@/modules/gst/components/gst-report-export-button";
import { GstReportFilterBar } from "@/modules/gst/components/gst-report-filter-bar";
import { GstRegisterPagination } from "@/modules/gst/components/gst-register-pagination";
import { GstRegisterTable } from "@/modules/gst/components/gst-register-table";
import { GstRegisterTypeToggle } from "@/modules/gst/components/gst-register-type-toggle";
import { gstRegisterService } from "@/modules/gst/services/gst-register-service";
import { gstReportFiltersSchema, toUtcDate } from "@/modules/gst/validation/gst-report-filters-schema";
import type { GstRegisterResult, GstRegisterType, GstReportFilters } from "@/types/gst-report";

interface GstRegistersPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const ZERO_TOTALS = { taxableAmount: 0, cgst: 0, sgst: 0, igst: 0, cess: 0, totalAmount: 0 };
const PARTY_LABEL: Record<GstRegisterType, string> = { OUTWARD: "Customer", INWARD: "Supplier" };

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Coerces raw URL query-string values (all strings/arrays) into the shape
 * gstReportFiltersSchema.safeParse expects, then delegates every actual
 * validation rule (date format, uuid format, to>=from, pageSize cap) to
 * that shared schema instead of re-implementing it here. */
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
  const pageRaw = firstValue(params.page);
  if (pageRaw) {
    const page = Number(pageRaw);
    if (Number.isInteger(page)) {
      raw.page = page;
    }
  }
  const pageSizeRaw = firstValue(params.pageSize);
  if (pageSizeRaw) {
    const pageSize = Number(pageSizeRaw);
    if (Number.isInteger(pageSize)) {
      raw.pageSize = pageSize;
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
    page: data.page,
    pageSize: data.pageSize,
  };
}

/** The current query string with the given keys removed — the component
 * receiving it is responsible for re-adding its own key (type/page). */
function queryStringExcluding(params: Record<string, string | string[] | undefined>, exclude: readonly string[]): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (exclude.includes(key)) {
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

  const [result, partyOptions] = await Promise.all([
    filters
      ? registerType === "OUTWARD"
        ? gstRegisterService.getOutwardRegister(filters)
        : gstRegisterService.getInwardRegister(filters)
      : Promise.resolve(null as GstRegisterResult | null),
    gstRegisterService.listPartyOptions(registerType),
  ]);

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
          <GstRegisterTypeToggle active={registerType} queryString={queryStringExcluding(resolvedParams, ["type", "page"])} />
        </div>

        <GstReportFilterBar partyOptions={partyOptions} partyLabel={PARTY_LABEL[registerType]} />

        {filters ? (
          <>
            <GstRegisterTable lines={result?.lines ?? []} totals={result?.totals ?? ZERO_TOTALS} />
            {result ? (
              <GstRegisterPagination
                page={result.page}
                pageSize={result.pageSize}
                totalCount={result.totalCount}
                queryString={queryStringExcluding(resolvedParams, ["page"])}
              />
            ) : null}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
            <p className="text-sm text-muted-foreground">Select a From and To date to view the register.</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
