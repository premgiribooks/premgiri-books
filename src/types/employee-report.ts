import type { PayrollRunListRow } from "@/types/payroll-run";

// 73-employee-reports.md — the four Employee Reports view-models, produced
// by src/engines/reporting/employee-reports.ts. No new Prisma model anywhere
// in this file — every figure is read directly from
// attendanceService.getAttendanceSummaryBulk, payrollRunService's own
// listPayrollRuns/getEmployeeSalaryHistory, or employeeService.listEmployees
// (never re-derived).

export interface AttendanceSummaryReportRow {
  employeeId: string;
  employeeCode: string;
  fullName: string;
  presentDays: number;
  halfDays: number;
  absentDays: number;
  onLeaveDays: number;
  totalMarkedDays: number;
  /** `(periodEnd - periodStart + 1) - totalMarkedDays` — a plain calendar-day
   * count computed by this module's own composition layer, not attendance
   * arithmetic (Business Rules #1: this report simply shows the gap, never
   * assuming an unmarked day means present or absent). */
  unmarkedDays: number;
}

export interface AttendanceSummaryReport {
  periodStart: string;
  periodEnd: string;
  rows: AttendanceSummaryReportRow[];
}

/** Business Rules #2 — a thin re-export of `payrollRunService.
 * listPayrollRuns`'s own rows, kept here for a single consistent import
 * surface across all four Employee Reports views. */
export interface PayrollRegisterReport {
  rows: PayrollRunListRow[];
}

export interface SalaryRegisterRow {
  payrollRunId: string;
  payrollNumber: string | null;
  periodStart: Date;
  periodEnd: Date;
  basicSalary: number;
  workedDays: number;
  totalDaysInPeriod: number;
  netSalary: number;
}

export interface SalaryRegisterReport {
  employeeId: string;
  employeeName: string;
  rows: SalaryRegisterRow[];
}

export interface EmployeeDirectoryRow {
  id: string;
  employeeCode: string;
  fullName: string;
  designation: string | null;
  department: string | null;
  branchName: string | null;
  isActive: boolean;
}

export interface EmployeeDirectoryReport {
  rows: EmployeeDirectoryRow[];
}
