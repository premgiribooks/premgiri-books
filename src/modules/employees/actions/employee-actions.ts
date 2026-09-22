"use server";

import type { Page } from "@/lib/pagination";
import { runAction } from "@/lib/run-action";
import { employeeService } from "@/modules/employees/services/employee-service";
import type {
  CreateEmployeeInput,
  UpdateEmployeeInput,
} from "@/modules/employees/validation/employee-schema";
import type { ActionResult } from "@/types/api";
import type { Employee, EmployeeListFilters, EmployeeWithRelations } from "@/types/employee";

const LIST_PATH = "/masters/employees";

/** Infinite-scroll "load more" for the Employees list — a pure read, so no
 * paths are revalidated. */
export async function loadMoreEmployeesAction(
  filters: EmployeeListFilters,
  skip: number,
  take: number
): Promise<ActionResult<Page<EmployeeWithRelations>>> {
  return runAction(() => employeeService.listEmployeesPage(filters, { skip, take }), []);
}

export async function createEmployeeAction(
  input: CreateEmployeeInput
): Promise<ActionResult<Employee>> {
  return runAction(() => employeeService.createEmployee(input), [LIST_PATH]);
}

export async function updateEmployeeAction(
  id: string,
  input: UpdateEmployeeInput
): Promise<ActionResult<Employee>> {
  return runAction(() => employeeService.updateEmployee(id, input), [
    LIST_PATH,
    `/masters/employees/${id}/edit`,
  ]);
}

export async function activateEmployeeAction(id: string): Promise<ActionResult<Employee>> {
  return runAction(() => employeeService.activateEmployee(id), [LIST_PATH]);
}

export async function deactivateEmployeeAction(id: string): Promise<ActionResult<Employee>> {
  return runAction(() => employeeService.deactivateEmployee(id), [LIST_PATH]);
}
