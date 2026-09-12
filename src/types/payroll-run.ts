import type { PayrollRun as PrismaPayrollRun, PayrollRunItem as PrismaPayrollRunItem, PayrollRunStatus } from "@prisma/client";

export type { PayrollRunStatus };

// `totalNetSalary` normalized from Prisma `Decimal` to a plain `number` at
// the repository boundary (the Ledger.openingBalance/Employee.basicSalary
// convention), before crossing the Server Component / Server Action
// serialization boundary.
export interface PayrollRun extends Omit<PrismaPayrollRun, "totalNetSalary"> {
  totalNetSalary: number;
}

export interface PayrollRunItem extends Omit<PrismaPayrollRunItem, "basicSalary" | "workedDays" | "netSalary"> {
  basicSalary: number;
  workedDays: number;
  netSalary: number;
  employeeCode: string;
  fullName: string;
}

/** One computed line — shared shape between a DRAFT preview (not yet
 * persisted) and a persisted `PayrollRunItem` row. */
export interface PayrollRunLine {
  employeeId: string;
  employeeCode: string;
  fullName: string;
  basicSalary: number;
  totalDaysInPeriod: number;
  presentDays: number;
  halfDays: number;
  absentDays: number;
  onLeaveDays: number;
  workedDays: number;
  netSalary: number;
}

/** An active employee with no `basicSalary` set — excluded from a draft's
 * candidate lines, shown to the preparer for visibility (63-payroll.md's
 * Business Rules: "silently excluded ... but nothing blocks draft creation
 * over it"). */
export interface PayrollRunExcludedEmployee {
  employeeId: string;
  employeeCode: string;
  fullName: string;
  reason: "NO_BASIC_SALARY";
}

export interface PayrollRunListRow {
  id: string;
  payrollNumber: string | null;
  periodStart: Date;
  periodEnd: Date;
  status: PayrollRunStatus;
  totalNetSalary: number;
  narration: string | null;
  createdAt: Date;
}

export interface PayrollRunDetail extends PayrollRunListRow {
  companyId: string;
  financialYearId: string;
  voucherId: string | null;
  items: PayrollRunItem[];
}

export interface PayrollRunListFilters {
  search?: string;
  status?: PayrollRunStatus;
  dateFrom?: Date;
  dateTo?: Date;
}

/** The Create Payroll Run screen's live preview — computed, never persisted
 * until `createDraft` is called. */
export interface PayrollRunPreview {
  periodStart: string;
  periodEnd: string;
  totalDaysInPeriod: number;
  lines: PayrollRunLine[];
  excludedEmployees: PayrollRunExcludedEmployee[];
  totalNetSalary: number;
}

export interface PayrollRunFormOptions {
  nextPayrollNumber: string;
  isLedgerMappingComplete: boolean;
}

/**
 * 73-employee-reports.md's Salary Register — one row per `PayrollRunItem` a
 * given employee appears in across `POSTED` runs only.
 */
export interface EmployeeSalaryHistoryRow {
  payrollRunId: string;
  payrollNumber: string | null;
  periodStart: Date;
  periodEnd: Date;
  basicSalary: number;
  totalDaysInPeriod: number;
  workedDays: number;
  netSalary: number;
}

export interface EmployeeSalaryHistoryFilters {
  financialYearId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}
