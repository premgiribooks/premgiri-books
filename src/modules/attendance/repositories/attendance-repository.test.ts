import { beforeEach, describe, expect, it, vi } from "vitest";

// Mirrors product-batch-repository.test.ts's convention: mock the
// module-level prisma client, with $transaction invoking the callback
// against a fake transaction client (runInTransaction's no-retry branch just
// calls prisma.$transaction(fn, txOptions) directly).
const { FAKE_TX, attendanceMock } = vi.hoisted(() => ({
  FAKE_TX: {
    employee: { findUnique: vi.fn(), findMany: vi.fn() },
    attendance: { upsert: vi.fn() },
  },
  attendanceMock: { findMany: vi.fn(), groupBy: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: (fn: (tx: unknown) => unknown) => fn(FAKE_TX),
    attendance: attendanceMock,
  },
}));

import {
  assertActiveEmployee,
  attendanceRepository,
  EMPLOYEE_INACTIVE_MESSAGE,
  EMPLOYEE_NOT_FOUND_MESSAGE,
} from "@/modules/attendance/repositories/attendance-repository";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_COMPANY_ID = "99999999-9999-4999-8999-999999999999";
const EMPLOYEE_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_EMPLOYEE_ID = "77777777-7777-4777-8777-777777777777";
const DATE = new Date("2026-01-15T00:00:00.000Z");

beforeEach(() => {
  FAKE_TX.employee.findUnique.mockReset();
  FAKE_TX.employee.findMany.mockReset();
  FAKE_TX.attendance.upsert.mockReset();
  attendanceMock.findMany.mockReset();
  attendanceMock.groupBy.mockReset();
});

describe("assertActiveEmployee", () => {
  it("throws when the employee does not exist", async () => {
    FAKE_TX.employee.findUnique.mockResolvedValue(null);

    await expect(
      assertActiveEmployee(FAKE_TX as never, COMPANY_ID, EMPLOYEE_ID)
    ).rejects.toThrow(EMPLOYEE_NOT_FOUND_MESSAGE);
  });

  it("throws when the employee belongs to a different company", async () => {
    FAKE_TX.employee.findUnique.mockResolvedValue({
      id: EMPLOYEE_ID,
      companyId: OTHER_COMPANY_ID,
      isActive: true,
      branchId: null,
    });

    await expect(
      assertActiveEmployee(FAKE_TX as never, COMPANY_ID, EMPLOYEE_ID)
    ).rejects.toThrow(EMPLOYEE_NOT_FOUND_MESSAGE);
  });

  it("throws when the employee is inactive", async () => {
    FAKE_TX.employee.findUnique.mockResolvedValue({
      id: EMPLOYEE_ID,
      companyId: COMPANY_ID,
      isActive: false,
      branchId: null,
    });

    await expect(
      assertActiveEmployee(FAKE_TX as never, COMPANY_ID, EMPLOYEE_ID)
    ).rejects.toThrow(EMPLOYEE_INACTIVE_MESSAGE);
  });

  it("returns the employee's branchId for an active, same-company employee", async () => {
    FAKE_TX.employee.findUnique.mockResolvedValue({
      id: EMPLOYEE_ID,
      companyId: COMPANY_ID,
      isActive: true,
      branchId: "branch-1",
    });

    await expect(
      assertActiveEmployee(FAKE_TX as never, COMPANY_ID, EMPLOYEE_ID)
    ).resolves.toEqual({ branchId: "branch-1" });
  });
});

describe("upsertOne", () => {
  it("upserts against the (companyId, employeeId, date) unique key, denormalizing the employee's branchId", async () => {
    FAKE_TX.employee.findUnique.mockResolvedValue({
      id: EMPLOYEE_ID,
      companyId: COMPANY_ID,
      isActive: true,
      branchId: "branch-1",
    });
    FAKE_TX.attendance.upsert.mockResolvedValue({ id: "attendance-1" });

    await attendanceRepository.upsertOne(COMPANY_ID, {
      employeeId: EMPLOYEE_ID,
      date: DATE,
      status: "PRESENT",
      remarks: null,
    });

    expect(FAKE_TX.attendance.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          companyId_employeeId_date: { companyId: COMPANY_ID, employeeId: EMPLOYEE_ID, date: DATE },
        },
        create: expect.objectContaining({ companyId: COMPANY_ID, branchId: "branch-1", status: "PRESENT" }),
        update: { status: "PRESENT", remarks: null },
      })
    );
  });

  it("rejects marking attendance for an inactive employee", async () => {
    FAKE_TX.employee.findUnique.mockResolvedValue({
      id: EMPLOYEE_ID,
      companyId: COMPANY_ID,
      isActive: false,
      branchId: null,
    });

    await expect(
      attendanceRepository.upsertOne(COMPANY_ID, {
        employeeId: EMPLOYEE_ID,
        date: DATE,
        status: "ABSENT",
        remarks: null,
      })
    ).rejects.toThrow(EMPLOYEE_INACTIVE_MESSAGE);
    expect(FAKE_TX.attendance.upsert).not.toHaveBeenCalled();
  });
});

describe("upsertMany", () => {
  it("looks up every distinct employee once (not once per entry) and upserts each row inside the same transaction", async () => {
    FAKE_TX.employee.findMany.mockResolvedValue([
      { id: EMPLOYEE_ID, companyId: COMPANY_ID, isActive: true, branchId: null },
    ]);
    FAKE_TX.attendance.upsert.mockResolvedValue({ id: "attendance-1" });

    // The same employee appears twice (one employee across a date range) —
    // assertActiveEmployees must de-duplicate to a single findMany call.
    const count = await attendanceRepository.upsertMany(COMPANY_ID, [
      { employeeId: EMPLOYEE_ID, date: DATE, status: "PRESENT", remarks: null },
      { employeeId: EMPLOYEE_ID, date: new Date("2026-01-16T00:00:00.000Z"), status: "ABSENT", remarks: null },
    ]);

    expect(count).toBe(2);
    expect(FAKE_TX.employee.findMany).toHaveBeenCalledTimes(1);
    expect(FAKE_TX.attendance.upsert).toHaveBeenCalledTimes(2);
  });

  it("never partially writes when one entry's employee is invalid (all-or-nothing)", async () => {
    FAKE_TX.employee.findMany.mockResolvedValue([
      { id: EMPLOYEE_ID, companyId: COMPANY_ID, isActive: true, branchId: null },
      // OTHER_EMPLOYEE_ID does not exist at all.
    ]);

    await expect(
      attendanceRepository.upsertMany(COMPANY_ID, [
        { employeeId: EMPLOYEE_ID, date: DATE, status: "PRESENT", remarks: null },
        { employeeId: OTHER_EMPLOYEE_ID, date: DATE, status: "ABSENT", remarks: null },
      ])
    ).rejects.toThrow(EMPLOYEE_NOT_FOUND_MESSAGE);
    expect(FAKE_TX.attendance.upsert).not.toHaveBeenCalled();
  });

  it("rejects the whole batch when one entry's employee belongs to a different company", async () => {
    FAKE_TX.employee.findMany.mockResolvedValue([
      { id: EMPLOYEE_ID, companyId: COMPANY_ID, isActive: true, branchId: null },
      { id: OTHER_EMPLOYEE_ID, companyId: OTHER_COMPANY_ID, isActive: true, branchId: null },
    ]);

    await expect(
      attendanceRepository.upsertMany(COMPANY_ID, [
        { employeeId: EMPLOYEE_ID, date: DATE, status: "PRESENT", remarks: null },
        { employeeId: OTHER_EMPLOYEE_ID, date: DATE, status: "ABSENT", remarks: null },
      ])
    ).rejects.toThrow(EMPLOYEE_NOT_FOUND_MESSAGE);
    expect(FAKE_TX.attendance.upsert).not.toHaveBeenCalled();
  });
});

describe("getSummary", () => {
  it("returns correct per-status counts, treating an unmarked day as absent from every count", async () => {
    attendanceMock.groupBy.mockResolvedValue([
      { status: "PRESENT", _count: { _all: 20 } },
      { status: "HALF_DAY", _count: { _all: 2 } },
      { status: "ABSENT", _count: { _all: 3 } },
      { status: "ON_LEAVE", _count: { _all: 1 } },
    ]);

    const summary = await attendanceRepository.getSummary(
      COMPANY_ID,
      EMPLOYEE_ID,
      new Date("2026-01-01T00:00:00.000Z"),
      new Date("2026-01-31T00:00:00.000Z")
    );

    // 26 marked days out of a 31-day period — 5 unmarked days are simply
    // absent from every count, never implicitly treated as any status.
    expect(summary).toEqual({
      presentDays: 20,
      halfDays: 2,
      absentDays: 3,
      onLeaveDays: 1,
      totalMarkedDays: 26,
    });
  });

  it("returns all-zero counts for a period with no attendance rows at all", async () => {
    attendanceMock.groupBy.mockResolvedValue([]);

    const summary = await attendanceRepository.getSummary(
      COMPANY_ID,
      EMPLOYEE_ID,
      new Date("2026-02-01T00:00:00.000Z"),
      new Date("2026-02-28T00:00:00.000Z")
    );

    expect(summary).toEqual({
      presentDays: 0,
      halfDays: 0,
      absentDays: 0,
      onLeaveDays: 0,
      totalMarkedDays: 0,
    });
  });
});
