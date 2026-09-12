import { AppError } from "@/lib/app-error";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { assertPermission } from "@/lib/permissions";
import { voucherQueries } from "@/engines/voucher/voucher-queries";
import { buildBalanceSheetReport } from "@/engines/reporting/balance-sheet";
import type { BalanceSheetReport } from "@/engines/reporting/types";
import { ledgerGroupRepository } from "@/modules/ledger-groups/repositories/ledger-group-repository";
import { financialYearService } from "@/modules/financial-year/services/financial-year-service";
import { profitAndLossService } from "@/modules/reports/services/profit-and-loss-service";
import {
  toCalendarDateString,
  toUtcDate,
  trialBalanceFiltersSchema,
  type TrialBalanceFiltersInput,
} from "@/modules/reports/validation/financial-report-filters-schema";

/**
 * The only I/O this module performs — resolves the Financial Year
 * (re-validating `asOfDate` against its range), calls
 * voucherEngine.getTrialBalance, profitAndLossService.getProfitAndLoss
 * (FY-to-date, ending exactly at `asOfDate` — never re-derived independently,
 * 66-balance-sheet.md's Business Rules), and ledgerGroupRepository.findMany
 * in parallel, and hands the results to buildBalanceSheetReport (pure). No
 * repository of its own, per 66-balance-sheet.md's Data Model.
 */
export const balanceSheetService = {
  async getBalanceSheet(rawFilters: TrialBalanceFiltersInput): Promise<BalanceSheetReport> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "reports", "view");

    const filters = trialBalanceFiltersSchema.parse(rawFilters);

    const financialYear = await financialYearService.getFinancialYear(filters.financialYearId);
    if (!financialYear || financialYear.companyId !== user.companyId) {
      throw new AppError("Financial year not found.");
    }

    const asOfDate = toUtcDate(filters.asOfDate);
    if (asOfDate.getTime() < financialYear.startDate.getTime() || asOfDate.getTime() > financialYear.endDate.getTime()) {
      throw new AppError("As-of date must fall within the selected financial year's date range.");
    }

    const [trialBalanceResult, groups, profitAndLossReport] = await Promise.all([
      voucherQueries.getTrialBalance(user.companyId, filters.financialYearId, asOfDate),
      ledgerGroupRepository.findMany(user.companyId),
      profitAndLossService.getProfitAndLoss({
        financialYearId: filters.financialYearId,
        from: toCalendarDateString(financialYear.startDate),
        to: filters.asOfDate,
      }),
    ]);

    return buildBalanceSheetReport(trialBalanceResult, profitAndLossReport.netProfit, groups);
  },
};
