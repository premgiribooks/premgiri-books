import type { Attendance as PrismaAttendance, AttendanceStatus } from "@prisma/client";

export type { AttendanceStatus };

export type Attendance = PrismaAttendance;

/** The slice of Employee an attendance row/roster row needs for display. */
export interface AttendanceEmployeeOption {
  id: string;
  employeeCode: string;
  fullName: string;
  isActive: boolean;
}

/** List/detail row shape — includes the referenced Employee identity. */
export interface AttendanceWithRelations extends Attendance {
  employee: AttendanceEmployeeOption;
}

export interface AttendanceListFilters {
  employeeId?: string;
  branchId?: string;
  status?: AttendanceStatus;
  dateFrom?: Date;
  dateTo?: Date;
}

/**
 * Per-status counts for a (employeeId, periodStart, periodEnd) range —
 * 62-attendance.md's Business Rules: raw counts per status, never a single
 * pre-blended "worked days" figure, so Payroll's own formula stays entirely
 * inside Payroll's spec (63-payroll.md).
 */
export interface AttendanceSummary {
  presentDays: number;
  halfDays: number;
  absentDays: number;
  onLeaveDays: number;
  totalMarkedDays: number;
}
