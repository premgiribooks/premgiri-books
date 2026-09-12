import { Prisma, type Attendance as PrismaAttendance } from "@prisma/client";

import { AppError } from "@/lib/app-error";
import { prisma } from "@/lib/prisma";
import { runInTransaction } from "@/lib/transaction";
import type { AttendanceListFilters, AttendanceSummary, AttendanceWithRelations } from "@/types/attendance";

export const EMPLOYEE_NOT_FOUND_MESSAGE = "Selected employee was not found.";
export const EMPLOYEE_INACTIVE_MESSAGE = "Selected employee is inactive.";

export interface AttendanceEntryData {
  employeeId: string;
  date: Date;
  status: PrismaAttendance["status"];
  remarks: string | null;
}

const EMPLOYEE_OPTION_SELECT = { id: true, employeeCode: true, fullName: true, isActive: true } as const;

const ATTENDANCE_INCLUDE = { employee: { select: EMPLOYEE_OPTION_SELECT } } as const;

/**
 * The employee referenced by an attendance mark must belong to the same
 * company and be active at entry time — a deactivated employee keeps all
 * historical attendance visible, but marking NEW attendance against one is
 * rejected (62-attendance.md's Business Rules, mirroring
 * employee-repository.ts's assertAssignableBranch/assertAssignableUser
 * posture: a cross-company employee reports the same message as a
 * nonexistent one).
 */
export async function assertActiveEmployee(
  tx: Prisma.TransactionClient,
  companyId: string,
  employeeId: string
): Promise<{ branchId: string | null }> {
  const employee = await tx.employee.findUnique({ where: { id: employeeId } });
  if (!employee || employee.companyId !== companyId) {
    throw new AppError(EMPLOYEE_NOT_FOUND_MESSAGE);
  }
  if (!employee.isActive) {
    throw new AppError(EMPLOYEE_INACTIVE_MESSAGE);
  }
  return { branchId: employee.branchId };
}

/**
 * The batch equivalent of assertActiveEmployee — one query for every
 * distinct employeeId in the batch (a "single employee across a date range"
 * bulk entry can repeat the same id up to 500 times) rather than a
 * findUnique per entry, then re-checked in-memory per entry so the same
 * not-found/inactive rules apply to every row.
 */
async function assertActiveEmployees(
  tx: Prisma.TransactionClient,
  companyId: string,
  employeeIds: readonly string[]
): Promise<Map<string, { branchId: string | null }>> {
  const distinctIds = [...new Set(employeeIds)];
  const employees = await tx.employee.findMany({ where: { id: { in: distinctIds } } });
  const byId = new Map(employees.map((employee) => [employee.id, employee]));

  const result = new Map<string, { branchId: string | null }>();
  for (const employeeId of distinctIds) {
    const employee = byId.get(employeeId);
    if (!employee || employee.companyId !== companyId) {
      throw new AppError(EMPLOYEE_NOT_FOUND_MESSAGE);
    }
    if (!employee.isActive) {
      throw new AppError(EMPLOYEE_INACTIVE_MESSAGE);
    }
    result.set(employeeId, { branchId: employee.branchId });
  }
  return result;
}

function buildWhere(companyId: string, filters: AttendanceListFilters): Prisma.AttendanceWhereInput {
  const where: Prisma.AttendanceWhereInput = { companyId };

  if (filters.employeeId) {
    where.employeeId = filters.employeeId;
  }
  if (filters.branchId) {
    where.branchId = filters.branchId;
  }
  if (filters.status) {
    where.status = filters.status;
  }
  if (filters.dateFrom || filters.dateTo) {
    where.date = {
      ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
      ...(filters.dateTo ? { lte: filters.dateTo } : {}),
    };
  }

  return where;
}

export const attendanceRepository = {
  async findMany(
    companyId: string,
    filters: AttendanceListFilters = {}
  ): Promise<AttendanceWithRelations[]> {
    return prisma.attendance.findMany({
      where: buildWhere(companyId, filters),
      include: ATTENDANCE_INCLUDE,
      orderBy: [{ date: "desc" }, { employee: { fullName: "asc" } }],
    });
  },

  // A single-row upsert against @@unique([companyId, employeeId, date]) — a
  // second mark for the same employee/date overwrites the first rather than
  // creating a duplicate (62-attendance.md's Business Rules).
  async upsertOne(companyId: string, data: AttendanceEntryData): Promise<PrismaAttendance> {
    return runInTransaction(async (tx) => {
      const { branchId } = await assertActiveEmployee(tx, companyId, data.employeeId);
      return tx.attendance.upsert({
        where: {
          companyId_employeeId_date: { companyId, employeeId: data.employeeId, date: data.date },
        },
        create: { companyId, branchId, ...data },
        update: { status: data.status, remarks: data.remarks },
      });
    });
  },

  /**
   * Bulk roster entry (a whole day for many employees, or one employee
   * across a date range) — every row upserted inside one transaction so a
   * partial-batch failure never leaves half the batch recorded
   * (62-attendance.md's Business Rules). Each entry re-verifies its own
   * employee, since a batch can legitimately mix employees.
   */
  async upsertMany(companyId: string, entries: AttendanceEntryData[]): Promise<number> {
    return runInTransaction(async (tx) => {
      const employeesById = await assertActiveEmployees(
        tx,
        companyId,
        entries.map((entry) => entry.employeeId)
      );

      for (const entry of entries) {
        const employee = employeesById.get(entry.employeeId);
        if (!employee) {
          // Unreachable: assertActiveEmployees resolves every distinct
          // employeeId present in `entries`, or throws before this loop runs.
          throw new AppError(EMPLOYEE_NOT_FOUND_MESSAGE);
        }
        const { branchId } = employee;
        await tx.attendance.upsert({
          where: {
            companyId_employeeId_date: {
              companyId,
              employeeId: entry.employeeId,
              date: entry.date,
            },
          },
          create: { companyId, branchId, ...entry },
          update: { status: entry.status, remarks: entry.remarks },
        });
      }
      return entries.length;
    });
  },

  /**
   * Per-status counts for the inclusive [periodStart, periodEnd] range — a
   * live groupBy/count over Attendance rows, never a materialized aggregate
   * (62-attendance.md's Granularity Decision). Days with no row at all are
   * simply absent from every count.
   */
  async getSummary(
    companyId: string,
    employeeId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<AttendanceSummary> {
    const grouped = await prisma.attendance.groupBy({
      by: ["status"],
      where: { companyId, employeeId, date: { gte: periodStart, lte: periodEnd } },
      _count: { _all: true },
    });

    const countOf = (status: PrismaAttendance["status"]) =>
      grouped.find((row) => row.status === status)?._count._all ?? 0;

    const presentDays = countOf("PRESENT");
    const halfDays = countOf("HALF_DAY");
    const absentDays = countOf("ABSENT");
    const onLeaveDays = countOf("ON_LEAVE");

    return {
      presentDays,
      halfDays,
      absentDays,
      onLeaveDays,
      totalMarkedDays: presentDays + halfDays + absentDays + onLeaveDays,
    };
  },

  /**
   * 73-employee-reports.md's batching optimization for its own Attendance
   * Summary Report — the identical per-status counting logic `getSummary`
   * performs for one employee, parameterized to run once across many
   * `employeeId`s via a single `groupBy` on `[employeeId, status]`, reshaped
   * into one per-employee result map. Never a second, divergent
   * implementation of the counting logic; an employee with no rows in the
   * range simply gets an all-zero summary (mirrors `getSummary`'s own
   * "no row is absent from every count" behavior).
   */
  async aggregateSummaryForEmployees(
    companyId: string,
    employeeIds: readonly string[],
    periodStart: Date,
    periodEnd: Date
  ): Promise<Map<string, AttendanceSummary>> {
    const distinctIds = [...new Set(employeeIds)];
    const result = new Map<string, AttendanceSummary>(
      distinctIds.map((employeeId) => [
        employeeId,
        { presentDays: 0, halfDays: 0, absentDays: 0, onLeaveDays: 0, totalMarkedDays: 0 },
      ])
    );
    if (distinctIds.length === 0) {
      return result;
    }

    const grouped = await prisma.attendance.groupBy({
      by: ["employeeId", "status"],
      where: { companyId, employeeId: { in: distinctIds }, date: { gte: periodStart, lte: periodEnd } },
      _count: { _all: true },
    });

    for (const row of grouped) {
      const summary = result.get(row.employeeId);
      if (!summary) {
        continue;
      }
      const count = row._count._all;
      if (row.status === "PRESENT") {
        summary.presentDays += count;
      } else if (row.status === "HALF_DAY") {
        summary.halfDays += count;
      } else if (row.status === "ABSENT") {
        summary.absentDays += count;
      } else if (row.status === "ON_LEAVE") {
        summary.onLeaveDays += count;
      }
      summary.totalMarkedDays += count;
    }

    return result;
  },
};
