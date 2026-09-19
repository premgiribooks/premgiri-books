import { describe, expect, it } from "vitest";

import {
  buildAttendanceSummaryReport,
  buildEmployeeDirectory,
  buildPayrollRegister,
  buildSalaryRegister,
  toAttendanceSummaryExportTable,
  toEmployeeDirectoryExportTable,
  toPayrollRegisterExportTable,
  toSalaryRegisterExportTable,
  type AttendanceSummaryEmployeeRow,
} from "@/engines/reporting/employee-reports";
import type { AttendanceSummary } from "@/types/attendance";
import type {
  AttendanceSummaryReport,
  EmployeeDirectoryReport,
  EmployeeDirectoryRow,
  PayrollRegisterReport,
  SalaryRegisterReport,
  SalaryRegisterRow,
} from "@/types/employee-report";
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

describe("toAttendanceSummaryExportTable", () => {
  it("flattens rows into a single sheet with the on-screen table's exact columns, and no totals footer", () => {
    const report: AttendanceSummaryReport = {
      periodStart: "2026-01-01",
      periodEnd: "2026-01-31",
      rows: [
        {
          employeeId: "emp-1",
          employeeCode: "EMP-001",
          fullName: "Asha Rao",
          presentDays: 20,
          halfDays: 2,
          absentDays: 3,
          onLeaveDays: 1,
          totalMarkedDays: 26,
          unmarkedDays: 5,
        },
      ],
    };

    const tables = toAttendanceSummaryExportTable(report);

    expect(tables).toHaveLength(1);
    expect(tables[0].sheetName).toBe("Attendance Summary");
    expect(tables[0].totals).toBeUndefined();
    expect(tables[0].rows).toEqual([
      {
        employeeCode: "EMP-001",
        fullName: "Asha Rao",
        presentDays: 20,
        halfDays: 2,
        absentDays: 3,
        onLeaveDays: 1,
        totalMarkedDays: 26,
        unmarkedDays: 5,
      },
    ]);
  });
});

describe("toEmployeeDirectoryExportTable", () => {
  it("flattens rows, mapping isActive to a Status label and null fields to empty strings", () => {
    const report: EmployeeDirectoryReport = {
      rows: [
        {
          id: "emp-1",
          employeeCode: "EMP-001",
          fullName: "Asha Rao",
          designation: null,
          department: null,
          branchName: null,
          isActive: false,
        },
      ],
    };

    const tables = toEmployeeDirectoryExportTable(report);

    expect(tables).toHaveLength(1);
    expect(tables[0].sheetName).toBe("Employee Directory");
    expect(tables[0].totals).toBeUndefined();
    expect(tables[0].rows).toEqual([
      {
        employeeCode: "EMP-001",
        fullName: "Asha Rao",
        designation: "",
        department: "",
        branchName: "",
        status: "Inactive",
      },
    ]);
  });
});

describe("toPayrollRegisterExportTable", () => {
  it("flattens rows, splitting the combined Period cell into separate Start/End date columns, with no totals footer", () => {
    const report: PayrollRegisterReport = {
      rows: [
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
      ],
    };

    const tables = toPayrollRegisterExportTable(report);

    expect(tables).toHaveLength(1);
    expect(tables[0].sheetName).toBe("Payroll Register");
    expect(tables[0].totals).toBeUndefined();
    expect(tables[0].rows).toEqual([
      {
        payrollNumber: "PAY-0001",
        periodStart: new Date("2026-01-01"),
        periodEnd: new Date("2026-01-31"),
        status: "POSTED",
        totalNetSalary: 30000,
      },
    ]);
  });

  it("falls back to an empty string for a null payrollNumber", () => {
    const report: PayrollRegisterReport = {
      rows: [
        {
          id: "run-1",
          payrollNumber: null,
          periodStart: new Date("2026-01-01"),
          periodEnd: new Date("2026-01-31"),
          status: "DRAFT",
          totalNetSalary: 0,
          narration: null,
          createdAt: new Date("2026-02-01"),
        },
      ],
    };

    expect(toPayrollRegisterExportTable(report)[0].rows[0].payrollNumber).toBe("");
  });
});

describe("toSalaryRegisterExportTable", () => {
  it("flattens rows with the employee's name carried as the sheet title, and no totals footer", () => {
    const report: SalaryRegisterReport = {
      employeeId: "emp-1",
      employeeName: "Asha Rao",
      rows: [
        {
          payrollRunId: "run-1",
          payrollNumber: "PAY-0001",
          periodStart: new Date("2026-01-01"),
          periodEnd: new Date("2026-01-31"),
          basicSalary: 30000,
          workedDays: 31,
          totalDaysInPeriod: 31,
          netSalary: 30000,
        },
      ],
    };

    const tables = toSalaryRegisterExportTable(report);

    expect(tables).toHaveLength(1);
    expect(tables[0].sheetName).toBe("Salary Register");
    expect(tables[0].title).toBe("Asha Rao");
    expect(tables[0].totals).toBeUndefined();
    expect(tables[0].rows).toEqual([
      {
        payrollNumber: "PAY-0001",
        periodStart: new Date("2026-01-01"),
        periodEnd: new Date("2026-01-31"),
        basicSalary: 30000,
        workedDays: 31,
        totalDaysInPeriod: 31,
        netSalary: 30000,
      },
    ]);
  });

  it("falls back to an empty string for a null payrollNumber", () => {
    const report: SalaryRegisterReport = {
      employeeId: "emp-1",
      employeeName: "Asha Rao",
      rows: [
        {
          payrollRunId: "run-1",
          payrollNumber: null,
          periodStart: new Date("2026-01-01"),
          periodEnd: new Date("2026-01-31"),
          basicSalary: 30000,
          workedDays: 31,
          totalDaysInPeriod: 31,
          netSalary: 30000,
        },
      ],
    };

    expect(toSalaryRegisterExportTable(report)[0].rows[0].payrollNumber).toBe("");
  });
});
