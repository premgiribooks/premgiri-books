"use server";

import { runAction } from "@/lib/run-action";
import { employeeService } from "@/modules/employees/services/employee-service";
import type {
  CreateEmployeeInput,
  UpdateEmployeeInput,
} from "@/modules/employees/validation/employee-schema";
import type { ActionResult } from "@/types/api";
import type { Employee } from "@/types/employee";

const LIST_PATH = "/masters/employees";

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
