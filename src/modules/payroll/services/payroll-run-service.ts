import { Prisma, type CompanySettings } from "@prisma/client";

import { AppError } from "@/lib/app-error";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { getCurrentFinancialYear } from "@/lib/current-financial-year";
import type { Page, PageParams } from "@/lib/pagination";
import { assertPermission } from "@/lib/permissions";
import { isRetryableTransactionError } from "@/lib/prisma-errors";
import { prisma } from "@/lib/prisma";
import { runInTransaction } from "@/lib/transaction";
import { documentNumberEngine } from "@/engines/document-number/document-number-engine";
import { voucherEngine } from "@/engines/voucher/voucher-engine";
import type { VoucherEntryLineInput } from "@/engines/voucher/voucher-validation";
import {
  assertPayrollLedgerMappingValid,
  isPayrollLedgerMappingComplete,
} from "@/modules/company/utils/payroll-ledger-mapping";
import { companySettingsService } from "@/modules/company/services/company-settings-service";
import { attendanceService } from "@/modules/attendance/services/attendance-service";
import {
  payrollRunRepository,
  type PayrollRunHeaderPersistData,
  type PayrollRunLinePersistData,
} from "@/modules/payroll/repositories/payroll-run-repository";
import {
  computeNetSalary,
  computeWorkedDays,
  sumNetSalaryPaise,
  totalDaysInPeriod,
} from "@/modules/payroll/utils/payroll-calculations";
import {
  createPayrollRunSchema,
  payrollRunListFiltersSchema,
  payrollRunReportFiltersSchema,
  toUtcDate,
  type CreatePayrollRunInput,
  type PayrollRunListFiltersInput,
  type PayrollRunReportFiltersInput,
} from "@/modules/payroll/validation/payroll-run-schema";
import type {
  EmployeeSalaryHistoryFilters,
  EmployeeSalaryHistoryRow,
  PayrollRunDetail,
  PayrollRunExcludedEmployee,
  PayrollRunFormOptions,
  PayrollRunLine,
  PayrollRunListFilters,
  PayrollRunListRow,
  PayrollRunPreview,
} from "@/types/payroll-run";

type PrismaClientOrTransaction = typeof prisma | Prisma.TransactionClient;

const NOT_FOUND_MESSAGE = "Payroll run not found.";
const NO_FINANCIAL_YEAR_MESSAGE = "Select a financial year before working with payroll runs.";
const CANNOT_REFRESH_MESSAGE = "This payroll run can no longer be refreshed — it may have been posted or cancelled. Please refresh.";
const CANNOT_POST_MESSAGE = "This payroll run can no longer be posted — it may have already been posted or cancelled. Please refresh.";
const CANNOT_CANCEL_MESSAGE = "Only a posted payroll run can be cancelled.";
const OVERLAPPING_PERIOD_MESSAGE =
  "This period overlaps another payroll run that is not cancelled. Choose a non-overlapping period or cancel the earlier run first.";

// Posting/cancellation both use Serializable + bounded retry, mirroring
// purchase-invoice-service.ts's identical convention (63-payroll.md's Code
// Standards).
const SERIALIZABLE_RETRY = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  retryable: isRetryableTransactionError,
  conflictMessage: "This payroll run's referenced data changed due to another request. Please try again.",
};

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function requireFinancialYear(): Promise<{ id: string }> {
  const financialYear = await getCurrentFinancialYear();
  if (!financialYear) {
    throw new AppError(NO_FINANCIAL_YEAR_MESSAGE);
  }
  return financialYear;
}

function toListFilters(rawFilters: PayrollRunListFiltersInput): PayrollRunListFilters {
  const parsed = payrollRunListFiltersSchema.parse(rawFilters);
  return {
    search: parsed.search,
    status: parsed.status,
    dateFrom: parsed.dateFrom ? toUtcDate(parsed.dateFrom) : undefined,
    dateTo: parsed.dateTo ? toUtcDate(parsed.dateTo) : undefined,
  };
}

interface BuiltPayrollRun {
  lines: PayrollRunLine[];
  excludedEmployees: PayrollRunExcludedEmployee[];
  totalDaysInPeriod: number;
  totalNetSalary: number;
}

/**
 * Composes every active employee's worked-day ratio and net salary for the
 * period (63-payroll.md's "Creating a run" business rules) — calls
 * `attendanceService.getAttendanceSummary` once per candidate employee,
 * never re-implementing that per-status counting logic. An employee with no
 * `basicSalary` set is excluded from the computed lines, not a hard error.
 */
async function buildPayrollRun(
  client: PrismaClientOrTransaction,
  companyId: string,
  periodStart: string,
  periodEnd: string
): Promise<BuiltPayrollRun> {
  const employees = await payrollRunRepository.findActiveEmployeesForPayroll(client, companyId);
  const candidates = employees.filter((employee): employee is typeof employee & { basicSalary: number } => employee.basicSalary !== null);
  const excludedEmployees: PayrollRunExcludedEmployee[] = employees
    .filter((employee) => employee.basicSalary === null)
    .map((employee) => ({
      employeeId: employee.id,
      employeeCode: employee.employeeCode,
      fullName: employee.fullName,
      reason: "NO_BASIC_SALARY" as const,
    }));

  const days = totalDaysInPeriod(toUtcDate(periodStart), toUtcDate(periodEnd));

  const lines = await Promise.all(
    candidates.map(async (employee) => {
      const summary = await attendanceService.getAttendanceSummary(employee.id, periodStart, periodEnd);
      const workedDays = computeWorkedDays(summary.presentDays, summary.halfDays);
      const netSalary = computeNetSalary(employee.basicSalary, workedDays, days);
      const line: PayrollRunLine = {
        employeeId: employee.id,
        employeeCode: employee.employeeCode,
        fullName: employee.fullName,
        basicSalary: employee.basicSalary,
        totalDaysInPeriod: days,
        presentDays: summary.presentDays,
        halfDays: summary.halfDays,
        absentDays: summary.absentDays,
        onLeaveDays: summary.onLeaveDays,
        workedDays,
        netSalary,
      };
      return line;
    })
  );

  const totalNetSalary = sumNetSalaryPaise(lines) / 100;

  return { lines, excludedEmployees, totalDaysInPeriod: days, totalNetSalary };
}

function toLinePersistData(lines: readonly PayrollRunLine[]): PayrollRunLinePersistData[] {
  return lines.map((line) => ({
    employeeId: line.employeeId,
    basicSalary: line.basicSalary,
    totalDaysInPeriod: line.totalDaysInPeriod,
    workedDays: line.workedDays,
    netSalary: line.netSalary,
  }));
}

async function assertNoOverlap(
  client: PrismaClientOrTransaction,
  companyId: string,
  periodStart: Date,
  periodEnd: Date,
  excludeRunId?: string
): Promise<void> {
  const overlapping = await payrollRunRepository.findOverlappingRun(client, companyId, periodStart, periodEnd, excludeRunId);
  if (overlapping) {
    throw new AppError(OVERLAPPING_PERIOD_MESSAGE);
  }
}

/** 63-payroll.md's Ledger Posting — one aggregate voucher for the whole
 * run, Debit Salary Expense / Credit Salary Payable, both equal to
 * `totalNetSalary`. No round-off, no payment lines. */
function buildVoucherEntries(totalNetSalary: number, settings: CompanySettings): VoucherEntryLineInput[] {
  return [
    { ledgerId: settings.salaryExpenseLedgerId as string, entryType: "DEBIT", amount: totalNetSalary },
    { ledgerId: settings.salaryPayableLedgerId as string, entryType: "CREDIT", amount: totalNetSalary },
  ];
}

export const payrollRunService = {
  async listPayrollRuns(rawFilters: PayrollRunListFiltersInput = {}): Promise<PayrollRunListRow[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "employees", "view");

    const financialYear = await getCurrentFinancialYear();
    if (!financialYear) {
      return [];
    }

    const filters = toListFilters(rawFilters);
    return payrollRunRepository.findMany(user.companyId, financialYear.id, filters);
  },

  /** Infinite-scroll page for the Payroll Runs list page. */
  async listPayrollRunsPage(
    rawFilters: PayrollRunListFiltersInput,
    page: PageParams
  ): Promise<Page<PayrollRunListRow>> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "employees", "view");

    const financialYear = await getCurrentFinancialYear();
    if (!financialYear) {
      return { items: [], hasMore: false };
    }

    const filters = toListFilters(rawFilters);
    return payrollRunRepository.findManyPage(user.companyId, financialYear.id, filters, page);
  },

  /**
   * 73-employee-reports.md's Payroll Register — gated on `reports`/`view`,
   * not `employees`/`view` (this batch's shared design decision: a report is
   * a presentation concern with its own permission boundary), mirroring
   * purchase-invoice-service.ts's own `listPurchaseInvoicesForReport`
   * precedent so the seeded Accountant role (`reports`/`view` but no
   * `employees` module access at all) can view it. `financialYearId`
   * defaults to the active financial year when omitted, unlike
   * `listPayrollRuns`'s own cookie-only resolution.
   */
  async listPayrollRunsForReport(rawFilters: PayrollRunReportFiltersInput = {}): Promise<PayrollRunListRow[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "reports", "view");

    const parsed = payrollRunReportFiltersSchema.parse(rawFilters);

    let financialYearId = parsed.financialYearId;
    if (!financialYearId) {
      const financialYear = await getCurrentFinancialYear();
      if (!financialYear) {
        return [];
      }
      financialYearId = financialYear.id;
    }

    const filters: PayrollRunListFilters = {
      status: parsed.status,
      dateFrom: parsed.dateFrom ? toUtcDate(parsed.dateFrom) : undefined,
      dateTo: parsed.dateTo ? toUtcDate(parsed.dateTo) : undefined,
    };
    return payrollRunRepository.findMany(user.companyId, financialYearId, filters);
  },

  async getPayrollRun(id: string): Promise<PayrollRunDetail | null> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "employees", "view");

    const run = await payrollRunRepository.findById(id);
    if (!run || run.companyId !== user.companyId) {
      return null;
    }
    return run;
  },

  async listPayrollRunFormOptions(): Promise<PayrollRunFormOptions> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "employees", "create");

    const financialYear = await requireFinancialYear();
    const [settings, preview] = await Promise.all([
      companySettingsService.getSettings(user.companyId),
      documentNumberEngine.previewNextNumber({
        companyId: user.companyId,
        financialYearId: financialYear.id,
        documentType: "PAYROLL",
      }),
    ]);

    return {
      nextPayrollNumber: preview.formatted,
      isLedgerMappingComplete: isPayrollLedgerMappingComplete(settings),
    };
  },

  /** The Create Payroll Run screen's live, never-persisted preview. */
  async previewPayrollRun(input: CreatePayrollRunInput): Promise<PayrollRunPreview> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "employees", "create");

    const data = createPayrollRunSchema.parse(input);
    const built = await buildPayrollRun(prisma, user.companyId, data.periodStart, data.periodEnd);

    return {
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
      totalDaysInPeriod: built.totalDaysInPeriod,
      lines: built.lines,
      excludedEmployees: built.excludedEmployees,
      totalNetSalary: built.totalNetSalary,
    };
  },

  async createDraft(input: CreatePayrollRunInput): Promise<PayrollRunDetail> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "employees", "create");

    const financialYear = await requireFinancialYear();
    const data = createPayrollRunSchema.parse(input);
    const periodStart = toUtcDate(data.periodStart);
    const periodEnd = toUtcDate(data.periodEnd);

    await assertNoOverlap(prisma, user.companyId, periodStart, periodEnd);

    const built = await buildPayrollRun(prisma, user.companyId, data.periodStart, data.periodEnd);
    const header: PayrollRunHeaderPersistData = { periodStart, periodEnd, narration: data.narration ?? null };

    return runInTransaction((tx) =>
      payrollRunRepository.create(tx, user.companyId, financialYear.id, header, toLinePersistData(built.lines), built.totalNetSalary, user.id)
    );
  },

  /**
   * Recomputes a DRAFT run's own lines against CURRENT Attendance/salary
   * data (63-payroll.md's Business Rules: "a draft can be recomputed/
   * refreshed ... as many times as needed before posting").
   */
  async refreshDraft(id: string): Promise<PayrollRunDetail> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "employees", "create");

    const existing = await payrollRunRepository.findById(id);
    if (!existing || existing.companyId !== user.companyId) {
      throw new AppError(NOT_FOUND_MESSAGE);
    }
    if (existing.status !== "DRAFT") {
      throw new AppError(CANNOT_REFRESH_MESSAGE);
    }

    const periodStart = toDateInputValue(existing.periodStart);
    const periodEnd = toDateInputValue(existing.periodEnd);
    const built = await buildPayrollRun(prisma, user.companyId, periodStart, periodEnd);

    return runInTransaction(async (tx) => {
      const current = await tx.payrollRun.findUnique({ where: { id } });
      if (!current || current.companyId !== user.companyId || current.status !== "DRAFT") {
        throw new AppError(CANNOT_REFRESH_MESSAGE);
      }
      const result = await payrollRunRepository.replaceItems(tx, id, user.companyId, toLinePersistData(built.lines), built.totalNetSalary);
      if (!result) {
        throw new AppError(CANNOT_REFRESH_MESSAGE);
      }
      return result;
    });
  },

  /**
   * The orchestration this whole module exists for (63-payroll.md's Posting
   * section): one Serializable transaction that re-validates every business
   * rule against CURRENT state, recomputes every line fresh from Attendance/
   * salary data, posts the balanced voucher (Voucher Engine), generates the
   * first real `payrollNumber`, and flips this run to POSTED — atomically.
   */
  async postPayrollRun(id: string): Promise<PayrollRunDetail> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "employees", "approve");

    const existing = await payrollRunRepository.findById(id);
    if (!existing || existing.companyId !== user.companyId) {
      throw new AppError(NOT_FOUND_MESSAGE);
    }
    if (existing.status !== "DRAFT") {
      throw new AppError(CANNOT_POST_MESSAGE);
    }

    // Both this run's own numbering and the posting voucher's numbering must
    // be reserved before this transaction opens (documentNumberEngine's/
    // voucherEngine.postVoucher's tx? contract, spec 34/31).
    await documentNumberEngine.ensureSequence(user.companyId, existing.financialYearId, "PAYROLL");
    await documentNumberEngine.ensureSequence(user.companyId, existing.financialYearId, "SALARY_VOUCHER");

    return runInTransaction(
      async (tx) => {
        const current = await tx.payrollRun.findUnique({ where: { id } });
        if (!current || current.companyId !== user.companyId || current.status !== "DRAFT") {
          throw new AppError(CANNOT_POST_MESSAGE);
        }

        // Step 1: re-validate business rules against current state.
        await assertNoOverlap(tx, user.companyId, current.periodStart, current.periodEnd, id);

        const settingsOrNull = await companySettingsService.getSettings(user.companyId);
        await assertPayrollLedgerMappingValid(tx, user.companyId, settingsOrNull);
        const settings = settingsOrNull as CompanySettings;

        // Step 2: recompute every line from CURRENT Attendance/salary data —
        // never trust stale draft figures.
        const built = await buildPayrollRun(tx, user.companyId, toDateInputValue(current.periodStart), toDateInputValue(current.periodEnd));

        // A run with nothing to pay — either no included employees (every
        // active employee excluded for missing basicSalary, or none active
        // at all) or every included employee's own net salary computing to
        // zero (e.g. absent for the entire period) — would otherwise build
        // a zero-amount voucher entry and fail Zod's `.positive()` check
        // with an opaque error. Reject with a friendly message instead.
        if (built.totalNetSalary <= 0) {
          throw new AppError("This payroll run has no net salary to pay — nothing to post.");
        }

        // Step 4: generate payrollNumber — the first time this row receives
        // a real number.
        const generated = await documentNumberEngine.generateNumber(tx, {
          companyId: user.companyId,
          financialYearId: current.financialYearId,
          documentType: "PAYROLL",
        });

        // Step 5: balanced voucher.
        const entries = buildVoucherEntries(built.totalNetSalary, settings);
        const voucher = await voucherEngine.postVoucher(
          user.companyId,
          {
            financialYearId: current.financialYearId,
            voucherType: "SALARY",
            voucherDate: toDateInputValue(current.periodEnd),
            narration: current.narration ?? undefined,
            referenceType: "PAYROLL_RUN",
            referenceId: current.id,
            createdByUserId: user.id,
            entries,
          },
          tx
        );

        // Step 6: persist final totals, payrollNumber, voucherId, and
        // POSTED status atomically.
        const posted = await payrollRunRepository.replaceItemsAndPost(
          tx,
          id,
          user.companyId,
          generated.formatted,
          toLinePersistData(built.lines),
          built.totalNetSalary,
          voucher.id
        );
        if (!posted) {
          throw new AppError(CANNOT_POST_MESSAGE);
        }
        return posted;
      },
      SERIALIZABLE_RETRY
    );
  },

  /**
   * `POSTED -> CANCELLED` only — reverses the accounting entry via the
   * Voucher Engine's mirrored reversal. No stock or attendance reversal
   * (63-payroll.md's Cancellation section: "cancelling a payroll run does
   * not un-mark attendance").
   */
  async cancelPayrollRun(id: string): Promise<PayrollRunDetail> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "employees", "approve");

    const existing = await payrollRunRepository.findById(id);
    if (!existing || existing.companyId !== user.companyId) {
      throw new AppError(NOT_FOUND_MESSAGE);
    }
    if (existing.status !== "POSTED" || !existing.voucherId) {
      throw new AppError(CANNOT_CANCEL_MESSAGE);
    }

    await documentNumberEngine.ensureSequence(user.companyId, existing.financialYearId, "SALARY_VOUCHER");

    return runInTransaction(async (tx) => {
      const current = await tx.payrollRun.findUnique({ where: { id } });
      if (!current || current.companyId !== user.companyId || current.status !== "POSTED" || !current.voucherId) {
        throw new AppError(CANNOT_CANCEL_MESSAGE);
      }

      await voucherEngine.cancelVoucher(user.companyId, current.voucherId, tx);

      const count = await payrollRunRepository.updateStatus(tx, id, user.companyId, ["POSTED"], "CANCELLED");
      if (count === 0) {
        throw new AppError(CANNOT_CANCEL_MESSAGE);
      }

      const updated = await payrollRunRepository.findById(id, tx);
      if (!updated) {
        throw new AppError(NOT_FOUND_MESSAGE);
      }
      return updated;
    }, SERIALIZABLE_RETRY);
  },

  /**
   * 73-employee-reports.md's Salary Register — thin pass-through to the
   * repository's employee-scoped-across-runs query. Gated on `reports`/
   * `view`, not `employees`/`view` — mirrors `listPayrollRunsForReport`
   * above (its sole caller is Employee Reports, gated by `reports`/`view`
   * on its own layer, the same seeded-Accountant-role reasoning).
   */
  async getEmployeeSalaryHistory(employeeId: string, filters: EmployeeSalaryHistoryFilters = {}): Promise<EmployeeSalaryHistoryRow[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "reports", "view");

    return payrollRunRepository.listItemsForEmployee(user.companyId, employeeId, filters);
  },
};
