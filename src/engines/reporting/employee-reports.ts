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
import type { ReportExportColumn, ReportExportTable } from "@/types/report-export";

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

type AttendanceSummaryExportRow = Record<string, string | number | null>;

const ATTENDANCE_SUMMARY_EXPORT_COLUMNS: ReportExportColumn[] = [
  { key: "employeeCode", header: "Employee Code", type: "string" },
  { key: "fullName", header: "Employee Name", type: "string" },
  { key: "presentDays", header: "Present", type: "number" },
  { key: "halfDays", header: "Half Day", type: "number" },
  { key: "absentDays", header: "Absent", type: "number" },
  { key: "onLeaveDays", header: "On Leave", type: "number" },
  { key: "totalMarkedDays", header: "Total Marked", type: "number" },
  { key: "unmarkedDays", header: "Unmarked", type: "number" },
];

/**
 * Flattens buildAttendanceSummaryReport's rows into
 * src/lib/excel-export.ts's shared contract, mirroring
 * employee-attendance-summary-table.tsx's own column set exactly — its
 * single combined "Employee" cell (name + code) split into separate Code/
 * Name columns, matching sales-reports.ts's identical Product Name/Code
 * precedent for a flat export grid. No totals footer — the on-screen table
 * has none.
 */
export function toAttendanceSummaryExportTable(report: AttendanceSummaryReport): ReportExportTable[] {
  const rows: AttendanceSummaryExportRow[] = report.rows.map((row) => ({
    employeeCode: row.employeeCode,
    fullName: row.fullName,
    presentDays: row.presentDays,
    halfDays: row.halfDays,
    absentDays: row.absentDays,
    onLeaveDays: row.onLeaveDays,
    totalMarkedDays: row.totalMarkedDays,
    unmarkedDays: row.unmarkedDays,
  }));

  return [
    {
      sheetName: "Attendance Summary",
      columns: ATTENDANCE_SUMMARY_EXPORT_COLUMNS,
      rows,
    },
  ];
}

type EmployeeDirectoryExportRow = Record<string, string | number | null>;

const EMPLOYEE_DIRECTORY_EXPORT_COLUMNS: ReportExportColumn[] = [
  { key: "employeeCode", header: "Code", type: "string" },
  { key: "fullName", header: "Name", type: "string" },
  { key: "designation", header: "Designation", type: "string" },
  { key: "department", header: "Department", type: "string" },
  { key: "branchName", header: "Branch", type: "string" },
  { key: "status", header: "Status", type: "string" },
];

/**
 * Flattens buildEmployeeDirectory's rows into src/lib/excel-export.ts's
 * shared contract, mirroring employee-directory-table.tsx's own column set
 * exactly. No totals footer — a contact directory has nothing to sum
 * (customer-directory-table.tsx's identical precedent).
 */
export function toEmployeeDirectoryExportTable(report: EmployeeDirectoryReport): ReportExportTable[] {
  const rows: EmployeeDirectoryExportRow[] = report.rows.map((row) => ({
    employeeCode: row.employeeCode,
    fullName: row.fullName,
    designation: row.designation ?? "",
    department: row.department ?? "",
    branchName: row.branchName ?? "",
    status: row.isActive ? "Active" : "Inactive",
  }));

  return [
    {
      sheetName: "Employee Directory",
      columns: EMPLOYEE_DIRECTORY_EXPORT_COLUMNS,
      rows,
    },
  ];
}

type PayrollRegisterExportRow = Record<string, string | number | Date | null>;

const PAYROLL_REGISTER_EXPORT_COLUMNS: ReportExportColumn[] = [
  { key: "payrollNumber", header: "Payroll Number", type: "string" },
  { key: "periodStart", header: "Period Start", type: "date" },
  { key: "periodEnd", header: "Period End", type: "date" },
  { key: "status", header: "Status", type: "string" },
  { key: "totalNetSalary", header: "Total Net Salary", type: "currency" },
];

/**
 * Flattens buildPayrollRegister's rows (a thin re-export of
 * payrollRunService.listPayrollRunsForReport's own PayrollRunListRow[])
 * into src/lib/excel-export.ts's shared contract, mirroring
 * employee-payroll-register-table.tsx's own column set exactly — its
 * combined "Period" cell split into separate Start/End date columns for the
 * flat export grid. No totals footer — the on-screen table has none.
 */
export function toPayrollRegisterExportTable(report: PayrollRegisterReport): ReportExportTable[] {
  const rows: PayrollRegisterExportRow[] = report.rows.map((run) => ({
    payrollNumber: run.payrollNumber ?? "",
    periodStart: run.periodStart,
    periodEnd: run.periodEnd,
    status: run.status,
    totalNetSalary: run.totalNetSalary,
  }));

  return [
    {
      sheetName: "Payroll Register",
      columns: PAYROLL_REGISTER_EXPORT_COLUMNS,
      rows,
    },
  ];
}

type SalaryRegisterExportRow = Record<string, string | number | Date | null>;

const SALARY_REGISTER_EXPORT_COLUMNS: ReportExportColumn[] = [
  { key: "payrollNumber", header: "Payroll Number", type: "string" },
  { key: "periodStart", header: "Period Start", type: "date" },
  { key: "periodEnd", header: "Period End", type: "date" },
  { key: "basicSalary", header: "Basic Salary", type: "currency" },
  { key: "workedDays", header: "Worked Days", type: "number" },
  { key: "totalDaysInPeriod", header: "Total Days", type: "number" },
  { key: "netSalary", header: "Net Salary", type: "currency" },
];

/**
 * Flattens buildSalaryRegister's POSTED-only rows into
 * src/lib/excel-export.ts's shared contract, mirroring
 * employee-salary-register-table.tsx's own column set exactly — its
 * combined "Period" cell split into separate Start/End date columns. The
 * employee's name is carried as the sheet `title`, mirroring
 * toCustomerStatementExportTable's identical single-party-report
 * convention. No totals footer — the on-screen table has none.
 */
export function toSalaryRegisterExportTable(report: SalaryRegisterReport): ReportExportTable[] {
  const rows: SalaryRegisterExportRow[] = report.rows.map((row) => ({
    payrollNumber: row.payrollNumber ?? "",
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    basicSalary: row.basicSalary,
    workedDays: row.workedDays,
    totalDaysInPeriod: row.totalDaysInPeriod,
    netSalary: row.netSalary,
  }));

  return [
    {
      sheetName: "Salary Register",
      title: report.employeeName,
      columns: SALARY_REGISTER_EXPORT_COLUMNS,
      rows,
    },
  ];
}
