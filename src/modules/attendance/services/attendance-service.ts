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
};
