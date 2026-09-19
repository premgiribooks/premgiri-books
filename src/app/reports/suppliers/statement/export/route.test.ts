import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "@/lib/app-error";
import { AuthenticationError, AuthorizationError } from "@/lib/current-user";
import type { SupplierStatementReport } from "@/types/supplier-report";

import { GET } from "./route";

const {
  getCurrentCompanyUserMock,
  assertPermissionMock,
  getSupplierStatementMock,
  exportToExcelBufferMock,
  toSupplierStatementExportTableMock,
  errorMock,
} = vi.hoisted(() => ({
  getCurrentCompanyUserMock: vi.fn(),
  assertPermissionMock: vi.fn(),
  getSupplierStatementMock: vi.fn(),
  exportToExcelBufferMock: vi.fn(),
  toSupplierStatementExportTableMock: vi.fn(),
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
  supplierReportService: { getSupplierStatement: getSupplierStatementMock },
}));
vi.mock("@/lib/excel-export", () => ({
  exportToExcelBuffer: exportToExcelBufferMock,
}));
vi.mock("@/engines/reporting/supplier-reports", () => ({
  toSupplierStatementExportTable: toSupplierStatementExportTableMock,
}));
vi.mock("@/lib/logger", () => ({
  logger: { error: errorMock },
}));

function request(query: string): Request {
  return new Request(`http://localhost/reports/suppliers/statement/export${query}`);
}

const VALID_QUERY = "?supplierId=11111111-1111-4111-8111-111111111111&dateFrom=2027-03-01&dateTo=2027-03-31";

describe("GET /reports/suppliers/statement/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentCompanyUserMock.mockResolvedValue({ id: "user-1", companyId: "company-1", role: "Accountant" });
    assertPermissionMock.mockResolvedValue(undefined);
    getSupplierStatementMock.mockResolvedValue({
      supplierId: "supp-1",
      supplierName: "Acme Wholesale",
      openingBalance: 0,
      lines: [],
      closingBalance: 0,
    } as SupplierStatementReport);
    toSupplierStatementExportTableMock.mockReturnValue([{ sheetName: "Supplier Statement", columns: [], rows: [] }]);
    exportToExcelBufferMock.mockResolvedValue(Buffer.from("fake-xlsx"));
  });

  it("returns 400 for a missing/invalid supplierId or date range — never reaching the service", async () => {
    const response = await GET(request("?supplierId=not-a-uuid&dateFrom=2027-03-01&dateTo=2027-03-31"));

    expect(response.status).toBe(400);
    expect(getCurrentCompanyUserMock).not.toHaveBeenCalled();
  });

  it("maps AuthenticationError to 401", async () => {
    getCurrentCompanyUserMock.mockRejectedValue(new AuthenticationError());

    const response = await GET(request(VALID_QUERY));

    expect(response.status).toBe(401);
  });

  it("maps AuthorizationError (missing reports:export) to 403, before the service is ever called", async () => {
    assertPermissionMock.mockRejectedValue(new AuthorizationError("You do not have permission to export reports."));

    const response = await GET(request(VALID_QUERY));

    expect(response.status).toBe(403);
    expect(getSupplierStatementMock).not.toHaveBeenCalled();
  });

  it("maps a plain AppError (e.g. supplier not found) to 400", async () => {
    getSupplierStatementMock.mockRejectedValue(new AppError("Supplier not found."));

    const response = await GET(request(VALID_QUERY));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Supplier not found." });
  });

  it("returns a generic 500 and logs an unexpected export failure", async () => {
    exportToExcelBufferMock.mockRejectedValue(new Error("exceljs blew up"));

    const response = await GET(request(VALID_QUERY));

    expect(response.status).toBe(500);
    expect(errorMock).toHaveBeenCalledTimes(1);
  });

  it("returns the workbook buffer with the correct headers on success, filename built from the report's own supplierName", async () => {
    const response = await GET(request(VALID_QUERY));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="Supplier-Statement-Acme_Wholesale-2027-03-01_to_2027-03-31.xlsx"'
    );
    expect(Buffer.from(await response.arrayBuffer()).toString()).toBe("fake-xlsx");
    expect(assertPermissionMock).toHaveBeenCalledWith(expect.anything(), "reports", "export");
  });
});
