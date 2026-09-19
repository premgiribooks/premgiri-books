import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "@/lib/app-error";
import { AuthenticationError, AuthorizationError } from "@/lib/current-user";
import type { EmployeeDirectoryReport } from "@/types/employee-report";

import { GET } from "./route";

const {
  getCurrentCompanyUserMock,
  assertPermissionMock,
  getEmployeeDirectoryMock,
  exportToExcelBufferMock,
  toEmployeeDirectoryExportTableMock,
  errorMock,
} = vi.hoisted(() => ({
  getCurrentCompanyUserMock: vi.fn(),
  assertPermissionMock: vi.fn(),
  getEmployeeDirectoryMock: vi.fn(),
  exportToExcelBufferMock: vi.fn(),
  toEmployeeDirectoryExportTableMock: vi.fn(),
  errorMock: vi.fn(),
}));

vi.mock("@/lib/current-user", () => ({
  AuthenticationError: class AuthenticationError extends Error {},
  AuthorizationError: class AuthorizationError extends Error {},
  getCurrentCompanyUser: getCurrentCompanyUserMock,
}));
vi.mock("@/lib/permissions", () => ({
  assertPermission: assertPermissionMock,
}));
vi.mock("@/modules/reports/employees/services/employee-report-service", () => ({
  employeeReportService: { getEmployeeDirectory: getEmployeeDirectoryMock },
}));
vi.mock("@/lib/excel-export", () => ({
  exportToExcelBuffer: exportToExcelBufferMock,
}));
vi.mock("@/engines/reporting/employee-reports", () => ({
  toEmployeeDirectoryExportTable: toEmployeeDirectoryExportTableMock,
}));
vi.mock("@/lib/logger", () => ({
  logger: { error: errorMock },
}));

function request(query = ""): Request {
  return new Request(`http://localhost/reports/employees/directory/export${query}`);
}

describe("GET /reports/employees/directory/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentCompanyUserMock.mockResolvedValue({ id: "user-1", companyId: "company-1", role: "Accountant" });
    assertPermissionMock.mockResolvedValue(undefined);
    getEmployeeDirectoryMock.mockResolvedValue({ rows: [] } as EmployeeDirectoryReport);
    toEmployeeDirectoryExportTableMock.mockReturnValue([{ sheetName: "Employee Directory", columns: [], rows: [] }]);
    exportToExcelBufferMock.mockResolvedValue(Buffer.from("fake-xlsx"));
  });

  it("returns 400 for an invalid status", async () => {
    const response = await GET(request("?status=NOT_A_STATUS"));

    expect(response.status).toBe(400);
    expect(getCurrentCompanyUserMock).not.toHaveBeenCalled();
  });

  it("maps AuthenticationError to 401", async () => {
    getCurrentCompanyUserMock.mockRejectedValue(new AuthenticationError());

    const response = await GET(request());

    expect(response.status).toBe(401);
  });

  it("maps AuthorizationError (missing reports:export) to 403, before the service is ever called", async () => {
    assertPermissionMock.mockRejectedValue(new AuthorizationError("You do not have permission to export reports."));

    const response = await GET(request());

    expect(response.status).toBe(403);
    expect(getEmployeeDirectoryMock).not.toHaveBeenCalled();
  });

  it("maps a plain AppError to 400", async () => {
    getEmployeeDirectoryMock.mockRejectedValue(new AppError("Something went wrong."));

    const response = await GET(request());

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Something went wrong." });
  });

  it("returns a generic 500 and logs an unexpected export failure", async () => {
    exportToExcelBufferMock.mockRejectedValue(new Error("exceljs blew up"));

    const response = await GET(request());

    expect(response.status).toBe(500);
    expect(errorMock).toHaveBeenCalledTimes(1);
  });

  it("works with no filters at all, defaulting status to 'active' like the schema's own default", async () => {
    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(getEmployeeDirectoryMock).toHaveBeenCalledWith({ status: "active" });
  });

  it("passes explicit department/designation/branchId/status filters through to the service", async () => {
    await GET(
      request(
        "?department=Sales&designation=Manager&branchId=11111111-1111-4111-8111-111111111111&status=all"
      )
    );

    expect(getEmployeeDirectoryMock).toHaveBeenCalledWith({
      department: "Sales",
      designation: "Manager",
      branchId: "11111111-1111-4111-8111-111111111111",
      status: "all",
    });
  });

  it("returns the workbook buffer with the correct headers on success", async () => {
    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="Employee-Directory.xlsx"');
    expect(Buffer.from(await response.arrayBuffer()).toString()).toBe("fake-xlsx");
    expect(assertPermissionMock).toHaveBeenCalledWith(expect.anything(), "reports", "export");
  });
});
