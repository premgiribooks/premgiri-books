import type { Employee as PrismaEmployee } from "@prisma/client";

// `basicSalary` is a Prisma `Decimal` at the database boundary — normalized
// to a plain `number | null` here, before it can cross the Server Component /
// Server Action serialization boundary (the Ledger.openingBalance/Customer.
// creditLimit convention).
export interface Employee extends Omit<PrismaEmployee, "basicSalary"> {
  basicSalary: number | null;
}

/** The slice of Branch the employee list and the branch picker need —
 * mirrors WarehouseBranchOption (24-warehouse-management.md). */
export interface EmployeeBranchOption {
  id: string;
  branchName: string;
  isActive: boolean;
}

/** The slice of User the employee list and the optional login-link picker
 * need. `isActive` lets the picker mark a since-deactivated linked user
 * visible (the BranchSelector "(Inactive)" convention) without exposing any
 * authentication data (passwordHash, roleId, etc.). */
export interface EmployeeUserOption {
  id: string;
  fullName: string;
  username: string;
  isActive: boolean;
}

/** List/detail row shape — includes the linked Branch/User identities. */
export interface EmployeeWithRelations extends Employee {
  branch: EmployeeBranchOption | null;
  user: EmployeeUserOption | null;
}

export type EmployeeStatusFilter = "all" | "active" | "inactive";

export interface EmployeeListFilters {
  search?: string;
  status?: EmployeeStatusFilter;
  /** 73-employee-reports.md's Employee Directory view — contains-match, since
   * neither field is an enum (61-employee-master.md's own deliberate
   * decision). */
  department?: string;
  designation?: string;
  branchId?: string;
}

export type ActivateEmployeeResult =
  | { status: "not_found" }
  | { status: "ok"; employee: Employee };

export type DeactivateEmployeeResult =
  | { status: "not_found" }
  | { status: "ok"; employee: Employee };
