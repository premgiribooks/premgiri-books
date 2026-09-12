import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getCurrentCompanyUserMock,
  assertPermissionMock,
  getAttendanceSummaryBulkMock,
  listPayrollRunsForReportMock,
  getEmployeeSalaryHistoryMock,
  prismaEmployeeFindManyMock,
  prismaEmployeeFindUniqueMock,
  prismaBranchFindManyMock,
} = vi.hoisted(() => ({
  getCurrentCompanyUserMock: vi.fn(),
  assertPermissionMock: vi.fn(),
  getAttendanceSummaryBulkMock: vi.fn(),
  listPayrollRunsForReportMock: vi.fn(),
  getEmployeeSalaryHistoryMock: vi.fn(),
  prismaEmployeeFindManyMock: vi.fn(),
  prismaEmployeeFindUniqueMock: vi.fn(),
  prismaBranchFindManyMock: vi.fn(),
}));

vi.mock("@/lib/current-user", () => ({ getCurrentCompanyUser: getCurrentCompanyUserMock }));
vi.mock("@/lib/permissions", () => ({ assertPermission: assertPermissionMock }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    employee: { findMany: prismaEmployeeFindManyMock, findUnique: prismaEmployeeFindUniqueMock },
    branch: { findMany: prismaBranchFindManyMock },
  },
}));
vi.mock("@/modules/attendance/services/attendance-service", () => ({
  attendanceService: { getAttendanceSummaryBulk: getAttendanceSummaryBulkMock },
}));
vi.mock("@/modules/payroll/services/payroll-run-service", () => ({
  payrollRunService: {
    listPayrollRunsForReport: listPayrollRunsForReportMock,
    getEmployeeSalaryHistory: getEmployeeSalaryHistoryMock,
  },
}));

import { AppError } from "@/lib/app-error";
import { employeeReportService } from "@/modules/reports/employees/services/employee-report-service";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_COMPANY_ID = "22222222-2222-4222-8222-222222222222";
const EMPLOYEE_ID = "33333333-3333-4333-8333-333333333333";

function employeeRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: EMPLOYEE_ID,
    employeeCode: "EMP-001",
    fullName: "Asha Rao",
    designation: "Manager",
    department: "Sales",
    branchId: "branch-1",
    isActive: true,
    branch: { branchName: "Head Office" },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentCompanyUserMock.mockResolvedValue({ id: "user-1", companyId: COMPANY_ID, role: "Accountant" });
  assertPermissionMock.mockResolvedValue(undefined);
  prismaEmployeeFindManyMock.mockResolvedValue([employeeRow()]);
  prismaBranchFindManyMock.mockResolvedValue([{ id: "branch-1", branchName: "Head Office" }]);
});

describe("getAttendanceSummaryReport", () => {
  it("gates on reports/view and joins the bulk summary to every active employee", async () => {
    getAttendanceSummaryBulkMock.mockResolvedValue(
      new Map([[EMPLOYEE_ID, { presentDays: 31, halfDays: 0, absentDays: 0, onLeaveDays: 0, totalMarkedDays: 31 }]])
    );

    const report = await employeeReportService.getAttendanceSummaryReport({ periodStart: "2026-01-01", periodEnd: "2026-01-31" });

    expect(assertPermissionMock).toHaveBeenCalledWith(expect.anything(), "reports", "view");
    expect(getAttendanceSummaryBulkMock).toHaveBeenCalledWith([EMPLOYEE_ID], "2026-01-01", "2026-01-31");
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0].unmarkedDays).toBe(0);
  });

  it("returns an empty report without calling the bulk summary when no employees match the filters", async () => {
    prismaEmployeeFindManyMock.mockResolvedValue([]);

    const report = await employeeReportService.getAttendanceSummaryReport({ periodStart: "2026-01-01", periodEnd: "2026-01-31" });

    expect(report.rows).toEqual([]);
    expect(getAttendanceSummaryBulkMock).not.toHaveBeenCalled();
  });

  it("rejects a period whose start is after its end before ever querying employees", async () => {
    await expect(
      employeeReportService.getAttendanceSummaryReport({ periodStart: "2026-01-31", periodEnd: "2026-01-01" })
    ).rejects.toThrow();
    expect(prismaEmployeeFindManyMock).not.toHaveBeenCalled();
  });
});

describe("getPayrollRegister", () => {
  it("gates on reports/view and translates 'all' status into no filter", async () => {
    listPayrollRunsForReportMock.mockResolvedValue([]);

    await employeeReportService.getPayrollRegister({ status: "all" });

    expect(assertPermissionMock).toHaveBeenCalledWith(expect.anything(), "reports", "view");
    expect(listPayrollRunsForReportMock).toHaveBeenCalledWith(expect.objectContaining({ status: undefined }));
  });

  it("defaults to POSTED when no status is given", async () => {
    listPayrollRunsForReportMock.mockResolvedValue([]);
    await employeeReportService.getPayrollRegister({});
    expect(listPayrollRunsForReportMock).toHaveBeenCalledWith(expect.objectContaining({ status: "POSTED" }));
  });
});

describe("getSalaryRegister", () => {
  it("rejects a cross-company employeeId", async () => {
    prismaEmployeeFindUniqueMock.mockResolvedValue({ id: EMPLOYEE_ID, companyId: OTHER_COMPANY_ID, fullName: "Asha Rao" });

    await expect(employeeReportService.getSalaryRegister({ employeeId: EMPLOYEE_ID })).rejects.toThrow(AppError);
    expect(getEmployeeSalaryHistoryMock).not.toHaveBeenCalled();
  });

  it("delegates to payrollRunService.getEmployeeSalaryHistory for a same-company employee", async () => {
    prismaEmployeeFindUniqueMock.mockResolvedValue({ id: EMPLOYEE_ID, companyId: COMPANY_ID, fullName: "Asha Rao" });
    getEmployeeSalaryHistoryMock.mockResolvedValue([]);

    const report = await employeeReportService.getSalaryRegister({ employeeId: EMPLOYEE_ID });

    expect(getEmployeeSalaryHistoryMock).toHaveBeenCalledWith(EMPLOYEE_ID, expect.any(Object));
    expect(report.employeeName).toBe("Asha Rao");
  });
});

describe("getEmployeeDirectory", () => {
  it("gates on reports/view and defaults to active-only", async () => {
    await employeeReportService.getEmployeeDirectory({});
    expect(assertPermissionMock).toHaveBeenCalledWith(expect.anything(), "reports", "view");
    expect(prismaEmployeeFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ companyId: COMPANY_ID, isActive: true }) })
    );
  });

  it("presents the joined branch name for each row", async () => {
    const report = await employeeReportService.getEmployeeDirectory({});
    expect(report.rows[0].branchName).toBe("Head Office");
  });
});
