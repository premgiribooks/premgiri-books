import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "@/lib/app-error";
import { AuthenticationError, AuthorizationError } from "@/lib/current-user";
import type { LowStockReport } from "@/types/inventory-report";

import { GET } from "./route";

const {
  getCurrentCompanyUserMock,
  assertPermissionMock,
  getLowStockReportMock,
  exportToExcelBufferMock,
  toLowStockExportTableMock,
  errorMock,
} = vi.hoisted(() => ({
  getCurrentCompanyUserMock: vi.fn(),
  assertPermissionMock: vi.fn(),
  getLowStockReportMock: vi.fn(),
  exportToExcelBufferMock: vi.fn(),
  toLowStockExportTableMock: vi.fn(),
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
vi.mock("@/modules/reports/inventory/services/inventory-report-service", () => ({
  inventoryReportService: { getLowStockReport: getLowStockReportMock },
}));
vi.mock("@/lib/excel-export", () => ({
  exportToExcelBuffer: exportToExcelBufferMock,
}));
vi.mock("@/engines/reporting/inventory-reports", () => ({
  toLowStockExportTable: toLowStockExportTableMock,
}));
vi.mock("@/lib/logger", () => ({
  logger: { error: errorMock },
}));

function request(query = ""): Request {
  return new Request(`http://localhost/reports/inventory/low-stock/export${query}`);
}

describe("GET /reports/inventory/low-stock/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentCompanyUserMock.mockResolvedValue({ id: "user-1", companyId: "company-1", role: "Accountant" });
    assertPermissionMock.mockResolvedValue(undefined);
    getLowStockReportMock.mockResolvedValue({ rows: [] } as LowStockReport);
    toLowStockExportTableMock.mockReturnValue([{ sheetName: "Low Stock", columns: [], rows: [] }]);
    exportToExcelBufferMock.mockResolvedValue(Buffer.from("fake-xlsx"));
  });

  it("returns 400 for an invalid warehouseId — never reaching the service", async () => {
    const response = await GET(request("?warehouseId=not-a-uuid"));

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
    expect(getLowStockReportMock).not.toHaveBeenCalled();
  });

  it("maps a plain AppError to 400", async () => {
    getLowStockReportMock.mockRejectedValue(new AppError("Something went wrong."));

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

  it("works with no filters at all", async () => {
    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(getLowStockReportMock).toHaveBeenCalledWith({});
  });

  it("passes an explicit warehouseId filter through to the service", async () => {
    await GET(request("?warehouseId=22222222-2222-4222-8222-222222222222"));

    expect(getLowStockReportMock).toHaveBeenCalledWith({ warehouseId: "22222222-2222-4222-8222-222222222222" });
  });

  it("returns the workbook buffer with the correct headers on success", async () => {
    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="Low-Stock.xlsx"');
    expect(Buffer.from(await response.arrayBuffer()).toString()).toBe("fake-xlsx");
    expect(assertPermissionMock).toHaveBeenCalledWith(expect.anything(), "reports", "export");
  });
});
