import { describe, expect, it } from "vitest";

import {
  isValidCalendarDate,
  markAttendanceBulkSchema,
  markAttendanceEntrySchema,
  toUtcDate,
} from "@/modules/attendance/validation/attendance-schema";

const EMPLOYEE_ID = "22222222-2222-4222-8222-222222222222";

function daysFromToday(offset: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

describe("markAttendanceEntrySchema", () => {
  it("accepts a valid entry with no remarks", () => {
    const result = markAttendanceEntrySchema.parse({
      employeeId: EMPLOYEE_ID,
      date: daysFromToday(-1),
      status: "PRESENT",
    });

    expect(result.status).toBe("PRESENT");
    expect(result.remarks).toBeUndefined();
  });

  it("accepts today's date", () => {
    expect(
      markAttendanceEntrySchema.safeParse({
        employeeId: EMPLOYEE_ID,
        date: daysFromToday(0),
        status: "ABSENT",
      }).success
    ).toBe(true);
  });

  it("rejects a future date", () => {
    const result = markAttendanceEntrySchema.safeParse({
      employeeId: EMPLOYEE_ID,
      date: daysFromToday(1),
      status: "PRESENT",
    });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid date shape", () => {
    expect(
      markAttendanceEntrySchema.safeParse({
        employeeId: EMPLOYEE_ID,
        date: "15-01-2026",
        status: "PRESENT",
      }).success
    ).toBe(false);
  });

  it("rejects a non-uuid employeeId", () => {
    expect(
      markAttendanceEntrySchema.safeParse({
        employeeId: "not-a-uuid",
        date: daysFromToday(-1),
        status: "PRESENT",
      }).success
    ).toBe(false);
  });

  it("rejects an invalid status", () => {
    expect(
      markAttendanceEntrySchema.safeParse({
        employeeId: EMPLOYEE_ID,
        date: daysFromToday(-1),
        status: "ON_TIME",
      }).success
    ).toBe(false);
  });

  it("normalizes blank remarks to undefined and rejects over-length remarks", () => {
    const blank = markAttendanceEntrySchema.parse({
      employeeId: EMPLOYEE_ID,
      date: daysFromToday(-1),
      status: "PRESENT",
      remarks: "   ",
    });
    expect(blank.remarks).toBeUndefined();

    expect(
      markAttendanceEntrySchema.safeParse({
        employeeId: EMPLOYEE_ID,
        date: daysFromToday(-1),
        status: "PRESENT",
        remarks: "x".repeat(251),
      }).success
    ).toBe(false);
  });
});

describe("markAttendanceBulkSchema", () => {
  function entry() {
    return { employeeId: EMPLOYEE_ID, date: daysFromToday(-1), status: "PRESENT" as const };
  }

  it("rejects an empty batch", () => {
    expect(markAttendanceBulkSchema.safeParse([]).success).toBe(false);
  });

  it("accepts a batch of exactly 500 entries", () => {
    const batch = Array.from({ length: 500 }, entry);
    expect(markAttendanceBulkSchema.safeParse(batch).success).toBe(true);
  });

  it("rejects a batch of 501 entries", () => {
    const batch = Array.from({ length: 501 }, entry);
    expect(markAttendanceBulkSchema.safeParse(batch).success).toBe(false);
  });

  it("rejects the whole batch when a single entry is invalid (no partial-batch save)", () => {
    const batch = [entry(), entry(), { employeeId: "not-a-uuid", date: daysFromToday(-1), status: "PRESENT" as const }];
    expect(markAttendanceBulkSchema.safeParse(batch).success).toBe(false);
  });
});

describe("isValidCalendarDate / toUtcDate", () => {
  it("round-trips a valid calendar date", () => {
    expect(isValidCalendarDate("2026-01-15")).toBe(true);
    expect(toUtcDate("2026-01-15").toISOString()).toBe("2026-01-15T00:00:00.000Z");
  });

  it("rejects an out-of-range calendar date", () => {
    expect(isValidCalendarDate("2026-13-40")).toBe(false);
    expect(isValidCalendarDate("2026-02-30")).toBe(false);
  });
});
