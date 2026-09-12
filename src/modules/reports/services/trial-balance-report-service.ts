import { AppError } from "@/lib/app-error";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { assertPermission } from "@/lib/permissions";
import { voucherQueries } from "@/engines/voucher/voucher-queries";
import { buildTrialBalanceReport } from "@/engines/reporting/trial-balance";
import type { TrialBalanceReport } from "@/engines/reporting/types";
import { ledgerGroupRepository } from "@/modules/ledger-groups/repositories/ledger-group-repository";
import { financialYearService } from "@/modules/financial-year/services/financial-year-service";
import {
  toUtcDate,
  trialBalanceFiltersSchema,
  type TrialBalanceFiltersInput,
} from "@/modules/reports/validation/financial-report-filters-schema";

/**
 * The only I/O this module performs — fetches voucherEngine.getTrialBalance's
 * already-computed figures and the company's LedgerGroup tree in parallel,
 * then hands both to buildTrialBalanceReport (pure). No repository of its
 * own, per 64-trial-balance.md's Data Model ("nothing this module persists").
 */
export const trialBalanceReportService = {
  async getTrialBalanceReport(rawFilters: TrialBalanceFiltersInput): Promise<TrialBalanceReport> {
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

    const [trialBalanceResult, groups] = await Promise.all([
      voucherQueries.getTrialBalance(user.companyId, filters.financialYearId, asOfDate),
      ledgerGroupRepository.findMany(user.companyId),
    ]);

    return buildTrialBalanceReport(trialBalanceResult, groups);
  },
};
