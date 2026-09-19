import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { toActionErrorMessage } from "@/lib/action-error";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { hasPermission, isCurrentUserCompanyAdmin } from "@/lib/permissions";
import { HsnSummaryTable } from "@/modules/gst/components/hsn-summary-table";
import { isValidCalendarDate } from "@/modules/gst/validation/gst-report-filters-schema";
import { GstDashboardFilterBar } from "@/modules/reports/components/gst-dashboard-filter-bar";
import { GstSummaryTiles } from "@/modules/reports/components/gst-summary-tiles";
import { GstTrendTable } from "@/modules/reports/components/gst-trend-table";
import { ReportExportButton } from "@/modules/reports/components/report-export-button";
import { gstReportsService } from "@/modules/reports/services/gst-reports-service";
import { toCalendarDateString } from "@/modules/reports/validation/financial-report-filters-schema";
import type { GstDashboardReport } from "@/types/gst-dashboard";

interface GstReportsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Default range: the last 6 calendar months up to and including today — 74-gst-reports.md's UI note ("typically defaulting to the last 6 or 12 months"). */
function defaultRange(): { from: string; to: string } {
  const today = new Date();
  const to = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const from = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth() - 5, 1));
  return { from: toCalendarDateString(from), to: toCalendarDateString(to) };
}

export default async function GstReportsPage({ searchParams }: GstReportsPageProps) {
  const user = await getCurrentCompanyUser();
  const [canViewReports, canViewGst] = await Promise.all([
    hasPermission(user, "reports", "view"),
    hasPermission(user, "gst", "view"),
  ]);
  if (!canViewReports || !canViewGst) {
    redirect("/");
  }

  const resolvedParams = await searchParams;
  const isAdmin = await isCurrentUserCompanyAdmin();

  const defaults = defaultRange();
  const fromParam = firstValue(resolvedParams.from);
  const from = fromParam && isValidCalendarDate(fromParam) ? fromParam : defaults.from;
  const toParam = firstValue(resolvedParams.to);
  const to = toParam && isValidCalendarDate(toParam) ? toParam : defaults.to;

  let report: GstDashboardReport | null = null;
  let errorMessage: string | null = null;
  try {
    report = await gstReportsService.getGstDashboard({ from, to });
  } catch (error) {
    errorMessage = toActionErrorMessage(error);
  }

  const exportParams = new URLSearchParams({ from, to });

  return (
    <AppShell isAdmin={isAdmin}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-foreground">GST Reports</h1>
            <p className="text-sm text-muted-foreground">
              Output Tax vs. Input Tax vs. Net Liability trend, an HSN/rate-wise breakdown, and each month&apos;s
              filing status — for filing itself, see{" "}
              <a href="/gst/gstr-1" className="underline underline-offset-2">
                GSTR-1
              </a>{" "}
              or{" "}
              <a href="/gst/gstr-3b" className="underline underline-offset-2">
                GSTR-3B
              </a>
              .
            </p>
          </div>
          <ReportExportButton downloadUrl={`/reports/gst/export?${exportParams.toString()}`} />
        </div>

        <GstDashboardFilterBar from={from} to={to} />

        {errorMessage ? (
          <div className="rounded-2xl border border-dashed border-error/40 bg-error/5 p-4 text-sm text-error">{errorMessage}</div>
        ) : (
          <>
            <GstSummaryTiles totals={report!.totals} />
            <GstTrendTable months={report!.months} totals={report!.totals} />

            <div>
              <h2 className="text-lg font-semibold text-foreground">HSN/Rate-wise Breakdown</h2>
              <p className="text-sm text-muted-foreground">Same data as the HSN Summary screen, for the selected range.</p>
            </div>
            <HsnSummaryTable rows={report!.hsnSummary.rows} totals={report!.hsnSummary.totals} />
          </>
        )}
      </div>
    </AppShell>
  );
}
