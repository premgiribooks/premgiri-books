import { buildGstDashboardReport, resolveMonthlyFilingStatus } from "@/engines/reporting/gst-dashboard";
import { getInwardSupplyLines, getOutwardSupplyLines } from "@/engines/gst/gst-report-queries";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { assertPermission } from "@/lib/permissions";
import { gstFilingRepository } from "@/modules/gst/repositories/gst-filing-repository";
import { hsnSummaryService } from "@/modules/gst/services/hsn-summary-service";
import { gstReportFiltersSchema, toUtcDate, type GstReportFiltersInput } from "@/modules/gst/validation/gst-report-filters-schema";
import type { GstDashboardReport, GstDashboardTotals } from "@/types/gst-dashboard";

function sumTotals(months: readonly { outputTax: number; inputTax: number; netLiability: number }[]): GstDashboardTotals {
  return months.reduce<GstDashboardTotals>(
    (totals, month) => ({
      outputTax: totals.outputTax + month.outputTax,
      inputTax: totals.inputTax + month.inputTax,
      netLiability: totals.netLiability + month.netLiability,
    }),
    { outputTax: 0, inputTax: 0, netLiability: 0 }
  );
}

/**
 * 74-gst-reports.md's GST Reports module — the only I/O for this spec.
 * Gated on **both** `reports`/`view` and `gst`/`view` (Security): the same
 * tax-liability figures GST Registers/GSTR-1/GSTR-3B gate behind `gst`/
 * `view` carry the identical confidentiality boundary here, so `reports`/
 * `view` alone is not enough. Adds zero new GST aggregation queries — every
 * figure comes from `getOutwardSupplyLines`/`getInwardSupplyLines` (spec 57),
 * `hsnSummaryService.getHsnSummary` (spec 60), and `gstFilingRepository`
 * (spec 58, read-only here). Read-only throughout — never calls
 * `markPeriodFiled`/`reopenPeriod`.
 */
export const gstReportsService = {
  async getGstDashboard(rawFilters: GstReportFiltersInput): Promise<GstDashboardReport> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "reports", "view");
    await assertPermission(user, "gst", "view");

    const filters = gstReportFiltersSchema.parse(rawFilters);
    const from = toUtcDate(filters.from);
    const to = toUtcDate(filters.to);

    const [outwardLines, inwardLines, hsnSummary, filingRecords] = await Promise.all([
      getOutwardSupplyLines(user.companyId, from, to),
      getInwardSupplyLines(user.companyId, from, to),
      hsnSummaryService.getHsnSummary({ from, to }),
      gstFilingRepository.findMany(user.companyId, "GSTR1", from, to),
    ]);

    const trend = buildGstDashboardReport(outwardLines, inwardLines);
    const filingOverlay = resolveMonthlyFilingStatus(
      trend.months.map((month) => month.month),
      filingRecords
    );

    const months = trend.months.map((month) => ({
      ...month,
      ...(filingOverlay.get(month.month) ?? { status: null, periodStart: null, periodEnd: null }),
    }));

    return { months, totals: sumTotals(months), hsnSummary };
  },
};
