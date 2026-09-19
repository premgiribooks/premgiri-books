import { createEmployeeSchema, type CreateEmployeeInput } from "@/modules/employees/validation/employee-schema";
import { employeeService } from "@/modules/employees/services/employee-service";
import type { ImportColumn, ImportTarget, ResolvedRowResult } from "@/types/bulk-import";
import { getCell, getOptionalCell, parseOptionalNumber } from "@/modules/bulk-import/targets/import-cell-parsers";
import { resolveBranchByName } from "@/modules/bulk-import/targets/resolve-branch";

// User (login account) is deliberately excluded from the v1 import template
// — unlike Branch, a User has no human-readable natural key a spreadsheet
// cell could carry, the same reasoning product-import-target.ts's own
// comment gives for excluding gstRateId/marginProfileId. An imported
// employee stays unlinked to a login account and can be linked afterward
// via the existing Edit screen.
export const EMPLOYEE_IMPORT_COLUMNS: ImportColumn[] = [
  { key: "employeeCode", header: "Employee Code", required: true, example: "EMP-001" },
  { key: "fullName", header: "Full Name", required: true, example: "Ramesh Kumar" },
  { key: "joiningDate", header: "Joining Date (YYYY-MM-DD)", required: true, example: "2024-04-01" },
  { key: "designation", header: "Designation", required: false, example: "" },
  { key: "department", header: "Department", required: false, example: "" },
  { key: "mobileNumber", header: "Mobile Number", required: false, example: "" },
  { key: "alternateMobile", header: "Alternate Mobile", required: false, example: "" },
  { key: "email", header: "Email", required: false, example: "" },
  { key: "addressLine1", header: "Address Line 1", required: false, example: "" },
  { key: "addressLine2", header: "Address Line 2", required: false, example: "" },
  { key: "city", header: "City", required: false, example: "" },
  { key: "state", header: "State", required: false, example: "" },
  { key: "district", header: "District", required: false, example: "" },
  { key: "country", header: "Country", required: false, example: "" },
  { key: "pinCode", header: "PIN Code", required: false, example: "" },
  { key: "branch", header: "Branch", required: false, example: "" },
  { key: "basicSalary", header: "Basic Salary", required: false, example: "" },
];

export const employeeImportTarget: ImportTarget<CreateEmployeeInput> = {
  key: "employees",
  label: "Employees",
  columns: EMPLOYEE_IMPORT_COLUMNS,

  async resolveRow(rawRow, companyId, cache): Promise<ResolvedRowResult<CreateEmployeeInput>> {
    const errors: string[] = [];

    const branchId = await resolveBranchByName(getOptionalCell(rawRow, "branch"), companyId, cache, errors);

    const candidate = {
      employeeCode: getCell(rawRow, "employeeCode"),
      fullName: getCell(rawRow, "fullName"),
      joiningDate: getCell(rawRow, "joiningDate"),
      designation: getOptionalCell(rawRow, "designation"),
      department: getOptionalCell(rawRow, "department"),
      mobileNumber: getOptionalCell(rawRow, "mobileNumber"),
      alternateMobile: getOptionalCell(rawRow, "alternateMobile"),
      email: getOptionalCell(rawRow, "email"),
      addressLine1: getOptionalCell(rawRow, "addressLine1"),
      addressLine2: getOptionalCell(rawRow, "addressLine2"),
      city: getOptionalCell(rawRow, "city"),
      state: getOptionalCell(rawRow, "state"),
      district: getOptionalCell(rawRow, "district"),
      country: getOptionalCell(rawRow, "country"),
      pinCode: getOptionalCell(rawRow, "pinCode"),
      branchId,
      basicSalary: parseOptionalNumber(getOptionalCell(rawRow, "basicSalary"), "Basic salary", errors),
    };

    if (errors.length > 0) {
      return { status: "invalid", errors };
    }

    const parsed = createEmployeeSchema.safeParse(candidate);
    if (!parsed.success) {
      return { status: "invalid", errors: parsed.error.issues.map((issue) => issue.message) };
    }

    return { status: "valid", input: parsed.data };
  },

  async createRow(resolvedInput) {
    const employee = await employeeService.createEmployee(resolvedInput);
    return { id: employee.id };
  },
};
