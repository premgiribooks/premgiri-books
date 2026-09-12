import { beforeEach, describe, expect, it, vi } from "vitest";

// Mirrors attendance-repository.test.ts's convention: mock the module-level
// prisma client directly (no $transaction needed here — every mutating
// method here accepts its own tx/client parameter from the service layer).
const { payrollRunMock, payrollRunItemMock, employeeMock } = vi.hoisted(() => ({
  payrollRunMock: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  payrollRunItemMock: { deleteMany: vi.fn(), findMany: vi.fn() },
  employeeMock: { findMany: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    payrollRun: payrollRunMock,
    payrollRunItem: payrollRunItemMock,
    employee: employeeMock,
  },
}));

import { payrollRunRepository } from "@/modules/payroll/repositories/payroll-run-repository";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_COMPANY_ID = "99999999-9999-4999-8999-999999999999";
const RUN_ID = "22222222-2222-4222-8222-222222222222";
const EMPLOYEE_ID = "33333333-3333-4333-8333-333333333333";

// Each repository method receives a Prisma client/transaction object whose
// model namespaces (client.employee, client.payrollRun, …) hold the actual
// query methods — not the bare model mock itself.
const FAKE_CLIENT = { payrollRun: payrollRunMock, payrollRunItem: payrollRunItemMock, employee: employeeMock };

function decimal(value: number) {
  return { toNumber: () => value };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("findActiveEmployeesForPayroll", () => {
  it("normalizes basicSalary to a plain number, preserving null", async () => {
    employeeMock.findMany.mockResolvedValue([
      { id: EMPLOYEE_ID, employeeCode: "EMP-1", fullName: "Asha Rao", basicSalary: decimal(30000) },
      { id: "employee-2", employeeCode: "EMP-2", fullName: "No Salary", basicSalary: null },
    ]);

    const result = await payrollRunRepository.findActiveEmployeesForPayroll(FAKE_CLIENT as never, COMPANY_ID);

    expect(employeeMock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: COMPANY_ID, isActive: true } })
    );
    expect(result).toEqual([
      { id: EMPLOYEE_ID, employeeCode: "EMP-1", fullName: "Asha Rao", basicSalary: 30000 },
      { id: "employee-2", employeeCode: "EMP-2", fullName: "No Salary", basicSalary: null },
    ]);
  });
});

describe("findOverlappingRun", () => {
  it("excludes CANCELLED runs and the run being refreshed/posted", async () => {
    payrollRunMock.findFirst.mockResolvedValue(null);

    const periodStart = new Date("2026-01-01T00:00:00.000Z");
    const periodEnd = new Date("2026-01-31T00:00:00.000Z");
    await payrollRunRepository.findOverlappingRun(FAKE_CLIENT as never, COMPANY_ID, periodStart, periodEnd, RUN_ID);

    expect(payrollRunMock.findFirst).toHaveBeenCalledWith({
      where: {
        companyId: COMPANY_ID,
        status: { not: "CANCELLED" },
        periodStart: { lte: periodEnd },
        periodEnd: { gte: periodStart },
        id: { not: RUN_ID },
      },
      select: { id: true },
    });
  });
});

describe("replaceItems", () => {
  it("returns null when the run does not exist, belongs to another company, or is not DRAFT", async () => {
    payrollRunMock.findUnique.mockResolvedValue({ id: RUN_ID, companyId: OTHER_COMPANY_ID, status: "DRAFT" });
    const result = await payrollRunRepository.replaceItems(FAKE_CLIENT as never, RUN_ID, COMPANY_ID, [], 0);
    expect(result).toBeNull();
    expect(payrollRunItemMock.deleteMany).not.toHaveBeenCalled();
  });

  it("deletes and recreates items, replacing totalNetSalary, when the run is a same-company DRAFT", async () => {
    payrollRunMock.findUnique.mockResolvedValue({ id: RUN_ID, companyId: COMPANY_ID, status: "DRAFT" });
    payrollRunMock.update.mockResolvedValue({
      id: RUN_ID,
      companyId: COMPANY_ID,
      payrollNumber: null,
      periodStart: new Date("2026-01-01T00:00:00.000Z"),
      periodEnd: new Date("2026-01-31T00:00:00.000Z"),
      status: "DRAFT",
      totalNetSalary: decimal(15000),
      narration: null,
      createdAt: new Date(),
      financialYearId: "fy-1",
      voucherId: null,
      items: [
        {
          id: "item-1",
          payrollRunId: RUN_ID,
          lineNumber: 1,
          employeeId: EMPLOYEE_ID,
          basicSalary: decimal(30000),
          totalDaysInPeriod: 31,
          workedDays: decimal(15.5),
          netSalary: decimal(15000),
          employee: { employeeCode: "EMP-1", fullName: "Asha Rao" },
        },
      ],
    });

    const result = await payrollRunRepository.replaceItems(
      FAKE_CLIENT as never,
      RUN_ID,
      COMPANY_ID,
      [{ employeeId: EMPLOYEE_ID, basicSalary: 30000, totalDaysInPeriod: 31, workedDays: 15.5, netSalary: 15000 }],
      15000
    );

    expect(payrollRunItemMock.deleteMany).toHaveBeenCalledWith({ where: { payrollRunId: RUN_ID } });
    expect(payrollRunMock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: RUN_ID },
        data: expect.objectContaining({ totalNetSalary: 15000 }),
      })
    );
    expect(result?.items[0].netSalary).toBe(15000);
    expect(result?.items[0].fullName).toBe("Asha Rao");
  });
});

describe("updateStatus", () => {
  it("only transitions rows currently in one of the `from` statuses", async () => {
    payrollRunMock.updateMany.mockResolvedValue({ count: 1 });

    const count = await payrollRunRepository.updateStatus(FAKE_CLIENT as never, RUN_ID, COMPANY_ID, ["POSTED"], "CANCELLED");

    expect(count).toBe(1);
    expect(payrollRunMock.updateMany).toHaveBeenCalledWith({
      where: { id: RUN_ID, companyId: COMPANY_ID, status: { in: ["POSTED"] } },
      data: { status: "CANCELLED" },
    });
  });
});

describe("listItemsForEmployee", () => {
  it("scopes to POSTED runs for the given employee and normalizes Decimal fields", async () => {
    payrollRunItemMock.findMany.mockResolvedValue([
      {
        basicSalary: decimal(30000),
        totalDaysInPeriod: 31,
        workedDays: decimal(31),
        netSalary: decimal(30000),
        payrollRun: { id: "run-1", payrollNumber: "PAY-0001", periodStart: new Date("2026-01-01"), periodEnd: new Date("2026-01-31") },
      },
    ]);

    const rows = await payrollRunRepository.listItemsForEmployee(COMPANY_ID, EMPLOYEE_ID, {});

    expect(payrollRunItemMock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          employeeId: EMPLOYEE_ID,
          payrollRun: expect.objectContaining({ companyId: COMPANY_ID, status: "POSTED" }),
        }),
      })
    );
    expect(rows).toEqual([
      {
        payrollRunId: "run-1",
        payrollNumber: "PAY-0001",
        periodStart: new Date("2026-01-01"),
        periodEnd: new Date("2026-01-31"),
        basicSalary: 30000,
        totalDaysInPeriod: 31,
        workedDays: 31,
        netSalary: 30000,
      },
    ]);
  });
});
