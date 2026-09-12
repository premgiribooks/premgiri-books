import { beforeEach, describe, expect, it, vi } from "vitest";

// Mirrors purchase-invoice-service.test.ts's convention: mock the
// module-boundary repository, sibling services/engines, and the
// session/permission/Prisma boundaries. The pure payroll-calculations
// module is left REAL so the worked-day/net-salary composition assertions
// are genuine.
const {
  findManyMock,
  findByIdMock,
  findActiveEmployeesForPayrollMock,
  findOverlappingRunMock,
  createMock,
  replaceItemsMock,
  replaceItemsAndPostMock,
  updateStatusMock,
  listItemsForEmployeeMock,
  getAttendanceSummaryMock,
  getCurrentCompanyUserMock,
  getCurrentFinancialYearMock,
  assertPermissionMock,
  ensureSequenceMock,
  generateNumberMock,
  previewNextNumberMock,
  getSettingsMock,
  assertPayrollLedgerMappingValidMock,
  isPayrollLedgerMappingCompleteMock,
  postVoucherMock,
  cancelVoucherMock,
  FAKE_TX,
} = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  findByIdMock: vi.fn(),
  findActiveEmployeesForPayrollMock: vi.fn(),
  findOverlappingRunMock: vi.fn(),
  createMock: vi.fn(),
  replaceItemsMock: vi.fn(),
  replaceItemsAndPostMock: vi.fn(),
  updateStatusMock: vi.fn(),
  listItemsForEmployeeMock: vi.fn(),
  getAttendanceSummaryMock: vi.fn(),
  getCurrentCompanyUserMock: vi.fn(),
  getCurrentFinancialYearMock: vi.fn(),
  assertPermissionMock: vi.fn(),
  ensureSequenceMock: vi.fn(),
  generateNumberMock: vi.fn(),
  previewNextNumberMock: vi.fn(),
  getSettingsMock: vi.fn(),
  assertPayrollLedgerMappingValidMock: vi.fn(),
  isPayrollLedgerMappingCompleteMock: vi.fn(),
  postVoucherMock: vi.fn(),
  cancelVoucherMock: vi.fn(),
  FAKE_TX: { payrollRun: { findUnique: vi.fn() } },
}));

vi.mock("@/modules/payroll/repositories/payroll-run-repository", () => ({
  payrollRunRepository: {
    findMany: findManyMock,
    findById: findByIdMock,
    findActiveEmployeesForPayroll: findActiveEmployeesForPayrollMock,
    findOverlappingRun: findOverlappingRunMock,
    create: createMock,
    replaceItems: replaceItemsMock,
    replaceItemsAndPost: replaceItemsAndPostMock,
    updateStatus: updateStatusMock,
    listItemsForEmployee: listItemsForEmployeeMock,
  },
}));

vi.mock("@/modules/attendance/services/attendance-service", () => ({
  attendanceService: { getAttendanceSummary: getAttendanceSummaryMock },
}));

vi.mock("@/lib/current-user", () => ({ getCurrentCompanyUser: getCurrentCompanyUserMock }));
vi.mock("@/lib/current-financial-year", () => ({ getCurrentFinancialYear: getCurrentFinancialYearMock }));
vi.mock("@/lib/permissions", () => ({ assertPermission: assertPermissionMock }));

vi.mock("@/engines/document-number/document-number-engine", () => ({
  documentNumberEngine: {
    ensureSequence: ensureSequenceMock,
    generateNumber: generateNumberMock,
    previewNextNumber: previewNextNumberMock,
  },
}));

vi.mock("@/engines/voucher/voucher-engine", () => ({
  voucherEngine: { postVoucher: postVoucherMock, cancelVoucher: cancelVoucherMock },
}));

vi.mock("@/modules/company/services/company-settings-service", () => ({
  companySettingsService: { getSettings: getSettingsMock },
}));

vi.mock("@/modules/company/utils/payroll-ledger-mapping", () => ({
  assertPayrollLedgerMappingValid: assertPayrollLedgerMappingValidMock,
  isPayrollLedgerMappingComplete: isPayrollLedgerMappingCompleteMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: (fn: (tx: unknown) => unknown) => fn(FAKE_TX) },
}));

import { AppError } from "@/lib/app-error";
import { payrollRunService } from "@/modules/payroll/services/payroll-run-service";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_COMPANY_ID = "99999999-9999-4999-8999-999999999999";
const FY_ID = "44444444-4444-4444-8444-444444444444";
const RUN_ID = "22222222-2222-4222-8222-222222222222";
const EMPLOYEE_ID = "33333333-3333-4333-8333-333333333333";
const CURRENT_USER = { id: "user-1", companyId: COMPANY_ID, role: "Owner", userType: "COMPANY" as const, username: "owner", fullName: "Owner" };

const ZERO_SUMMARY = { presentDays: 0, halfDays: 0, absentDays: 0, onLeaveDays: 0, totalMarkedDays: 0 };

function draftRun(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: RUN_ID,
    companyId: COMPANY_ID,
    financialYearId: FY_ID,
    payrollNumber: null,
    periodStart: new Date("2026-01-01T00:00:00.000Z"),
    periodEnd: new Date("2026-01-31T00:00:00.000Z"),
    status: "DRAFT",
    narration: null,
    totalNetSalary: 0,
    voucherId: null,
    items: [],
    createdAt: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentCompanyUserMock.mockResolvedValue(CURRENT_USER);
  assertPermissionMock.mockResolvedValue(undefined);
  getCurrentFinancialYearMock.mockResolvedValue({ id: FY_ID, companyId: COMPANY_ID });
  FAKE_TX.payrollRun.findUnique.mockReset();
});

describe("listPayrollRuns", () => {
  it("gates on employees/view and returns [] with no active financial year", async () => {
    getCurrentFinancialYearMock.mockResolvedValue(null);
    const result = await payrollRunService.listPayrollRuns();
    expect(assertPermissionMock).toHaveBeenCalledWith(CURRENT_USER, "employees", "view");
    expect(result).toEqual([]);
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it("forwards parsed filters scoped to the active company/FY", async () => {
    findManyMock.mockResolvedValue([]);
    await payrollRunService.listPayrollRuns({ status: "POSTED" });
    expect(findManyMock).toHaveBeenCalledWith(COMPANY_ID, FY_ID, expect.objectContaining({ status: "POSTED" }));
  });
});

describe("getPayrollRun", () => {
  it("returns null for a cross-company run", async () => {
    findByIdMock.mockResolvedValue(draftRun({ companyId: OTHER_COMPANY_ID }));
    const result = await payrollRunService.getPayrollRun(RUN_ID);
    expect(result).toBeNull();
  });
});

describe("listPayrollRunsForReport", () => {
  it("gates on reports/view (not employees/view), so the seeded Accountant role can view it", async () => {
    findManyMock.mockResolvedValue([]);
    await payrollRunService.listPayrollRunsForReport({ financialYearId: FY_ID });
    expect(assertPermissionMock).toHaveBeenCalledWith(CURRENT_USER, "reports", "view");
  });

  it("defaults to the active financial year when none is given", async () => {
    findManyMock.mockResolvedValue([]);
    await payrollRunService.listPayrollRunsForReport();
    expect(findManyMock).toHaveBeenCalledWith(COMPANY_ID, FY_ID, expect.any(Object));
  });

  it("returns [] when no financialYearId is given and none is active", async () => {
    getCurrentFinancialYearMock.mockResolvedValue(null);
    const result = await payrollRunService.listPayrollRunsForReport();
    expect(result).toEqual([]);
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it("rejects a malformed financialYearId before it ever reaches the repository", async () => {
    await expect(payrollRunService.listPayrollRunsForReport({ financialYearId: "not-a-uuid" })).rejects.toThrow();
    expect(findManyMock).not.toHaveBeenCalled();
  });
});

describe("listPayrollRunFormOptions", () => {
  it("reports ledger mapping completeness and the next payroll number", async () => {
    getSettingsMock.mockResolvedValue({ salaryExpenseLedgerId: "l1", salaryPayableLedgerId: "l2" });
    isPayrollLedgerMappingCompleteMock.mockReturnValue(true);
    previewNextNumberMock.mockResolvedValue({ formatted: "PAY-0001" });

    const options = await payrollRunService.listPayrollRunFormOptions();

    expect(assertPermissionMock).toHaveBeenCalledWith(CURRENT_USER, "employees", "create");
    expect(options).toEqual({ nextPayrollNumber: "PAY-0001", isLedgerMappingComplete: true });
  });
});

describe("previewPayrollRun / createDraft", () => {
  it("excludes an employee with no basicSalary from the computed lines", async () => {
    findActiveEmployeesForPayrollMock.mockResolvedValue([
      { id: EMPLOYEE_ID, employeeCode: "EMP-1", fullName: "Asha Rao", basicSalary: 30000 },
      { id: "employee-2", employeeCode: "EMP-2", fullName: "No Salary", basicSalary: null },
    ]);
    getAttendanceSummaryMock.mockResolvedValue({ ...ZERO_SUMMARY, presentDays: 31, totalMarkedDays: 31 });

    const preview = await payrollRunService.previewPayrollRun({ periodStart: "2026-01-01", periodEnd: "2026-01-31" });

    expect(preview.lines).toHaveLength(1);
    expect(preview.lines[0].netSalary).toBe(30000);
    expect(preview.excludedEmployees).toEqual([{ employeeId: "employee-2", employeeCode: "EMP-2", fullName: "No Salary", reason: "NO_BASIC_SALARY" }]);
    expect(preview.totalNetSalary).toBe(30000);
  });

  it("createDraft rejects a period overlapping a non-cancelled run", async () => {
    findOverlappingRunMock.mockResolvedValue({ id: "other-run" });

    await expect(
      payrollRunService.createDraft({ periodStart: "2026-01-01", periodEnd: "2026-01-31" })
    ).rejects.toThrow(/overlaps/);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("createDraft persists the computed lines and total when no overlap exists", async () => {
    findOverlappingRunMock.mockResolvedValue(null);
    findActiveEmployeesForPayrollMock.mockResolvedValue([{ id: EMPLOYEE_ID, employeeCode: "EMP-1", fullName: "Asha Rao", basicSalary: 30000 }]);
    getAttendanceSummaryMock.mockResolvedValue({ ...ZERO_SUMMARY, presentDays: 31, totalMarkedDays: 31 });
    createMock.mockResolvedValue(draftRun());

    await payrollRunService.createDraft({ periodStart: "2026-01-01", periodEnd: "2026-01-31" });

    expect(createMock).toHaveBeenCalledWith(
      FAKE_TX,
      COMPANY_ID,
      FY_ID,
      expect.objectContaining({ narration: null }),
      [expect.objectContaining({ employeeId: EMPLOYEE_ID, netSalary: 30000 })],
      30000,
      CURRENT_USER.id
    );
  });
});

describe("refreshDraft", () => {
  it("rejects a run that is not DRAFT", async () => {
    findByIdMock.mockResolvedValue(draftRun({ status: "POSTED" }));
    await expect(payrollRunService.refreshDraft(RUN_ID)).rejects.toThrow(/no longer be refreshed/);
    expect(replaceItemsMock).not.toHaveBeenCalled();
  });

  it("recomputes lines against current attendance data and replaces the item set", async () => {
    findByIdMock.mockResolvedValue(draftRun());
    FAKE_TX.payrollRun.findUnique.mockResolvedValue({ id: RUN_ID, companyId: COMPANY_ID, status: "DRAFT" });
    findActiveEmployeesForPayrollMock.mockResolvedValue([{ id: EMPLOYEE_ID, employeeCode: "EMP-1", fullName: "Asha Rao", basicSalary: 30000 }]);
    getAttendanceSummaryMock.mockResolvedValue({ ...ZERO_SUMMARY, presentDays: 31, totalMarkedDays: 31 });
    replaceItemsMock.mockResolvedValue(draftRun({ totalNetSalary: 30000 }));

    await payrollRunService.refreshDraft(RUN_ID);

    expect(replaceItemsMock).toHaveBeenCalledWith(
      FAKE_TX,
      RUN_ID,
      COMPANY_ID,
      [expect.objectContaining({ netSalary: 30000 })],
      30000
    );
  });
});

describe("postPayrollRun", () => {
  it("rejects when the ledger mapping is invalid", async () => {
    findByIdMock.mockResolvedValue(draftRun());
    FAKE_TX.payrollRun.findUnique.mockResolvedValue({ id: RUN_ID, companyId: COMPANY_ID, status: "DRAFT", periodStart: new Date("2026-01-01"), periodEnd: new Date("2026-01-31"), financialYearId: FY_ID, narration: null });
    findOverlappingRunMock.mockResolvedValue(null);
    assertPayrollLedgerMappingValidMock.mockRejectedValue(new AppError('Configure the "Salary Expense" ledger'));

    await expect(payrollRunService.postPayrollRun(RUN_ID)).rejects.toThrow(/Salary Expense/);
    expect(postVoucherMock).not.toHaveBeenCalled();
  });

  it("posts a balanced Debit Salary Expense / Credit Salary Payable voucher and flips status to POSTED", async () => {
    findByIdMock.mockResolvedValue(draftRun());
    FAKE_TX.payrollRun.findUnique.mockResolvedValue({
      id: RUN_ID,
      companyId: COMPANY_ID,
      status: "DRAFT",
      periodStart: new Date("2026-01-01T00:00:00.000Z"),
      periodEnd: new Date("2026-01-31T00:00:00.000Z"),
      financialYearId: FY_ID,
      narration: null,
    });
    findOverlappingRunMock.mockResolvedValue(null);
    getSettingsMock.mockResolvedValue({ salaryExpenseLedgerId: "expense-ledger", salaryPayableLedgerId: "payable-ledger" });
    assertPayrollLedgerMappingValidMock.mockResolvedValue(undefined);
    findActiveEmployeesForPayrollMock.mockResolvedValue([{ id: EMPLOYEE_ID, employeeCode: "EMP-1", fullName: "Asha Rao", basicSalary: 30000 }]);
    getAttendanceSummaryMock.mockResolvedValue({ ...ZERO_SUMMARY, presentDays: 31, totalMarkedDays: 31 });
    generateNumberMock.mockResolvedValue({ formatted: "PAY-0001" });
    postVoucherMock.mockResolvedValue({ id: "voucher-1" });
    replaceItemsAndPostMock.mockResolvedValue(draftRun({ status: "POSTED", payrollNumber: "PAY-0001", totalNetSalary: 30000 }));

    await payrollRunService.postPayrollRun(RUN_ID);

    expect(assertPermissionMock).toHaveBeenCalledWith(CURRENT_USER, "employees", "approve");
    expect(postVoucherMock).toHaveBeenCalledWith(
      COMPANY_ID,
      expect.objectContaining({
        voucherType: "SALARY",
        entries: [
          { ledgerId: "expense-ledger", entryType: "DEBIT", amount: 30000 },
          { ledgerId: "payable-ledger", entryType: "CREDIT", amount: 30000 },
        ],
      }),
      FAKE_TX
    );
    expect(replaceItemsAndPostMock).toHaveBeenCalledWith(FAKE_TX, RUN_ID, COMPANY_ID, "PAY-0001", expect.any(Array), 30000, "voucher-1");
  });

  it("rejects posting a run with nothing to pay, rather than building a zero-amount voucher entry", async () => {
    findByIdMock.mockResolvedValue(draftRun());
    FAKE_TX.payrollRun.findUnique.mockResolvedValue({
      id: RUN_ID,
      companyId: COMPANY_ID,
      status: "DRAFT",
      periodStart: new Date("2026-01-01T00:00:00.000Z"),
      periodEnd: new Date("2026-01-31T00:00:00.000Z"),
      financialYearId: FY_ID,
      narration: null,
    });
    findOverlappingRunMock.mockResolvedValue(null);
    getSettingsMock.mockResolvedValue({ salaryExpenseLedgerId: "expense-ledger", salaryPayableLedgerId: "payable-ledger" });
    assertPayrollLedgerMappingValidMock.mockResolvedValue(undefined);
    // No active employees at all -> zero lines, zero total.
    findActiveEmployeesForPayrollMock.mockResolvedValue([]);

    await expect(payrollRunService.postPayrollRun(RUN_ID)).rejects.toThrow(/nothing to post/);
    expect(postVoucherMock).not.toHaveBeenCalled();
    expect(generateNumberMock).not.toHaveBeenCalled();
  });
});

describe("cancelPayrollRun", () => {
  it("rejects cancelling a run that is not POSTED", async () => {
    findByIdMock.mockResolvedValue(draftRun({ status: "DRAFT" }));
    await expect(payrollRunService.cancelPayrollRun(RUN_ID)).rejects.toThrow(/Only a posted payroll run/);
    expect(cancelVoucherMock).not.toHaveBeenCalled();
  });

  it("reverses the voucher and flips status to CANCELLED for a posted run", async () => {
    findByIdMock
      .mockResolvedValueOnce(draftRun({ status: "POSTED", voucherId: "voucher-1" }))
      .mockResolvedValueOnce(draftRun({ status: "CANCELLED", voucherId: "voucher-1" }));
    FAKE_TX.payrollRun.findUnique.mockResolvedValue({ id: RUN_ID, companyId: COMPANY_ID, status: "POSTED", voucherId: "voucher-1" });
    updateStatusMock.mockResolvedValue(1);

    await payrollRunService.cancelPayrollRun(RUN_ID);

    expect(cancelVoucherMock).toHaveBeenCalledWith(COMPANY_ID, "voucher-1", FAKE_TX);
    expect(updateStatusMock).toHaveBeenCalledWith(FAKE_TX, RUN_ID, COMPANY_ID, ["POSTED"], "CANCELLED");
  });
});

describe("getEmployeeSalaryHistory", () => {
  it("gates on reports/view (not employees/view) and forwards to the repository", async () => {
    listItemsForEmployeeMock.mockResolvedValue([]);
    await payrollRunService.getEmployeeSalaryHistory(EMPLOYEE_ID, {});
    expect(assertPermissionMock).toHaveBeenCalledWith(CURRENT_USER, "reports", "view");
    expect(listItemsForEmployeeMock).toHaveBeenCalledWith(COMPANY_ID, EMPLOYEE_ID, {});
  });
});
