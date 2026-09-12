import { describe, expect, it } from "vitest";

import {
  buildAttendanceSummaryReport,
  buildEmployeeDirectory,
  buildPayrollRegister,
  buildSalaryRegister,
  type AttendanceSummaryEmployeeRow,
} from "@/engines/reporting/employee-reports";
import type { AttendanceSummary } from "@/types/attendance";
import type { EmployeeDirectoryRow, SalaryRegisterRow } from "@/types/employee-report";
import type { PayrollRunListRow } from "@/types/payroll-run";

function employeeRow(overrides: Partial<AttendanceSummaryEmployeeRow> = {}): AttendanceSummaryEmployeeRow {
  return { id: "emp-1", employeeCode: "EMP-001", fullName: "Asha Rao", ...overrides };
}

describe("buildAttendanceSummaryReport", () => {
  it("computes unmarkedDays as a plain calendar-day subtraction, never attendance arithmetic", () => {
    const summaries = new Map<string, AttendanceSummary>([
      ["emp-1", { presentDays: 20, halfDays: 2, absentDays: 3, onLeaveDays: 1, totalMarkedDays: 26 }],
    ]);

    const report = buildAttendanceSummaryReport("2026-01-01", "2026-01-31", [employeeRow()], summaries);

    expect(report.rows).toEqual([
      {
        employeeId: "emp-1",
        employeeCode: "EMP-001",
        fullName: "Asha Rao",
        presentDays: 20,
        halfDays: 2,
        absentDays: 3,
        onLeaveDays: 1,
        totalMarkedDays: 26,
        // 31-day January period, 26 marked -> 5 unmarked.
        unmarkedDays: 5,
      },
    ]);
  });

  it("gives an employee absent from the summary map an all-zero row (never assuming present/absent)", () => {
    const report = buildAttendanceSummaryReport("2026-01-01", "2026-01-31", [employeeRow()], new Map());

    expect(report.rows[0]).toEqual(
      expect.objectContaining({
        presentDays: 0,
        halfDays: 0,
        absentDays: 0,
        onLeaveDays: 0,
        totalMarkedDays: 0,
        unmarkedDays: 31,
      })
    );
  });

  it("computes a single-day period's unmarkedDays correctly", () => {
    const summaries = new Map<string, AttendanceSummary>([
      ["emp-1", { presentDays: 1, halfDays: 0, absentDays: 0, onLeaveDays: 0, totalMarkedDays: 1 }],
    ]);
    const report = buildAttendanceSummaryReport("2026-01-15", "2026-01-15", [employeeRow()], summaries);
    expect(report.rows[0].unmarkedDays).toBe(0);
  });
});

describe("buildPayrollRegister", () => {
  it("re-exports the given rows unmodified", () => {
    const rows: PayrollRunListRow[] = [
      {
        id: "run-1",
        payrollNumber: "PAY-0001",
        periodStart: new Date("2026-01-01"),
        periodEnd: new Date("2026-01-31"),
        status: "POSTED",
        totalNetSalary: 30000,
        narration: null,
        createdAt: new Date("2026-02-01"),
      },
    ];
    expect(buildPayrollRegister(rows).rows).toEqual(rows);
  });
});

describe("buildSalaryRegister", () => {
  it("attaches the employee's identity to the re-exported rows", () => {
    const rows: SalaryRegisterRow[] = [
      {
        payrollRunId: "run-1",
        payrollNumber: "PAY-0001",
        periodStart: new Date("2026-01-01"),
        periodEnd: new Date("2026-01-31"),
        basicSalary: 30000,
        totalDaysInPeriod: 31,
        workedDays: 31,
        netSalary: 30000,
      },
    ];

    const report = buildSalaryRegister({ id: "emp-1", fullName: "Asha Rao" }, rows);

    expect(report).toEqual({ employeeId: "emp-1", employeeName: "Asha Rao", rows });
  });
});

describe("buildEmployeeDirectory", () => {
  it("re-exports the given rows unmodified", () => {
    const rows: EmployeeDirectoryRow[] = [
      {
        id: "emp-1",
        employeeCode: "EMP-001",
        fullName: "Asha Rao",
        designation: "Manager",
        department: "Sales",
        branchName: "Head Office",
        isActive: true,
      },
    ];
    expect(buildEmployeeDirectory(rows).rows).toEqual(rows);
  });
});
