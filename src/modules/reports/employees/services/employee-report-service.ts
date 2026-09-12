import type { Prisma } from "@prisma/client";

import { AppError } from "@/lib/app-error";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { assertPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  buildAttendanceSummaryReport,
  buildEmployeeDirectory,
  buildPayrollRegister,
  buildSalaryRegister,
} from "@/engines/reporting/employee-reports";
import { attendanceService } from "@/modules/attendance/services/attendance-service";
import { payrollRunService } from "@/modules/payroll/services/payroll-run-service";
import {
  attendanceSummaryFiltersSchema,
  employeeDirectoryFiltersSchema,
  payrollRegisterFiltersSchema,
  salaryRegisterFiltersSchema,
  toUtcDate,
  type AttendanceSummaryFiltersInput,
  type EmployeeDirectoryFiltersInput,
  type PayrollRegisterFiltersInput,
  type SalaryRegisterFiltersInput,
} from "@/modules/reports/employees/validation/employee-report-schema";
import type {
  AttendanceSummaryReport,
  EmployeeDirectoryReport,
  PayrollRegisterReport,
  SalaryRegisterReport,
} from "@/types/employee-report";

/**
 * 73-employee-reports.md's Employee Reports module — the layer every Server
 * Component page in this spec calls. Gates every public method on
 * `reports`/`view`, then delegates the actual read to
 * `attendanceService.getAttendanceSummaryBulk` (spec 62, amended),
 * `payrollRunService.listPayrollRunsForReport`/`getEmployeeSalaryHistory`
 * (spec 63, amended), and a direct Employee query, handing the result to the
 * Reporting Engine (employee-reports.ts) for shaping. This module owns no
 * table of its own (Data Model) — the direct Prisma read below is a
 * read-only Employee/Branch lookup, mirroring
 * customer-report-service.ts's own listReportCustomers precedent: the
 * seeded Accountant role has `reports`/`view` but not `employees`/`view`, so
 * routing this read through `employeeService.listEmployees` (which gates on
 * `employees`/`view`) would 403 exactly the role this module exists to
 * serve.
 */

interface ReportEmployeeRow {
  id: string;
  employeeCode: string;
  fullName: string;
  designation: string | null;
  department: string | null;
  branchId: string | null;
  branchName: string | null;
  isActive: boolean;
}

async function listReportEmployees(
  companyId: string,
  filters: {
    employeeId?: string;
    branchId?: string;
    department?: string;
    designation?: string;
    status?: "all" | "active" | "inactive";
  } = {}
): Promise<ReportEmployeeRow[]> {
  const where: Prisma.EmployeeWhereInput = { companyId };
  if (filters.employeeId) {
    where.id = filters.employeeId;
  }
  if (filters.branchId) {
    where.branchId = filters.branchId;
  }
  if (filters.department) {
    where.department = { contains: filters.department, mode: "insensitive" };
  }
  if (filters.designation) {
    where.designation = { contains: filters.designation, mode: "insensitive" };
  }
  if (filters.status === "active") {
    where.isActive = true;
  } else if (filters.status === "inactive") {
    where.isActive = false;
  }

  const employees = await prisma.employee.findMany({
    where,
    select: {
      id: true,
      employeeCode: true,
      fullName: true,
      designation: true,
      department: true,
      branchId: true,
      isActive: true,
      branch: { select: { branchName: true } },
    },
    orderBy: { fullName: "asc" },
  });

  return employees.map((employee) => ({
    id: employee.id,
    employeeCode: employee.employeeCode,
    fullName: employee.fullName,
    designation: employee.designation,
    department: employee.department,
    branchId: employee.branchId,
    branchName: employee.branch?.branchName ?? null,
    isActive: employee.isActive,
  }));
}

export const employeeReportService = {
  async getAttendanceSummaryReport(rawFilters: AttendanceSummaryFiltersInput): Promise<AttendanceSummaryReport> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "reports", "view");

    const filters = attendanceSummaryFiltersSchema.parse(rawFilters);

    const employees = await listReportEmployees(user.companyId, {
      employeeId: filters.employeeId,
      branchId: filters.branchId,
      status: "active",
    });
    if (employees.length === 0) {
      return { periodStart: filters.periodStart, periodEnd: filters.periodEnd, rows: [] };
    }

    const summaries = await attendanceService.getAttendanceSummaryBulk(
      employees.map((employee) => employee.id),
      filters.periodStart,
      filters.periodEnd
    );

    return buildAttendanceSummaryReport(filters.periodStart, filters.periodEnd, employees, summaries);
  },

  async getPayrollRegister(rawFilters: PayrollRegisterFiltersInput): Promise<PayrollRegisterReport> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "reports", "view");

    const filters = payrollRegisterFiltersSchema.parse(rawFilters);

    const rows = await payrollRunService.listPayrollRunsForReport({
      financialYearId: filters.financialYearId,
      status: filters.status === "all" ? undefined : filters.status,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
    });

    return buildPayrollRegister(rows);
  },

  async getSalaryRegister(rawFilters: SalaryRegisterFiltersInput): Promise<SalaryRegisterReport> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "reports", "view");

    const filters = salaryRegisterFiltersSchema.parse(rawFilters);

    const employee = await prisma.employee.findUnique({
      where: { id: filters.employeeId },
      select: { id: true, companyId: true, fullName: true },
    });
    if (!employee || employee.companyId !== user.companyId) {
      throw new AppError("Employee not found.");
    }

    const rows = await payrollRunService.getEmployeeSalaryHistory(filters.employeeId, {
      financialYearId: filters.financialYearId,
      dateFrom: filters.dateFrom ? toUtcDate(filters.dateFrom) : undefined,
      dateTo: filters.dateTo ? toUtcDate(filters.dateTo) : undefined,
    });

    return buildSalaryRegister(employee, rows);
  },

  async getEmployeeDirectory(rawFilters: EmployeeDirectoryFiltersInput): Promise<EmployeeDirectoryReport> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "reports", "view");

    const filters = employeeDirectoryFiltersSchema.parse(rawFilters);
    const employees = await listReportEmployees(user.companyId, {
      department: filters.department,
      designation: filters.designation,
      branchId: filters.branchId,
      status: filters.status,
    });

    return buildEmployeeDirectory(employees);
  },

  /** The Salary Register / Attendance Summary views' own employee picker. */
  async listEmployeeOptions(): Promise<{ id: string; name: string }[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "reports", "view");

    const employees = await prisma.employee.findMany({
      where: { companyId: user.companyId, isActive: true },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
    });
    return employees.map((employee) => ({ id: employee.id, name: employee.fullName }));
  },

  /** The Attendance Summary / Employee Directory views' own branch picker. */
  async listBranchOptions(): Promise<{ id: string; name: string }[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "reports", "view");

    const branches = await prisma.branch.findMany({
      where: { companyId: user.companyId, isActive: true },
      select: { id: true, branchName: true },
      orderBy: { branchName: "asc" },
    });
    return branches.map((branch) => ({ id: branch.id, name: branch.branchName }));
  },
};
