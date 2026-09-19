import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "@/lib/app-error";
import { AuthenticationError, AuthorizationError } from "@/lib/current-user";
import type { PartyWisePurchaseReport } from "@/types/purchase-report";

import { GET } from "./route";

const {
  getCurrentCompanyUserMock,
  assertPermissionMock,
  getSupplierPurchaseSummaryMock,
  exportToExcelBufferMock,
  toSupplierPurchaseSummaryExportTableMock,
  errorMock,
} = vi.hoisted(() => ({
  getCurrentCompanyUserMock: vi.fn(),
  assertPermissionMock: vi.fn(),
  getSupplierPurchaseSummaryMock: vi.fn(),
  exportToExcelBufferMock: vi.fn(),
  toSupplierPurchaseSummaryExportTableMock: vi.fn(),
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
  supplierReportService: { getSupplierPurchaseSummary: getSupplierPurchaseSummaryMock },
}));
vi.mock("@/lib/excel-export", () => ({
  exportToExcelBuffer: exportToExcelBufferMock,
}));
vi.mock("@/engines/reporting/supplier-reports", () => ({
  toSupplierPurchaseSummaryExportTable: toSupplierPurchaseSummaryExportTableMock,
}));
vi.mock("@/lib/logger", () => ({
  logger: { error: errorMock },
}));

function request(query: string): Request {
  return new Request(`http://localhost/reports/suppliers/purchase-summary/export${query}`);
}

const VALID_QUERY = "?dateFrom=2027-04-01&dateTo=2027-04-30";

describe("GET /reports/suppliers/purchase-summary/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentCompanyUserMock.mockResolvedValue({ id: "user-1", companyId: "company-1", role: "Accountant" });
    assertPermissionMock.mockResolvedValue(undefined);
    getSupplierPurchaseSummaryMock.mockResolvedValue({
      rows: [],
      totals: { invoiceCount: 0, taxableAmount: 0, totalTax: 0, grandTotal: 0 },
    } as PartyWisePurchaseReport);
    toSupplierPurchaseSummaryExportTableMock.mockReturnValue([
      { sheetName: "Supplier Purchase Summary", columns: [], rows: [] },
    ]);
    exportToExcelBufferMock.mockResolvedValue(Buffer.from("fake-xlsx"));
  });

  it("returns 400 for a missing/invalid date range — never reaching the service", async () => {
    const response = await GET(request("?dateFrom=not-a-date&dateTo=2027-04-30"));

    expect(response.status).toBe(400);
    expect(getCurrentCompanyUserMock).not.toHaveBeenCalled();
  });

  it("returns 400 when dateTo is before dateFrom", async () => {
    const response = await GET(request("?dateFrom=2027-04-30&dateTo=2027-04-01"));

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
    expect(getSupplierPurchaseSummaryMock).not.toHaveBeenCalled();
  });

  it("maps a plain AppError to 400", async () => {
    getSupplierPurchaseSummaryMock.mockRejectedValue(new AppError("Something went wrong."));

    const response = await GET(request(VALID_QUERY));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Something went wrong." });
  });

  it("returns a generic 500 and logs an unexpected export failure", async () => {
    exportToExcelBufferMock.mockRejectedValue(new Error("exceljs blew up"));

    const response = await GET(request(VALID_QUERY));

    expect(response.status).toBe(500);
    expect(errorMock).toHaveBeenCalledTimes(1);
  });

  it("returns the workbook buffer with the correct headers on success", async () => {
    const response = await GET(request(VALID_QUERY));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="Supplier-Purchase-Summary-2027-04-01_to_2027-04-30.xlsx"'
    );
    expect(Buffer.from(await response.arrayBuffer()).toString()).toBe("fake-xlsx");
    expect(assertPermissionMock).toHaveBeenCalledWith(expect.anything(), "reports", "export");
  });
});
