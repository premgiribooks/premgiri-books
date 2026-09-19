import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "@/lib/app-error";
import { AuthenticationError, AuthorizationError } from "@/lib/current-user";
import type { PurchaseReturnSummaryReport } from "@/types/purchase-report";

import { GET } from "./route";

const {
  getCurrentCompanyUserMock,
  assertPermissionMock,
  getPurchaseReturnSummaryMock,
  exportToExcelBufferMock,
  toPurchaseReturnSummaryExportTableMock,
  renderHtmlToPdfMock,
  buildReportHtmlMock,
  errorMock,
} = vi.hoisted(() => ({
  getCurrentCompanyUserMock: vi.fn(),
  assertPermissionMock: vi.fn(),
  getPurchaseReturnSummaryMock: vi.fn(),
  exportToExcelBufferMock: vi.fn(),
  toPurchaseReturnSummaryExportTableMock: vi.fn(),
  renderHtmlToPdfMock: vi.fn(),
  buildReportHtmlMock: vi.fn(),
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
vi.mock("@/modules/reports/purchase/services/purchase-report-service", () => ({
  purchaseReportService: { getPurchaseReturnSummary: getPurchaseReturnSummaryMock },
}));
vi.mock("@/lib/excel-export", () => ({
  exportToExcelBuffer: exportToExcelBufferMock,
}));
vi.mock("@/engines/reporting/purchase-reports", () => ({
  toPurchaseReturnSummaryExportTable: toPurchaseReturnSummaryExportTableMock,
}));
vi.mock("@/lib/pdf-generation", () => ({
  renderHtmlToPdf: renderHtmlToPdfMock,
}));
vi.mock("@/lib/pdf-templates/report-pdf-template", () => ({
  buildReportHtml: buildReportHtmlMock,
}));
vi.mock("@/lib/logger", () => ({
  logger: { error: errorMock },
}));

function request(query: string): Request {
  return new Request(`http://localhost/reports/purchase/returns/export${query}`);
}

const VALID_QUERY = "?dateFrom=2027-01-01&dateTo=2027-03-31";

describe("GET /reports/purchase/returns/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentCompanyUserMock.mockResolvedValue({ id: "user-1", companyId: "company-1", role: "Accountant" });
    assertPermissionMock.mockResolvedValue(undefined);
    getPurchaseReturnSummaryMock.mockResolvedValue({ rows: [], totalGrandTotal: 0 } as PurchaseReturnSummaryReport);
    toPurchaseReturnSummaryExportTableMock.mockReturnValue([{ sheetName: "Purchase Return Summary", columns: [], rows: [] }]);
    exportToExcelBufferMock.mockResolvedValue(Buffer.from("fake-xlsx"));
    buildReportHtmlMock.mockReturnValue("<html></html>");
    renderHtmlToPdfMock.mockResolvedValue(Buffer.from("%PDF-fake"));
  });

  it("returns 400 for a missing/invalid dateFrom or dateTo — never reaching the service", async () => {
    const response = await GET(request("?dateFrom=not-a-date&dateTo=2027-03-31"));

    expect(response.status).toBe(400);
    expect(getCurrentCompanyUserMock).not.toHaveBeenCalled();
  });

  it("returns 400 when dateTo is before dateFrom", async () => {
    const response = await GET(request("?dateFrom=2027-03-31&dateTo=2027-01-01"));

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
    expect(getPurchaseReturnSummaryMock).not.toHaveBeenCalled();
  });

  it("maps a plain AppError to 400", async () => {
    getPurchaseReturnSummaryMock.mockRejectedValue(new AppError("Something went wrong reading the Purchase Return Summary."));

    const response = await GET(request(VALID_QUERY));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Something went wrong reading the Purchase Return Summary." });
  });

  it("returns a generic 500 and logs an unexpected export failure", async () => {
    exportToExcelBufferMock.mockRejectedValue(new Error("exceljs blew up"));

    const response = await GET(request(VALID_QUERY));

    expect(response.status).toBe(500);
    expect(errorMock).toHaveBeenCalledTimes(1);
  });

  it("succeeds with supplierId/status omitted, letting the schema default status to POSTED", async () => {
    const response = await GET(request(VALID_QUERY));

    expect(response.status).toBe(200);
    expect(getPurchaseReturnSummaryMock).toHaveBeenCalledWith({
      dateFrom: "2027-01-01",
      dateTo: "2027-03-31",
      status: "POSTED",
    });
  });

  it("passes supplierId/status through when present in the query string", async () => {
    const response = await GET(
      request(`${VALID_QUERY}&supplierId=11111111-1111-4111-8111-111111111111&status=DRAFT`)
    );

    expect(response.status).toBe(200);
    expect(getPurchaseReturnSummaryMock).toHaveBeenCalledWith({
      dateFrom: "2027-01-01",
      dateTo: "2027-03-31",
      supplierId: "11111111-1111-4111-8111-111111111111",
      status: "DRAFT",
    });
  });

  it("returns the workbook buffer with the correct headers on success", async () => {
    const response = await GET(request(VALID_QUERY));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="Purchase-Return-Summary-2027-01-01_to_2027-03-31.xlsx"'
    );
    expect(Buffer.from(await response.arrayBuffer()).toString()).toBe("fake-xlsx");
    expect(assertPermissionMock).toHaveBeenCalledWith(expect.anything(), "reports", "export");
  });

  describe("format=pdf", () => {
    it("returns a %PDF--prefixed buffer with the correct headers on success", async () => {
      const response = await GET(request(`${VALID_QUERY}&format=pdf`));

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("application/pdf");
      expect(response.headers.get("Content-Disposition")).toBe(
        'attachment; filename="Purchase-Return-Summary-2027-01-01_to_2027-03-31.pdf"'
      );
      const buffer = Buffer.from(await response.arrayBuffer());
      expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    });

    it("reuses the exact same toPurchaseReturnSummaryExportTable shaping as the xlsx path — one shaping function, two rendering targets", async () => {
      const sharedTables = [{ sheetName: "Purchase Return Summary", columns: [], rows: [] }];
      toPurchaseReturnSummaryExportTableMock.mockReturnValue(sharedTables);

      await GET(request(`${VALID_QUERY}&format=pdf`));

      expect(buildReportHtmlMock).toHaveBeenCalledWith(sharedTables);
      expect(exportToExcelBufferMock).not.toHaveBeenCalled();
    });

    it("renders A4 portrait per the reports paper-size convention", async () => {
      await GET(request(`${VALID_QUERY}&format=pdf`));

      expect(renderHtmlToPdfMock).toHaveBeenCalledWith(expect.any(String), { format: "A4", orientation: "portrait" });
    });

    it("applies the same reports:export permission gate as the xlsx path", async () => {
      assertPermissionMock.mockRejectedValue(new AuthorizationError("You do not have permission to export reports."));

      const response = await GET(request(`${VALID_QUERY}&format=pdf`));

      expect(response.status).toBe(403);
      expect(getPurchaseReturnSummaryMock).not.toHaveBeenCalled();
      expect(renderHtmlToPdfMock).not.toHaveBeenCalled();
    });

    it("applies the same filter validation as the xlsx path", async () => {
      const response = await GET(request("?dateFrom=not-a-date&dateTo=2027-03-31&format=pdf"));

      expect(response.status).toBe(400);
      expect(getCurrentCompanyUserMock).not.toHaveBeenCalled();
    });

    it("returns a generic 500 and logs an unexpected render failure", async () => {
      renderHtmlToPdfMock.mockRejectedValue(new Error("Chromium launch failed"));

      const response = await GET(request(`${VALID_QUERY}&format=pdf`));

      expect(response.status).toBe(500);
      expect(errorMock).toHaveBeenCalledTimes(1);
    });

    it("falls back to xlsx for an unrecognized format value instead of erroring", async () => {
      const response = await GET(request(`${VALID_QUERY}&format=something-unknown`));

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
    });
  });
});
