import { AppError } from "@/lib/app-error";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { assertPermission } from "@/lib/permissions";
import {
  attendanceRepository,
  type AttendanceEntryData,
} from "@/modules/attendance/repositories/attendance-repository";
import {
  isValidCalendarDate,
  markAttendanceBulkSchema,
  markAttendanceEntrySchema,
  toUtcDate,
  type MarkAttendanceBulkInput,
  type MarkAttendanceEntryInput,
} from "@/modules/attendance/validation/attendance-schema";
import type {
  Attendance,
  AttendanceListFilters,
  AttendanceSummary,
  AttendanceWithRelations,
} from "@/types/attendance";

function toEntryData(input: MarkAttendanceEntryInput): AttendanceEntryData {
  return {
    employeeId: input.employeeId,
    date: toUtcDate(input.date),
    status: input.status,
    remarks: input.remarks ?? null,
  };
}

export const attendanceService = {
  async listAttendance(filters: AttendanceListFilters = {}): Promise<AttendanceWithRelations[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "employees", "view");
    return attendanceRepository.findMany(user.companyId, filters);
  },

  // The roster page's single-row mark — an upsert, never a separate "edit"
  // action, per 62-attendance.md's Security section.
  async markAttendance(input: MarkAttendanceEntryInput): Promise<Attendance> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "employees", "create");

    const data = markAttendanceEntrySchema.parse(input);
    return attendanceRepository.upsertOne(user.companyId, toEntryData(data));
  },

  // A whole day for many employees, or one employee across a date range —
  // both resolve to the same per-row upsert inside one transaction
  // (62-attendance.md's Business Rules).
  async markAttendanceBulk(input: MarkAttendanceBulkInput): Promise<number> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "employees", "create");

    const entries = markAttendanceBulkSchema.parse(input);
    return attendanceRepository.upsertMany(user.companyId, entries.map(toEntryData));
  },

  /**
   * The query Payroll (63-payroll.md) consumes directly — raw per-status
   * counts for the inclusive [periodStart, periodEnd] range, never a
   * pre-blended "worked days" figure (62-attendance.md's Business Rules).
   */
  async getAttendanceSummary(
    employeeId: string,
    periodStart: string,
    periodEnd: string
  ): Promise<AttendanceSummary> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "employees", "view");

    if (!isValidCalendarDate(periodStart) || !isValidCalendarDate(periodEnd)) {
      throw new AppError("Enter a valid date range.");
    }
    const start = toUtcDate(periodStart);
    const end = toUtcDate(periodEnd);
    if (start > end) {
      throw new AppError("The period's start date must not be after its end date.");
    }

    return attendanceRepository.getSummary(user.companyId, employeeId, start, end);
  },

  /**
   * 73-employee-reports.md's Attendance Summary Report calls this — never
   * `attendanceRepository` directly, and never `getAttendanceSummary` in a
   * per-employee loop (which would be N+1 for a company-wide report). A
   * thin pass-through exposing the batched repository method, mirroring how
   * `getAttendanceSummary` itself is exposed. Gated on `reports`/`view`, not
   * `employees`/`view` — its only caller is Employee Reports, and the seeded
   * Accountant role has `reports`/`view` but no `employees` module access at
   * all (the same `listPayrollRunsForReport`/`getEmployeeSalaryHistory`
   * precedent this batch already established; code-review fix, 2026-09-12 —
   * this method was left on the wrong gate, which would have 403'd the exact
   * role the whole batch of re-gating was done for).
   */
  async getAttendanceSummaryBulk(
    employeeIds: readonly string[],
    periodStart: string,
    periodEnd: string
  ): Promise<Map<string, AttendanceSummary>> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "reports", "view");

    if (!isValidCalendarDate(periodStart) || !isValidCalendarDate(periodEnd)) {
      throw new AppError("Enter a valid date range.");
    }
    const start = toUtcDate(periodStart);
    const end = toUtcDate(periodEnd);
    if (start > end) {
      throw new AppError("The period's start date must not be after its end date.");
    }

    return attendanceRepository.aggregateSummaryForEmployees(user.companyId, employeeIds, start, end);
  },
};
