import { z } from "zod";

import { isValidCalendarDate, toUtcDate } from "@/modules/reports/validation/financial-report-filters-schema";

export { toUtcDate };

// 73-employee-reports.md's Validation section. Employee Master/Attendance
// have no `financialYearId` (neither document is FY-scoped, per specs
// 61/62's own decisions) — only Payroll is FY-scoped, so only the Payroll
// Register/Salary Register schemas below carry that field, rather than
// forcing a uniform FY filter across all three data sources.

const CALENDAR_DATE = z.string().trim().refine(isValidCalendarDate, "Enter a valid date");

const EMPLOYEE_STATUS_VALUES = ["all", "active", "inactive"] as const;

function refineDateRange<T extends { periodStart: string; periodEnd: string }>(schema: z.ZodType<T>) {
  return schema.refine((data) => toUtcDate(data.periodEnd).getTime() >= toUtcDate(data.periodStart).getTime(), {
    message: "Period end must be on or after the period start",
    path: ["periodEnd"],
  });
}

// Attendance Summary Report — periodStart/periodEnd required
// (`getAttendanceSummaryBulk` itself requires an explicit range, per
// 62-attendance.md's own signature); employeeId/branchId optional.
export const attendanceSummaryFiltersSchema = refineDateRange(
  z.object({
    periodStart: CALENDAR_DATE,
    periodEnd: CALENDAR_DATE,
    employeeId: z.uuid("Select a valid employee").optional(),
    branchId: z.uuid("Select a valid branch").optional(),
  })
);
export type AttendanceSummaryFiltersInput = z.infer<typeof attendanceSummaryFiltersSchema>;

// Payroll Register — reuses payrollRunService.listPayrollRuns's own filter
// shape (financialYearId optional/defaults to active FY, date range
// optional, status optional/defaults to POSTED). "all" lifts the status
// filter entirely, for the reconciliation override Business Rules #2 allows.
const PAYROLL_REGISTER_STATUS_VALUES = ["all", "DRAFT", "POSTED", "CANCELLED"] as const;

export const payrollRegisterFiltersSchema = z.object({
  financialYearId: z.uuid("Select a valid financial year").optional(),
  dateFrom: CALENDAR_DATE.optional(),
  dateTo: CALENDAR_DATE.optional(),
  status: z.enum(PAYROLL_REGISTER_STATUS_VALUES).optional().default("POSTED"),
});
export type PayrollRegisterFiltersInput = z.input<typeof payrollRegisterFiltersSchema>;

// Salary Register — employeeId required (Business Rules #3); financialYearId
// deliberately optional with no default (an employee's salary history
// naturally spans multiple FYs, unlike Payroll Register's own single-FY
// default).
export const salaryRegisterFiltersSchema = z.object({
  employeeId: z.uuid("Select an employee"),
  financialYearId: z.uuid("Select a valid financial year").optional(),
  dateFrom: CALENDAR_DATE.optional(),
  dateTo: CALENDAR_DATE.optional(),
});
export type SalaryRegisterFiltersInput = z.infer<typeof salaryRegisterFiltersSchema>;

// Employee Directory — department/designation free-text contains-match (no
// enum on Employee for either, per 61-employee-master.md's own decision).
export const employeeDirectoryFiltersSchema = z.object({
  department: z.string().trim().max(100, "Department must be at most 100 characters").optional(),
  designation: z.string().trim().max(100, "Designation must be at most 100 characters").optional(),
  branchId: z.uuid("Select a valid branch").optional(),
  status: z.enum(EMPLOYEE_STATUS_VALUES).optional().default("active"),
});
export type EmployeeDirectoryFiltersInput = z.input<typeof employeeDirectoryFiltersSchema>;
