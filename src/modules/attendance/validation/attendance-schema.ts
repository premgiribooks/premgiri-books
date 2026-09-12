import { z } from "zod";

// Pure validation — no I/O, no Prisma client, no session lookups. The
// calendar-date pair mirrors every other module's own private
// isValidCalendarDate/toUtcDate copy (e.g. employee-schema.ts) rather than a
// shared import.

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function isValidCalendarDate(value: string): boolean {
  if (!DATE_REGEX.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return false;
  }
  return date.toISOString().slice(0, 10) === value;
}

/** `YYYY-MM-DD` -> UTC-midnight `Date`, the storage shape for `date` (`@db.Date`). */
export function toUtcDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

/** Today at UTC midnight, the boundary the future-date rule compares against. */
export function todayUtcDate(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

const PLAIN_CALENDAR_DATE_SCHEMA = z.string().trim().refine(isValidCalendarDate, "Enter a valid date");

// Marking attendance rejects a future date (62-attendance.md's Business
// Rules); a list/history *filter* date has no such restriction — a future
// range is simply valid and returns no rows.
const CALENDAR_DATE_SCHEMA = PLAIN_CALENDAR_DATE_SCHEMA.refine(
  (value) => toUtcDate(value) <= todayUtcDate(),
  "Date cannot be in the future"
);

const ATTENDANCE_STATUS_SCHEMA = z.enum(["PRESENT", "ABSENT", "HALF_DAY", "ON_LEAVE"]);

const REMARKS_SCHEMA = z
  .string()
  .trim()
  .max(250, "Remarks must be at most 250 characters")
  .transform((value) => (value === "" ? undefined : value))
  .optional();

export const markAttendanceEntrySchema = z.object({
  employeeId: z.uuid("Select a valid employee"),
  date: CALENDAR_DATE_SCHEMA,
  status: ATTENDANCE_STATUS_SCHEMA,
  remarks: REMARKS_SCHEMA,
});

export type MarkAttendanceEntryInput = z.infer<typeof markAttendanceEntrySchema>;

// 62-attendance.md's Validation section: 1-500 entries per batch, the whole
// batch rejected together on any single invalid entry (no partial-batch
// save) — z.array's own validation already achieves that, since a single
// invalid element fails the whole `.parse()` call.
export const markAttendanceBulkSchema = z
  .array(markAttendanceEntrySchema)
  .min(1, "At least one attendance entry is required")
  .max(500, "At most 500 entries can be submitted at once");

export type MarkAttendanceBulkInput = z.infer<typeof markAttendanceBulkSchema>;
