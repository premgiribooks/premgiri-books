import { Prisma, type PayrollRunStatus } from "@prisma/client";

import { fetchPage, type Page, type PageParams } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import type {
  EmployeeSalaryHistoryFilters,
  EmployeeSalaryHistoryRow,
  PayrollRunDetail,
  PayrollRunItem,
  PayrollRunListFilters,
  PayrollRunListRow,
} from "@/types/payroll-run";

type PrismaClientOrTransaction = typeof prisma | Prisma.TransactionClient;

const ITEM_INCLUDE = {
  items: { include: { employee: { select: { employeeCode: true, fullName: true } } } },
} as const;

type PayrollRunDetailRaw = Prisma.PayrollRunGetPayload<{ include: typeof ITEM_INCLUDE }>;

function toPayrollRunItem(raw: PayrollRunDetailRaw["items"][number]): PayrollRunItem {
  const { employee, ...item } = raw;
  return {
    ...item,
    basicSalary: item.basicSalary.toNumber(),
    workedDays: item.workedDays.toNumber(),
    netSalary: item.netSalary.toNumber(),
    employeeCode: employee.employeeCode,
    fullName: employee.fullName,
  };
}

function toPayrollRunListRow(raw: {
  id: string;
  payrollNumber: string | null;
  periodStart: Date;
  periodEnd: Date;
  status: PayrollRunStatus;
  totalNetSalary: Prisma.Decimal;
  narration: string | null;
  createdAt: Date;
}): PayrollRunListRow {
  return {
    id: raw.id,
    payrollNumber: raw.payrollNumber,
    periodStart: raw.periodStart,
    periodEnd: raw.periodEnd,
    status: raw.status,
    totalNetSalary: raw.totalNetSalary.toNumber(),
    narration: raw.narration,
    createdAt: raw.createdAt,
  };
}

function toPayrollRunDetail(raw: PayrollRunDetailRaw): PayrollRunDetail {
  const { items, ...header } = raw;
  return {
    ...toPayrollRunListRow(header),
    companyId: header.companyId,
    financialYearId: header.financialYearId,
    voucherId: header.voucherId,
    items: items
      .slice()
      .sort((a, b) => a.lineNumber - b.lineNumber)
      .map(toPayrollRunItem),
  };
}

function buildWhere(
  companyId: string,
  financialYearId: string,
  filters: PayrollRunListFilters
): Prisma.PayrollRunWhereInput {
  const where: Prisma.PayrollRunWhereInput = { companyId, financialYearId };

  if (filters.status) {
    where.status = filters.status;
  }
  if (filters.dateFrom || filters.dateTo) {
    where.periodStart = { ...(filters.dateFrom ? { gte: filters.dateFrom } : {}) };
    where.periodEnd = { ...(filters.dateTo ? { lte: filters.dateTo } : {}) };
  }
  if (filters.search) {
    where.payrollNumber = { contains: filters.search, mode: "insensitive" };
  }

  return where;
}

export interface PayrollRunLinePersistData {
  employeeId: string;
  basicSalary: number;
  totalDaysInPeriod: number;
  workedDays: number;
  netSalary: number;
}

export interface PayrollRunHeaderPersistData {
  periodStart: Date;
  periodEnd: Date;
  narration: string | null;
}

export const payrollRunRepository = {
  async findMany(
    companyId: string,
    financialYearId: string,
    filters: PayrollRunListFilters = {}
  ): Promise<PayrollRunListRow[]> {
    const rows = await prisma.payrollRun.findMany({
      where: buildWhere(companyId, financialYearId, filters),
      orderBy: [{ periodStart: "desc" }, { createdAt: "desc" }],
    });
    return rows.map(toPayrollRunListRow);
  },

  /** Infinite-scroll page for the Payroll Runs list — same filters/ordering
   * as `findMany`, just `skip`/`take`-bounded. */
  async findManyPage(
    companyId: string,
    financialYearId: string,
    filters: PayrollRunListFilters,
    page: PageParams
  ): Promise<Page<PayrollRunListRow>> {
    const result = await fetchPage(
      (args) =>
        prisma.payrollRun.findMany({
          where: buildWhere(companyId, financialYearId, filters),
          orderBy: [{ periodStart: "desc" }, { createdAt: "desc" }],
          ...args,
        }),
      page
    );
    return { items: result.items.map(toPayrollRunListRow), hasMore: result.hasMore };
  },

  async findById(id: string, client: PrismaClientOrTransaction = prisma): Promise<PayrollRunDetail | null> {
    const row = await client.payrollRun.findUnique({ where: { id }, include: ITEM_INCLUDE });
    return row ? toPayrollRunDetail(row) : null;
  },

  /**
   * Every active Employee of the company, with their (possibly null)
   * `basicSalary` — the candidate pool `createDraft`/`refreshDraft` split
   * into included/excluded lines (63-payroll.md's Business Rules: an
   * employee with no `basicSalary` is excluded, not a hard error).
   */
  async findActiveEmployeesForPayroll(
    client: PrismaClientOrTransaction,
    companyId: string
  ): Promise<{ id: string; employeeCode: string; fullName: string; basicSalary: number | null }[]> {
    const rows = await client.employee.findMany({
      where: { companyId, isActive: true },
      select: { id: true, employeeCode: true, fullName: true, basicSalary: true },
      orderBy: { fullName: "asc" },
    });
    return rows.map((row) => ({
      id: row.id,
      employeeCode: row.employeeCode,
      fullName: row.fullName,
      basicSalary: row.basicSalary === null ? null : row.basicSalary.toNumber(),
    }));
  },

  /**
   * 63-payroll.md's Business Rules: a new run's period must not overlap any
   * other NON-CANCELLED run for the same company — re-verified again at
   * posting time against current state. `excludeRunId` lets `refreshDraft`/
   * `postPayrollRun` re-check without the run being refreshed/posted
   * colliding with itself.
   */
  async findOverlappingRun(
    client: PrismaClientOrTransaction,
    companyId: string,
    periodStart: Date,
    periodEnd: Date,
    excludeRunId?: string
  ): Promise<{ id: string } | null> {
    const overlapping = await client.payrollRun.findFirst({
      where: {
        companyId,
        status: { not: "CANCELLED" },
        periodStart: { lte: periodEnd },
        periodEnd: { gte: periodStart },
        ...(excludeRunId ? { id: { not: excludeRunId } } : {}),
      },
      select: { id: true },
    });
    return overlapping;
  },

  async create(
    tx: Prisma.TransactionClient,
    companyId: string,
    financialYearId: string,
    header: PayrollRunHeaderPersistData,
    lines: PayrollRunLinePersistData[],
    totalNetSalary: number,
    createdByUserId: string
  ): Promise<PayrollRunDetail> {
    const created = await tx.payrollRun.create({
      data: {
        companyId,
        financialYearId,
        createdByUserId,
        ...header,
        totalNetSalary,
        items: {
          create: lines.map((line, index) => ({ ...line, lineNumber: index + 1 })),
        },
      },
      include: ITEM_INCLUDE,
    });
    return toPayrollRunDetail(created);
  },

  /**
   * Recomputes a DRAFT run's own line set in place — replaces every item,
   * never accumulates (63-payroll.md's Business Rules: "recomputing replaces
   * each line's stored workedDays/netSalary, it does not accumulate"). Only
   * reachable while DRAFT, re-checked atomically here.
   */
  async replaceItems(
    tx: Prisma.TransactionClient,
    id: string,
    companyId: string,
    lines: PayrollRunLinePersistData[],
    totalNetSalary: number
  ): Promise<PayrollRunDetail | null> {
    const existing = await tx.payrollRun.findUnique({ where: { id } });
    if (!existing || existing.companyId !== companyId || existing.status !== "DRAFT") {
      return null;
    }

    await tx.payrollRunItem.deleteMany({ where: { payrollRunId: id } });
    const updated = await tx.payrollRun.update({
      where: { id },
      data: {
        totalNetSalary,
        items: { create: lines.map((line, index) => ({ ...line, lineNumber: index + 1 })) },
      },
      include: ITEM_INCLUDE,
    });
    return toPayrollRunDetail(updated);
  },

  /**
   * Posting's own write (63-payroll.md's Posting steps 2-6 combined):
   * replaces the line set with the freshly-recomputed persist data (never
   * trusting stale draft figures), assigns the just-generated
   * `payrollNumber` (null until now), sets `totalNetSalary`/`voucherId`, and
   * flips `status` to `POSTED` — all atomically, guarded by
   * `WHERE status = 'DRAFT'` so a concurrent status change loses cleanly.
   */
  async replaceItemsAndPost(
    tx: Prisma.TransactionClient,
    id: string,
    companyId: string,
    payrollNumber: string,
    lines: PayrollRunLinePersistData[],
    totalNetSalary: number,
    voucherId: string
  ): Promise<PayrollRunDetail | null> {
    const existing = await tx.payrollRun.findUnique({ where: { id } });
    if (!existing || existing.companyId !== companyId || existing.status !== "DRAFT") {
      return null;
    }

    await tx.payrollRunItem.deleteMany({ where: { payrollRunId: id } });
    const updated = await tx.payrollRun.update({
      where: { id },
      data: {
        payrollNumber,
        voucherId,
        status: "POSTED",
        totalNetSalary,
        items: { create: lines.map((line, index) => ({ ...line, lineNumber: index + 1 })) },
      },
      include: ITEM_INCLUDE,
    });
    return toPayrollRunDetail(updated);
  },

  /** Guarded status transition — mirrors purchase-invoice-repository.ts's
   * updateStatus exactly. The only user-facing transition this drives is
   * Cancel (`POSTED -> CANCELLED`). */
  async updateStatus(
    client: PrismaClientOrTransaction,
    id: string,
    companyId: string,
    from: readonly PayrollRunStatus[],
    to: PayrollRunStatus
  ): Promise<number> {
    const result = await client.payrollRun.updateMany({
      where: { id, companyId, status: { in: [...from] } },
      data: { status: to },
    });
    return result.count;
  },

  /**
   * 73-employee-reports.md's Salary Register — `PayrollRunItem` rows for a
   * single employee across many `POSTED` runs, joined to each run's own
   * header fields. `payrollRunService.listPayrollRuns`/`getPayrollRun` are
   * run-scoped (one run at a time); no existing query lists items
   * employee-scoped across runs, hence this new method.
   */
  async listItemsForEmployee(
    companyId: string,
    employeeId: string,
    filters: EmployeeSalaryHistoryFilters
  ): Promise<EmployeeSalaryHistoryRow[]> {
    const rows = await prisma.payrollRunItem.findMany({
      where: {
        employeeId,
        payrollRun: {
          companyId,
          status: "POSTED",
          ...(filters.financialYearId ? { financialYearId: filters.financialYearId } : {}),
          ...(filters.dateFrom || filters.dateTo
            ? {
                periodStart: filters.dateFrom ? { gte: filters.dateFrom } : undefined,
                periodEnd: filters.dateTo ? { lte: filters.dateTo } : undefined,
              }
            : {}),
        },
      },
      include: { payrollRun: { select: { id: true, payrollNumber: true, periodStart: true, periodEnd: true } } },
      orderBy: { payrollRun: { periodStart: "desc" } },
    });

    return rows.map((row) => ({
      payrollRunId: row.payrollRun.id,
      payrollNumber: row.payrollRun.payrollNumber,
      periodStart: row.payrollRun.periodStart,
      periodEnd: row.payrollRun.periodEnd,
      basicSalary: row.basicSalary.toNumber(),
      totalDaysInPeriod: row.totalDaysInPeriod,
      workedDays: row.workedDays.toNumber(),
      netSalary: row.netSalary.toNumber(),
    }));
  },
};
