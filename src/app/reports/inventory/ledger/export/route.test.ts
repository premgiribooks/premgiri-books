import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "@/lib/app-error";
import { AuthenticationError, AuthorizationError } from "@/lib/current-user";
import type { StockLedgerReport } from "@/types/inventory-report";

import { GET } from "./route";

const {
  getCurrentCompanyUserMock,
  assertPermissionMock,
  getStockLedgerReportMock,
  exportToExcelBufferMock,
  toStockLedgerExportTableMock,
  errorMock,
} = vi.hoisted(() => ({
  getCurrentCompanyUserMock: vi.fn(),
  assertPermissionMock: vi.fn(),
  getStockLedgerReportMock: vi.fn(),
  exportToExcelBufferMock: vi.fn(),
  toStockLedgerExportTableMock: vi.fn(),
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
  inventoryReportService: { getStockLedgerReport: getStockLedgerReportMock },
}));
vi.mock("@/lib/excel-export", () => ({
  exportToExcelBuffer: exportToExcelBufferMock,
}));
vi.mock("@/engines/reporting/inventory-reports", () => ({
  toStockLedgerExportTable: toStockLedgerExportTableMock,
}));
vi.mock("@/lib/logger", () => ({
  logger: { error: errorMock },
}));

function request(query: string): Request {
  return new Request(`http://localhost/reports/inventory/ledger/export${query}`);
}

const VALID_QUERY = "?productId=11111111-1111-4111-8111-111111111111";

describe("GET /reports/inventory/ledger/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentCompanyUserMock.mockResolvedValue({ id: "user-1", companyId: "company-1", role: "Accountant" });
    assertPermissionMock.mockResolvedValue(undefined);
    getStockLedgerReportMock.mockResolvedValue({
      productId: "11111111-1111-4111-8111-111111111111",
      productName: "Widget",
      lines: [],
      closingBalance: 0,
    } as StockLedgerReport);
    toStockLedgerExportTableMock.mockReturnValue([{ sheetName: "Stock Ledger", title: "Widget", columns: [], rows: [] }]);
    exportToExcelBufferMock.mockResolvedValue(Buffer.from("fake-xlsx"));
  });

  it("returns 400 for a missing/invalid productId — never reaching the service", async () => {
    const response = await GET(request("?productId=not-a-uuid"));

    expect(response.status).toBe(400);
    expect(getCurrentCompanyUserMock).not.toHaveBeenCalled();
  });

  it("returns 400 when dateTo is before dateFrom", async () => {
    const response = await GET(request(`${VALID_QUERY}&dateFrom=2027-03-31&dateTo=2027-01-01`));

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
    expect(getStockLedgerReportMock).not.toHaveBeenCalled();
  });

  it("maps a plain AppError (e.g. product not found) to 400", async () => {
    getStockLedgerReportMock.mockRejectedValue(new AppError("Product not found."));

    const response = await GET(request(VALID_QUERY));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Product not found." });
  });

  it("returns a generic 500 and logs an unexpected export failure", async () => {
    exportToExcelBufferMock.mockRejectedValue(new Error("exceljs blew up"));

    const response = await GET(request(VALID_QUERY));

    expect(response.status).toBe(500);
    expect(errorMock).toHaveBeenCalledTimes(1);
  });

  it("passes explicit warehouseId/dateFrom/dateTo filters through to the service", async () => {
    await GET(
      request(
        `${VALID_QUERY}&warehouseId=22222222-2222-4222-8222-222222222222&dateFrom=2027-01-01&dateTo=2027-03-31`
      )
    );

    expect(getStockLedgerReportMock).toHaveBeenCalledWith({
      productId: "11111111-1111-4111-8111-111111111111",
      warehouseId: "22222222-2222-4222-8222-222222222222",
      dateFrom: "2027-01-01",
      dateTo: "2027-03-31",
    });
  });

  it("returns the workbook buffer with the correct headers on success, using the report's own productName", async () => {
    const response = await GET(request(VALID_QUERY));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="Stock-Ledger-Widget.xlsx"');
    expect(Buffer.from(await response.arrayBuffer()).toString()).toBe("fake-xlsx");
    expect(assertPermissionMock).toHaveBeenCalledWith(expect.anything(), "reports", "export");
  });
});
