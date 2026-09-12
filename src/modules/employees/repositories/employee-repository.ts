import { Prisma, type Employee as PrismaEmployee } from "@prisma/client";

import { AppError } from "@/lib/app-error";
import { prisma } from "@/lib/prisma";
import { runInTransaction } from "@/lib/transaction";
import { isRecordNotFoundError } from "@/lib/prisma-errors";
import type {
  ActivateEmployeeResult,
  DeactivateEmployeeResult,
  Employee,
  EmployeeBranchOption,
  EmployeeListFilters,
  EmployeeUserOption,
  EmployeeWithRelations,
} from "@/types/employee";

export const BRANCH_NOT_FOUND_MESSAGE = "Selected branch was not found.";
export const BRANCH_INACTIVE_MESSAGE = "Selected branch is inactive.";
export const USER_NOT_FOUND_MESSAGE = "Selected user was not found.";
export const USER_INACTIVE_MESSAGE = "Selected user is inactive.";
export const USER_ALREADY_LINKED_MESSAGE =
  "Selected user is already linked to a different employee.";

export interface EmployeePersistData {
  employeeCode: string;
  fullName: string;
  designation: string | null;
  department: string | null;
  joiningDate: Date;
  mobileNumber: string | null;
  alternateMobile: string | null;
  email: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  district: string | null;
  country: string;
  pinCode: string | null;
  branchId: string | null;
  userId: string | null;
  basicSalary: number | null;
}

const BRANCH_OPTION_SELECT = { id: true, branchName: true, isActive: true } as const;
const USER_OPTION_SELECT = { id: true, fullName: true, username: true, isActive: true } as const;

const EMPLOYEE_INCLUDE = {
  branch: { select: BRANCH_OPTION_SELECT },
  user: { select: USER_OPTION_SELECT },
} as const;

function toEmployee(raw: PrismaEmployee): Employee {
  return { ...raw, basicSalary: raw.basicSalary === null ? null : raw.basicSalary.toNumber() };
}

function toEmployeeWithRelations(
  raw: PrismaEmployee & {
    branch: EmployeeBranchOption | null;
    user: EmployeeUserOption | null;
  }
): EmployeeWithRelations {
  return { ...toEmployee(raw), branch: raw.branch, user: raw.user };
}

/**
 * A supplied branch must belong to the same company and be active at
 * assignment time — server-verified, never trusted from the client
 * (61-employee-master.md's Business Rules, mirroring
 * 24-warehouse-management.md's assertAssignableBranch). A cross-company
 * branch reports the same message as a nonexistent one.
 */
export async function assertAssignableBranch(
  tx: Prisma.TransactionClient,
  companyId: string,
  branchId: string
): Promise<void> {
  const branch = await tx.branch.findUnique({ where: { id: branchId } });
  if (!branch || branch.companyId !== companyId) {
    throw new AppError(BRANCH_NOT_FOUND_MESSAGE);
  }
  if (!branch.isActive) {
    throw new AppError(BRANCH_INACTIVE_MESSAGE);
  }
}

/**
 * A supplied User must belong to the same company, be active, and not
 * already be linked to a DIFFERENT Employee row (61-employee-master.md's
 * Business Rules) — re-validated here for a friendly, field-specific error
 * rather than a raw @@unique([userId]) constraint violation surfacing at the
 * database layer. `currentEmployeeId` excludes the employee being edited
 * from the "already linked" check, so re-submitting an employee's own
 * existing link is never rejected as a conflict with itself.
 */
export async function assertAssignableUser(
  tx: Prisma.TransactionClient,
  companyId: string,
  userId: string,
  currentEmployeeId: string | null
): Promise<void> {
  const user = await tx.user.findUnique({ where: { id: userId } });
  if (!user || user.companyId !== companyId) {
    throw new AppError(USER_NOT_FOUND_MESSAGE);
  }
  if (!user.isActive) {
    throw new AppError(USER_INACTIVE_MESSAGE);
  }

  const linkedEmployee = await tx.employee.findUnique({ where: { userId } });
  if (linkedEmployee && linkedEmployee.id !== currentEmployeeId) {
    throw new AppError(USER_ALREADY_LINKED_MESSAGE);
  }
}

function buildWhere(companyId: string, filters: EmployeeListFilters): Prisma.EmployeeWhereInput {
  const where: Prisma.EmployeeWhereInput = { companyId };

  if (filters.status === "active") {
    where.isActive = true;
  } else if (filters.status === "inactive") {
    where.isActive = false;
  }

  if (filters.search) {
    // Search covers employeeCode, fullName, and mobileNumber
    // (61-employee-master.md's Service section).
    where.OR = [
      { employeeCode: { contains: filters.search, mode: "insensitive" } },
      { fullName: { contains: filters.search, mode: "insensitive" } },
      { mobileNumber: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  // 73-employee-reports.md's Employee Directory filters — added to this
  // existing query rather than a second, parallel one, per that spec's own
  // instruction to reuse `employeeService.listEmployees(filters)` directly.
  if (filters.department) {
    where.department = { contains: filters.department, mode: "insensitive" };
  }
  if (filters.designation) {
    where.designation = { contains: filters.designation, mode: "insensitive" };
  }
  if (filters.branchId) {
    where.branchId = filters.branchId;
  }

  return where;
}

export const employeeRepository = {
  async findMany(
    companyId: string,
    filters: EmployeeListFilters = {}
  ): Promise<EmployeeWithRelations[]> {
    const rows = await prisma.employee.findMany({
      where: buildWhere(companyId, filters),
      include: EMPLOYEE_INCLUDE,
      orderBy: { fullName: "asc" },
    });
    return rows.map(toEmployeeWithRelations);
  },

  async findById(id: string): Promise<EmployeeWithRelations | null> {
    const row = await prisma.employee.findUnique({ where: { id }, include: EMPLOYEE_INCLUDE });
    return row ? toEmployeeWithRelations(row) : null;
  },

  /**
   * Active branches of the company — the branch picker's options. When
   * `includeBranchId` names a same-company branch that is inactive (an
   * edited employee's current, since-deactivated branch), it is included
   * anyway so the stored value stays visible and re-selectable, mirroring
   * warehouse-repository.ts's findSelectableBranches. Empty for a
   * zero-branch company — a valid, fully-supported state
   * (12-branch-management.md).
   */
  async findSelectableBranches(
    companyId: string,
    includeBranchId?: string
  ): Promise<EmployeeBranchOption[]> {
    const or: Prisma.BranchWhereInput[] = [{ isActive: true }];
    if (includeBranchId) {
      or.push({ id: includeBranchId });
    }
    return prisma.branch.findMany({
      where: { companyId, OR: or },
      select: BRANCH_OPTION_SELECT,
      orderBy: { branchName: "asc" },
    });
  },

  /**
   * Active Users of the company not already linked to a different Employee —
   * the optional login-link picker's options. `includeUserId` (the edited
   * employee's own current link, if any) is always included even if the
   * user has since been deactivated, so the stored value stays visible and
   * re-selectable — the same "unchanged assignment stays visible" rule
   * findSelectableBranches above follows.
   */
  async findAvailableUsers(
    companyId: string,
    includeUserId?: string
  ): Promise<EmployeeUserOption[]> {
    const or: Prisma.UserWhereInput[] = [{ isActive: true, employee: { is: null } }];
    if (includeUserId) {
      or.push({ id: includeUserId });
    }
    return prisma.user.findMany({
      where: { companyId, OR: or },
      select: USER_OPTION_SELECT,
      orderBy: { fullName: "asc" },
    });
  },

  // No Serializable isolation needed — Employee has no shared invariant like
  // Warehouse's "one default" or User's "last active full-coverage user"; a
  // plain scoped transaction (the unit-repository.ts/ledger-repository.ts
  // shape) is sufficient for the branch/user reference checks below.
  async create(companyId: string, data: EmployeePersistData): Promise<Employee> {
    return runInTransaction(async (tx) => {
      if (data.branchId) {
        await assertAssignableBranch(tx, companyId, data.branchId);
      }
      if (data.userId) {
        await assertAssignableUser(tx, companyId, data.userId, null);
      }
      const created = await tx.employee.create({ data: { ...data, companyId } });
      return toEmployee(created);
    });
  },

  // Only a CHANGED branch/user assignment is re-verified — an unchanged,
  // since-deactivated assignment must not block an unrelated edit (the
  // warehouse-repository.ts update() rule, applied to both references here).
  async update(
    id: string,
    companyId: string,
    data: EmployeePersistData
  ): Promise<Employee | null> {
    return runInTransaction(async (tx) => {
      const existing = await tx.employee.findUnique({ where: { id } });
      if (!existing || existing.companyId !== companyId) {
        return null;
      }

      if (data.branchId && data.branchId !== existing.branchId) {
        await assertAssignableBranch(tx, companyId, data.branchId);
      }
      if (data.userId && data.userId !== existing.userId) {
        await assertAssignableUser(tx, companyId, data.userId, id);
      }

      try {
        const updated = await tx.employee.update({ where: { id }, data });
        return toEmployee(updated);
      } catch (error) {
        if (isRecordNotFoundError(error)) {
          return null;
        }
        throw error;
      }
    });
  },

  async activate(id: string, companyId: string): Promise<ActivateEmployeeResult> {
    return runInTransaction(async (tx) => {
      const existing = await tx.employee.findUnique({ where: { id } });
      if (!existing || existing.companyId !== companyId) {
        return { status: "not_found" };
      }

      const employee = await tx.employee.update({ where: { id }, data: { isActive: true } });
      return { status: "ok", employee: toEmployee(employee) };
    });
  },

  // Deactivating does not cascade to the linked User (if any) or affect any
  // already-posted Payroll run referencing this employee — it only prevents
  // this employee from being newly added to a future Attendance period or
  // Payroll run, each of those specs' own responsibility to enforce
  // (61-employee-master.md's Business Rules).
  async deactivate(id: string, companyId: string): Promise<DeactivateEmployeeResult> {
    return runInTransaction(async (tx) => {
      const existing = await tx.employee.findUnique({ where: { id } });
      if (!existing || existing.companyId !== companyId) {
        return { status: "not_found" };
      }

      const employee = await tx.employee.update({ where: { id }, data: { isActive: false } });
      return { status: "ok", employee: toEmployee(employee) };
    });
  },
};
