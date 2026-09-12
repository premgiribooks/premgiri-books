import type { LedgerGroup } from "@prisma/client";

import { AppError } from "@/lib/app-error";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { assertPermission } from "@/lib/permissions";
import { voucherQueries } from "@/engines/voucher/voucher-queries";
import type { TrialBalanceResult } from "@/engines/voucher/types";
import { buildProfitAndLossReport, dayBefore } from "@/engines/reporting/profit-and-loss";
import type { ProfitAndLossLedgerMovement, ProfitAndLossReport } from "@/engines/reporting/types";
import { ledgerGroupRepository } from "@/modules/ledger-groups/repositories/ledger-group-repository";
import { financialYearService } from "@/modules/financial-year/services/financial-year-service";
import {
  profitAndLossFiltersSchema,
  toUtcDate,
  type ProfitAndLossFiltersInput,
} from "@/modules/reports/validation/financial-report-filters-schema";

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Diffs the two getTrialBalance results (as-of `to` minus as-of the day
 * before `from`) into per-ledger period movements, scoped to INCOME/EXPENSE-
 * nature ledgers only (65-profit-and-loss.md's Business Rules). Uses
 * totalDebit/totalCredit, never closingBalance — closingBalance folds in
 * Ledger.openingBalance, which this report must not assume is always zero.
 * A ledger missing from the "before `from`" result (not expected in
 * practice — both calls list every company ledger) is treated as zero for
 * that side, defensively.
 */
function diffLedgerMovements(
  toResult: TrialBalanceResult,
  beforeFromResult: TrialBalanceResult,
  groups: LedgerGroup[]
): ProfitAndLossLedgerMovement[] {
  const beforeByLedger = new Map(beforeFromResult.rows.map((row) => [row.ledgerId, row]));
  const groupById = new Map(groups.map((group) => [group.id, group]));

  return toResult.rows
    .filter((row) => {
      const group = groupById.get(row.ledgerGroupId);
      return group?.natureType === "INCOME" || group?.natureType === "EXPENSE";
    })
    .map((row) => {
      const before = beforeByLedger.get(row.ledgerId);
      return {
        ledgerId: row.ledgerId,
        ledgerName: row.ledgerName,
        ledgerGroupId: row.ledgerGroupId,
        periodDebit: round2(row.totalDebit - (before?.totalDebit ?? 0)),
        periodCredit: round2(row.totalCredit - (before?.totalCredit ?? 0)),
      };
    });
}

/**
 * The only I/O this module performs — resolves the Financial Year
 * (re-validating from/to fall inside its range), calls
 * voucherEngine.getTrialBalance twice (as of `to`, and as of the day before
 * `from`) and ledgerGroupRepository.findMany in parallel, diffs the two
 * results, and hands the period movements to buildProfitAndLossReport
 * (pure). No repository of its own, per 65-profit-and-loss.md's Data Model.
 */
export const profitAndLossService = {
  async getProfitAndLoss(rawFilters: ProfitAndLossFiltersInput): Promise<ProfitAndLossReport> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "reports", "view");

    const filters = profitAndLossFiltersSchema.parse(rawFilters);

    const financialYear = await financialYearService.getFinancialYear(filters.financialYearId);
    if (!financialYear || financialYear.companyId !== user.companyId) {
      throw new AppError("Financial year not found.");
    }

    const fromDate = toUtcDate(filters.from);
    const toDate = toUtcDate(filters.to);
    if (
      fromDate.getTime() < financialYear.startDate.getTime() ||
      fromDate.getTime() > financialYear.endDate.getTime() ||
      toDate.getTime() < financialYear.startDate.getTime() ||
      toDate.getTime() > financialYear.endDate.getTime()
    ) {
      throw new AppError("From/To dates must fall within the selected financial year's date range.");
    }

    const [toResult, beforeFromResult, groups] = await Promise.all([
      voucherQueries.getTrialBalance(user.companyId, filters.financialYearId, toDate),
      voucherQueries.getTrialBalance(user.companyId, filters.financialYearId, dayBefore(fromDate)),
      ledgerGroupRepository.findMany(user.companyId),
    ]);

    const periodRows = diffLedgerMovements(toResult, beforeFromResult, groups);
    return buildProfitAndLossReport(periodRows, groups);
  },
};
