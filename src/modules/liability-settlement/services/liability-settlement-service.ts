import { AppError } from "@/lib/app-error";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { assertPermission } from "@/lib/permissions";
import { voucherQueries } from "@/engines/voucher/voucher-queries";
import { buildLiabilitySettlementReport } from "@/engines/reporting/liability-settlement";
import type { LiabilitySettlementReport } from "@/types/liability-settlement";
import { ledgerGroupRepository } from "@/modules/ledger-groups/repositories/ledger-group-repository";
import { financialYearService } from "@/modules/financial-year/services/financial-year-service";
import {
  toUtcDate,
  trialBalanceFiltersSchema,
  type TrialBalanceFiltersInput,
} from "@/modules/reports/validation/financial-report-filters-schema";

// Gated by the `accounting` permission module (87-liability-settlement.md's
// Security section) rather than `reports` — this is a navigation-and-settle
// screen living alongside Ledger Groups/Ledger Master/Payment Vouchers, not
// a report.
const MODULE = "accounting";

/**
 * The only I/O this module performs — resolves the Financial Year
 * (re-validating `asOfDate` against its range, identical to Trial
 * Balance/Balance Sheet), calls voucherEngine.getTrialBalance and
 * ledgerGroupRepository.findMany in parallel, and hands the results to
 * buildLiabilitySettlementReport (pure). No repository of its own — there is
 * no table this module owns (87-liability-settlement.md's Data Model).
 * Reuses trialBalanceFiltersSchema directly rather than introducing a second
 * copy of the same as-of-date filter shape (66-balance-sheet.md's own
 * precedent for this exact reuse).
 */
export const liabilitySettlementService = {
  async getOutstandingLiabilities(rawFilters: TrialBalanceFiltersInput): Promise<LiabilitySettlementReport> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, MODULE, "view");

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

    return buildLiabilitySettlementReport(trialBalanceResult, groups);
  },
};
