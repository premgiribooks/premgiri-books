import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "@/lib/app-error";
import { AuthenticationError, AuthorizationError } from "@/lib/current-user";
import type { SupplierDirectoryReport } from "@/types/supplier-report";

import { GET } from "./route";

const {
  getCurrentCompanyUserMock,
  assertPermissionMock,
  getSupplierDirectoryMock,
  exportToExcelBufferMock,
  toSupplierDirectoryExportTableMock,
  errorMock,
} = vi.hoisted(() => ({
  getCurrentCompanyUserMock: vi.fn(),
  assertPermissionMock: vi.fn(),
  getSupplierDirectoryMock: vi.fn(),
  exportToExcelBufferMock: vi.fn(),
  toSupplierDirectoryExportTableMock: vi.fn(),
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
vi.mock("@/modules/reports/suppliers/services/supplier-report-service", () => ({
  supplierReportService: { getSupplierDirectory: getSupplierDirectoryMock },
}));
vi.mock("@/lib/excel-export", () => ({
  exportToExcelBuffer: exportToExcelBufferMock,
}));
vi.mock("@/engines/reporting/supplier-reports", () => ({
  toSupplierDirectoryExportTable: toSupplierDirectoryExportTableMock,
}));
vi.mock("@/lib/logger", () => ({
  logger: { error: errorMock },
}));

function request(query: string): Request {
  return new Request(`http://localhost/reports/suppliers/directory/export${query}`);
}

describe("GET /reports/suppliers/directory/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentCompanyUserMock.mockResolvedValue({ id: "user-1", companyId: "company-1", role: "Accountant" });
    assertPermissionMock.mockResolvedValue(undefined);
    getSupplierDirectoryMock.mockResolvedValue({ rows: [] } as SupplierDirectoryReport);
    toSupplierDirectoryExportTableMock.mockReturnValue([{ sheetName: "Supplier Directory", columns: [], rows: [] }]);
    exportToExcelBufferMock.mockResolvedValue(Buffer.from("fake-xlsx"));
  });

  it("returns 400 for an invalid status filter — never reaching the service", async () => {
    const response = await GET(request("?status=not-a-real-status"));

    expect(response.status).toBe(400);
    expect(getCurrentCompanyUserMock).not.toHaveBeenCalled();
  });

  it("maps AuthenticationError to 401", async () => {
    getCurrentCompanyUserMock.mockRejectedValue(new AuthenticationError());

    const response = await GET(request(""));

    expect(response.status).toBe(401);
  });

  it("maps AuthorizationError (missing reports:export) to 403, before the service is ever called", async () => {
    assertPermissionMock.mockRejectedValue(new AuthorizationError("You do not have permission to export reports."));

    const response = await GET(request(""));

    expect(response.status).toBe(403);
    expect(getSupplierDirectoryMock).not.toHaveBeenCalled();
  });

  it("maps a plain AppError to 400", async () => {
    getSupplierDirectoryMock.mockRejectedValue(new AppError("Something went wrong."));

    const response = await GET(request(""));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Something went wrong." });
  });

  it("returns a generic 500 and logs an unexpected export failure", async () => {
    exportToExcelBufferMock.mockRejectedValue(new Error("exceljs blew up"));

    const response = await GET(request(""));

    expect(response.status).toBe(500);
    expect(errorMock).toHaveBeenCalledTimes(1);
  });

  it("defaults to the active-status filter when no query param is given", async () => {
    const response = await GET(request(""));

    expect(response.status).toBe(200);
    expect(getSupplierDirectoryMock).toHaveBeenCalledWith(expect.objectContaining({ status: "active" }));
  });

  it("passes an explicit status filter through to the service", async () => {
    const response = await GET(request("?status=all"));

    expect(response.status).toBe(200);
    expect(getSupplierDirectoryMock).toHaveBeenCalledWith(expect.objectContaining({ status: "all" }));
  });

  it("returns the workbook buffer with the correct headers on success", async () => {
    const response = await GET(request(""));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="Supplier-Directory.xlsx"');
    expect(Buffer.from(await response.arrayBuffer()).toString()).toBe("fake-xlsx");
    expect(assertPermissionMock).toHaveBeenCalledWith(expect.anything(), "reports", "export");
  });
});
