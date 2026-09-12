import { beforeEach, describe, expect, it, vi } from "vitest";

// Mirrors physical-verification-service.test.ts's convention: mock the
// module-boundary repository and the shared session/permission boundaries so
// the service's own logic (permission gating, date-range validation) is
// exercised in isolation from Prisma/the database.
const { findManyMock, upsertOneMock, upsertManyMock, getSummaryMock, getCurrentCompanyUserMock, assertPermissionMock } =
  vi.hoisted(() => ({
    findManyMock: vi.fn(),
    upsertOneMock: vi.fn(),
    upsertManyMock: vi.fn(),
    getSummaryMock: vi.fn(),
    getCurrentCompanyUserMock: vi.fn(),
    assertPermissionMock: vi.fn(),
  }));

vi.mock("@/modules/attendance/repositories/attendance-repository", () => ({
  attendanceRepository: {
    findMany: findManyMock,
    upsertOne: upsertOneMock,
    upsertMany: upsertManyMock,
    getSummary: getSummaryMock,
  },
}));

vi.mock("@/lib/current-user", () => ({ getCurrentCompanyUser: getCurrentCompanyUserMock }));
vi.mock("@/lib/permissions", () => ({ assertPermission: assertPermissionMock }));

import { attendanceService } from "@/modules/attendance/services/attendance-service";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const EMPLOYEE_ID = "22222222-2222-4222-8222-222222222222";
const CURRENT_USER = { id: "user-1", companyId: COMPANY_ID, role: "Owner", userType: "COMPANY" as const, username: "owner", fullName: "Owner" };

function daysFromToday(offset: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentCompanyUserMock.mockResolvedValue(CURRENT_USER);
  assertPermissionMock.mockResolvedValue(undefined);
});

describe("markAttendance", () => {
  it("gates on the employees/create permission and forwards the parsed entry", async () => {
    upsertOneMock.mockResolvedValue({ id: "attendance-1" });

    await attendanceService.markAttendance({
      employeeId: EMPLOYEE_ID,
      date: daysFromToday(-1),
      status: "PRESENT",
    });

    expect(assertPermissionMock).toHaveBeenCalledWith(CURRENT_USER, "employees", "create");
    expect(upsertOneMock).toHaveBeenCalledWith(
      COMPANY_ID,
      expect.objectContaining({ employeeId: EMPLOYEE_ID, status: "PRESENT", remarks: null })
    );
  });

  it("rejects a future-dated entry before it ever reaches the repository", async () => {
    await expect(
      attendanceService.markAttendance({
        employeeId: EMPLOYEE_ID,
        date: daysFromToday(1),
        status: "PRESENT",
      })
    ).rejects.toThrow();
    expect(upsertOneMock).not.toHaveBeenCalled();
  });
});

describe("markAttendanceBulk", () => {
  it("gates on the employees/create permission and forwards every entry", async () => {
    upsertManyMock.mockResolvedValue(2);

    const count = await attendanceService.markAttendanceBulk([
      { employeeId: EMPLOYEE_ID, date: daysFromToday(-1), status: "PRESENT" },
      { employeeId: EMPLOYEE_ID, date: daysFromToday(-2), status: "ABSENT" },
    ]);

    expect(count).toBe(2);
    expect(assertPermissionMock).toHaveBeenCalledWith(CURRENT_USER, "employees", "create");
    expect(upsertManyMock).toHaveBeenCalledWith(COMPANY_ID, expect.any(Array));
  });

  it("rejects the whole batch when any single entry is invalid", async () => {
    await expect(
      attendanceService.markAttendanceBulk([
        { employeeId: EMPLOYEE_ID, date: daysFromToday(-1), status: "PRESENT" },
        { employeeId: "not-a-uuid", date: daysFromToday(-1), status: "PRESENT" },
      ])
    ).rejects.toThrow();
    expect(upsertManyMock).not.toHaveBeenCalled();
  });
});

describe("listAttendance", () => {
  it("gates on the employees/view permission", async () => {
    findManyMock.mockResolvedValue([]);

    await attendanceService.listAttendance({ employeeId: EMPLOYEE_ID });

    expect(assertPermissionMock).toHaveBeenCalledWith(CURRENT_USER, "employees", "view");
    expect(findManyMock).toHaveBeenCalledWith(COMPANY_ID, { employeeId: EMPLOYEE_ID });
  });
});

describe("getAttendanceSummary", () => {
  it("gates on the employees/view permission and forwards the parsed range", async () => {
    getSummaryMock.mockResolvedValue({
      presentDays: 20,
      halfDays: 2,
      absentDays: 3,
      onLeaveDays: 1,
      totalMarkedDays: 26,
    });

    const summary = await attendanceService.getAttendanceSummary(EMPLOYEE_ID, "2026-01-01", "2026-01-31");

    expect(assertPermissionMock).toHaveBeenCalledWith(CURRENT_USER, "employees", "view");
    expect(getSummaryMock).toHaveBeenCalledWith(
      COMPANY_ID,
      EMPLOYEE_ID,
      new Date("2026-01-01T00:00:00.000Z"),
      new Date("2026-01-31T00:00:00.000Z")
    );
    expect(summary.totalMarkedDays).toBe(26);
  });

  it("rejects an invalid date shape", async () => {
    await expect(
      attendanceService.getAttendanceSummary(EMPLOYEE_ID, "15-01-2026", "2026-01-31")
    ).rejects.toThrow("Enter a valid date range.");
    expect(getSummaryMock).not.toHaveBeenCalled();
  });

  it("rejects a period whose start is after its end", async () => {
    await expect(
      attendanceService.getAttendanceSummary(EMPLOYEE_ID, "2026-01-31", "2026-01-01")
    ).rejects.toThrow("start date must not be after its end date");
    expect(getSummaryMock).not.toHaveBeenCalled();
  });

  // A summary period may legitimately span into a partially future pay
  // period (e.g. the current, still-in-progress month) — unlike marking a
  // single day's attendance, a future end date here is not rejected.
  it("allows a period extending into the future", async () => {
    getSummaryMock.mockResolvedValue({
      presentDays: 0,
      halfDays: 0,
      absentDays: 0,
      onLeaveDays: 0,
      totalMarkedDays: 0,
    });

    await expect(
      attendanceService.getAttendanceSummary(EMPLOYEE_ID, daysFromToday(-5), daysFromToday(5))
    ).resolves.toBeDefined();
  });
});
