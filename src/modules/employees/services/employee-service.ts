import { AppError } from "@/lib/app-error";
import { getCurrentCompanyUser } from "@/lib/current-user";
import type { Page, PageParams } from "@/lib/pagination";
import { assertPermission } from "@/lib/permissions";
import { isUniqueConstraintError } from "@/lib/prisma-errors";
import {
  employeeRepository,
  USER_ALREADY_LINKED_MESSAGE,
  type EmployeePersistData,
} from "@/modules/employees/repositories/employee-repository";
import {
  createEmployeeSchema,
  toUtcDate,
  updateEmployeeSchema,
  type CreateEmployeeInput,
  type UpdateEmployeeInput,
} from "@/modules/employees/validation/employee-schema";
import type {
  Employee,
  EmployeeBranchOption,
  EmployeeListFilters,
  EmployeeUserOption,
  EmployeeWithRelations,
} from "@/types/employee";

// The permission catalog (11-role-permissions.md) has no dedicated
// activate/deactivate action — Activate and Deactivate both gate on
// "delete", the established convention since ledger-service.ts
// (61-employee-master.md's Security section reuses the same LIFECYCLE_ACTION
// posture as every other master).
const LIFECYCLE_ACTION = "delete";

const NOT_FOUND_MESSAGE = "Employee not found.";

export function translatePersistError(error: unknown): never {
  if (isUniqueConstraintError(error, "employeeCode")) {
    throw new AppError("An employee with this code already exists in this company.");
  }
  // Defense-in-depth against a race between the repository's own pre-check
  // (assertAssignableUser) and the write — see the @@unique([userId])
  // constraint on Employee.
  if (isUniqueConstraintError(error, "userId")) {
    throw new AppError(USER_ALREADY_LINKED_MESSAGE);
  }
  throw error;
}

// Blank optionals arrive as undefined from the schema and persist as NULL;
// `country` falls back to the model's "India" default when cleared
// (customer-service.ts's identical convention).
function toPersistData(data: CreateEmployeeInput): EmployeePersistData {
  return {
    employeeCode: data.employeeCode,
    fullName: data.fullName,
    designation: data.designation ?? null,
    department: data.department ?? null,
    joiningDate: toUtcDate(data.joiningDate),
    mobileNumber: data.mobileNumber ?? null,
    alternateMobile: data.alternateMobile ?? null,
    email: data.email ?? null,
    addressLine1: data.addressLine1 ?? null,
    addressLine2: data.addressLine2 ?? null,
    city: data.city ?? null,
    state: data.state ?? null,
    district: data.district ?? null,
    country: data.country ?? "India",
    pinCode: data.pinCode ?? null,
    branchId: data.branchId ?? null,
    userId: data.userId ?? null,
    basicSalary: data.basicSalary ?? null,
  };
}

export const employeeService = {
  async listEmployees(filters: EmployeeListFilters = {}): Promise<EmployeeWithRelations[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "employees", "view");
    return employeeRepository.findMany(user.companyId, filters);
  },

  /** Infinite-scroll page for the Employees list page. */
  async listEmployeesPage(
    filters: EmployeeListFilters,
    page: PageParams
  ): Promise<Page<EmployeeWithRelations>> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "employees", "view");
    return employeeRepository.findManyPage(user.companyId, filters, page);
  },

  // An employee belonging to a different company must resolve identically to
  // "not found" — never distinguish "exists but isn't yours" from "doesn't
  // exist," the rule every module follows since user-service.ts.
  async getEmployee(id: string): Promise<EmployeeWithRelations | null> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "employees", "view");

    const employee = await employeeRepository.findById(id);
    if (!employee || employee.companyId !== user.companyId) {
      return null;
    }
    return employee;
  },

  /**
   * Active employees only — the lookup Attendance (62-attendance.md) and
   * Payroll (63-payroll.md) will consume. Deactivated employees keep all
   * data and simply disappear from here.
   */
  async listSelectableEmployees(): Promise<EmployeeWithRelations[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "employees", "view");
    return employeeRepository.findMany(user.companyId, { status: "active" });
  },

  /**
   * The branch picker's options: the company's active branches, plus (when
   * `includeBranchId` is supplied by the edit page) the edited employee's
   * current branch even if since deactivated, so the stored value stays
   * visible. Empty for a zero-branch company (12-branch-management.md — a
   * fully-supported state).
   */
  async listSelectableBranches(includeBranchId?: string): Promise<EmployeeBranchOption[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "employees", "view");
    return employeeRepository.findSelectableBranches(user.companyId, includeBranchId);
  },

  /**
   * The optional login-link picker's options: active Users of the company
   * not already linked to a different Employee, plus (on edit) the
   * employee's own current link even if since deactivated
   * (61-employee-master.md's Service section).
   */
  async listAvailableUsersForLinking(includeUserId?: string): Promise<EmployeeUserOption[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "employees", "view");
    return employeeRepository.findAvailableUsers(user.companyId, includeUserId);
  },

  async createEmployee(input: CreateEmployeeInput): Promise<Employee> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "employees", "create");

    const data = createEmployeeSchema.parse(input);

    try {
      return await employeeRepository.create(user.companyId, toPersistData(data));
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      translatePersistError(error);
    }
  },

  async updateEmployee(id: string, input: UpdateEmployeeInput): Promise<Employee> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "employees", "edit");

    const data = updateEmployeeSchema.parse(input);

    try {
      const employee = await employeeRepository.update(id, user.companyId, toPersistData(data));
      if (!employee) {
        throw new AppError(NOT_FOUND_MESSAGE);
      }
      return employee;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      translatePersistError(error);
    }
  },

  async activateEmployee(id: string): Promise<Employee> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "employees", LIFECYCLE_ACTION);

    const result = await employeeRepository.activate(id, user.companyId);
    switch (result.status) {
      case "not_found":
        throw new AppError(NOT_FOUND_MESSAGE);
      case "ok":
        return result.employee;
    }
  },

  async deactivateEmployee(id: string): Promise<Employee> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "employees", LIFECYCLE_ACTION);

    const result = await employeeRepository.deactivate(id, user.companyId);
    switch (result.status) {
      case "not_found":
        throw new AppError(NOT_FOUND_MESSAGE);
      case "ok":
        return result.employee;
    }
  },
};
