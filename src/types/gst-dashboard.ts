import type { GstFilingStatus } from "@prisma/client";

import type { HsnSummaryResult } from "@/types/hsn-summary";

// 74-gst-reports.md — the GST Reports dashboard's own response shapes.
// Every figure here is read verbatim from GstSupplyLine (57-gst-registers.md)
// or HsnSummaryResult (60-hsn-summary.md) — this module invents no GST
// arithmetic of its own, only month-bucketing and totals.

/** One calendar month's bucketed Output/Input/Net figures — engines/reporting/gst-dashboard.ts's pure output. */
export interface GstDashboardMonth {
  /** `YYYY-MM`, the calendar month of the bucketed lines' `documentDate`. */
  month: string;
  outputTax: number;
  inputTax: number;
  /** `outputTax - inputTax` — may be negative (a heavy-purchasing month), never clamped. */
  netLiability: number;
}

export interface GstDashboardTrend {
  /** Sorted chronologically; a month with no outward/inward lines at all is omitted, not zero-filled. */
  months: GstDashboardMonth[];
}

/**
 * Read-only Filed/Open overlay for one bucketed month, resolved from a
 * `GstFilingRecord` (GSTR1) whose `[periodStart, periodEnd]` range contains
 * the month — `status: null` means no matching filing record exists for
 * that period. A quarterly filer's single record spans 3 calendar months,
 * so those 3 months all resolve to the same `periodStart`/`periodEnd`/
 * `status` here, never 3 independent per-month flags.
 */
export interface GstDashboardFilingOverlay {
  status: GstFilingStatus | null;
  periodStart: Date | null;
  periodEnd: Date | null;
}

export type GstDashboardMonthRow = GstDashboardMonth & GstDashboardFilingOverlay;

export interface GstDashboardTotals {
  outputTax: number;
  inputTax: number;
  netLiability: number;
}

/** gstDashboardService.getGstDashboard's full composed response. */
export interface GstDashboardReport {
  months: GstDashboardMonthRow[];
  totals: GstDashboardTotals;
  /** hsnSummaryService.getHsnSummary's own output for the whole selected range, embedded unmodified. */
  hsnSummary: HsnSummaryResult;
}
