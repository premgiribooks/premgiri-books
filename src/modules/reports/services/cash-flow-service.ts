import { AppError } from "@/lib/app-error";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { getCashAndBankLedgerIds } from "@/lib/ledger-class";
import { assertPermission } from "@/lib/permissions";
import { voucherQueries } from "@/engines/voucher/voucher-queries";
import { buildCashFlowReport } from "@/engines/reporting/cash-flow";
import type { CashFlowReport, CashLedgerMovement } from "@/engines/reporting/types";
import { ledgerGroupRepository } from "@/modules/ledger-groups/repositories/ledger-group-repository";
import { financialYearService } from "@/modules/financial-year/services/financial-year-service";
import { voucherRepository } from "@/modules/vouchers/repositories/voucher-repository";
import {
  profitAndLossFiltersSchema,
  toUtcDate,
  type ProfitAndLossFiltersInput,
} from "@/modules/reports/validation/financial-report-filters-schema";

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * The only I/O this module performs — resolves the Financial Year
 * (re-validating `from`/`to` fall inside its range), resolves the company's
 * Cash/Bank ledger id set (`getCashAndBankLedgerIds`), then in parallel
 * calls `voucherQueries.getLedgerStatement` once per Cash/Bank ledger (each
 * ledger's period movement is `closingBalance − openingBalance`, never
 * re-summed from raw entries), `voucherRepository.findCashTouchingEntries`
 * for the counter-ledger entries to categorize, and
 * `ledgerGroupRepository.findMany` for root-group resolution — and hands
 * the results to `buildCashFlowReport` (pure). No repository of its own,
 * per 67-cash-flow.md's Data Model.
 */
export const cashFlowService = {
  async getCashFlow(rawFilters: ProfitAndLossFiltersInput): Promise<CashFlowReport> {
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

    const cashLedgerIds = [...(await getCashAndBankLedgerIds(user.companyId))];

    const [cashLedgerMovements, categorizableEntries, groups] = await Promise.all([
      Promise.all(
        cashLedgerIds.map(async (ledgerId): Promise<CashLedgerMovement> => {
          const statement = await voucherQueries.getLedgerStatement(user.companyId, ledgerId, fromDate, toDate);
          return { ledgerId, netChange: round2(statement.closingBalance - statement.openingBalance) };
        })
      ),
      voucherRepository.findCashTouchingEntries(user.companyId, fromDate, toDate, cashLedgerIds),
      ledgerGroupRepository.findMany(user.companyId),
    ]);

    return buildCashFlowReport(cashLedgerMovements, categorizableEntries, groups);
  },
};
