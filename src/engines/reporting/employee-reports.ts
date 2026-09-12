import type { AttendanceSummary } from "@/types/attendance";
import type { PayrollRunListRow } from "@/types/payroll-run";
import type {
  AttendanceSummaryReport,
  AttendanceSummaryReportRow,
  EmployeeDirectoryReport,
  EmployeeDirectoryRow,
  PayrollRegisterReport,
  SalaryRegisterReport,
  SalaryRegisterRow,
} from "@/types/employee-report";

// 73-employee-reports.md's Reporting Engine composition layer — pure
// functions only, no Prisma import anywhere in this file. Every attendance
// count is read as-is from attendanceService.getAttendanceSummaryBulk's own
// output (never re-derived/re-counted — Invariant "never re-implement
// getAttendanceSummary's per-status counting logic"); every payroll figure
// is read as-is from payrollRunService's own stored PayrollRunItem/PayrollRun
// snapshot values. Every data access happens in
// employee-report-service.ts, which passes already-fetched rows and query
// results in as plain arguments.

const ZERO_SUMMARY: AttendanceSummary = {
  presentDays: 0,
  halfDays: 0,
  absentDays: 0,
  onLeaveDays: 0,
  totalMarkedDays: 0,
};

/** Inclusive calendar-day count between two `YYYY-MM-DD` dates — a plain
 * calendar-day count computed by this module's own composition layer, never
 * attendance arithmetic (Business Rules #1). */
function totalCalendarDays(periodStart: string, periodEnd: string): number {
  const start = new Date(`${periodStart}T00:00:00.000Z`);
  const end = new Date(`${periodEnd}T00:00:00.000Z`);
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((end.getTime() - start.getTime()) / msPerDay) + 1;
}

export interface AttendanceSummaryEmployeeRow {
  id: string;
  employeeCode: string;
  fullName: string;
}

/**
 * Business Rules #1 — one row per employee, joining
 * `attendanceService.getAttendanceSummaryBulk`'s own per-employee map to the
 * requested employee set. An employee absent from the map (no attendance
 * rows at all in the period) gets an all-zero summary, mirroring
 * `getAttendanceSummary`'s own "no row is absent from every count" behavior.
 * `unmarkedDays` is this report's own plain subtraction, never an assumption
 * about what an unmarked day means.
 */
export function buildAttendanceSummaryReport(
  periodStart: string,
  periodEnd: string,
  employees: readonly AttendanceSummaryEmployeeRow[],
  summaries: ReadonlyMap<string, AttendanceSummary>
): AttendanceSummaryReport {
  const totalDays = totalCalendarDays(periodStart, periodEnd);

  const rows: AttendanceSummaryReportRow[] = employees.map((employee) => {
    const summary = summaries.get(employee.id) ?? ZERO_SUMMARY;
    return {
      employeeId: employee.id,
      employeeCode: employee.employeeCode,
      fullName: employee.fullName,
      presentDays: summary.presentDays,
      halfDays: summary.halfDays,
      absentDays: summary.absentDays,
      onLeaveDays: summary.onLeaveDays,
      totalMarkedDays: summary.totalMarkedDays,
      unmarkedDays: totalDays - summary.totalMarkedDays,
    };
  });

  return { periodStart, periodEnd, rows };
}

/** Business Rules #2 — a thin re-export of `payrollRunService.
 * listPayrollRuns`'s own rows, kept here for a single consistent import
 * surface across all four views (the spec 71/72 precedent). */
export function buildPayrollRegister(rows: readonly PayrollRunListRow[]): PayrollRegisterReport {
  return { rows: [...rows] };
}

/** Business Rules #3 — a thin re-export of `payrollRunService.
 * getEmployeeSalaryHistory`'s own rows (already `POSTED`-only, per that
 * service's own filtering), unmodified. */
export function buildSalaryRegister(
  employee: { id: string; fullName: string },
  rows: readonly SalaryRegisterRow[]
): SalaryRegisterReport {
  return { employeeId: employee.id, employeeName: employee.fullName, rows: [...rows] };
}

/** Business Rules #4 — a straightforward presentation of the Employee rows already fetched. */
export function buildEmployeeDirectory(rows: readonly EmployeeDirectoryRow[]): EmployeeDirectoryReport {
  return { rows: [...rows] };
}
