import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "@/lib/app-error";
import { AuthenticationError, AuthorizationError } from "@/lib/current-user";
import type { SalesReturnSummaryReport } from "@/types/sales-report";

import { GET } from "./route";

const {
  getCurrentCompanyUserMock,
  assertPermissionMock,
  getSalesReturnSummaryMock,
  exportToExcelBufferMock,
  toSalesReturnSummaryExportTableMock,
  renderHtmlToPdfOrHtmlMock,
  buildReportHtmlMock,
  errorMock,
} = vi.hoisted(() => ({
  getCurrentCompanyUserMock: vi.fn(),
  assertPermissionMock: vi.fn(),
  getSalesReturnSummaryMock: vi.fn(),
  exportToExcelBufferMock: vi.fn(),
  toSalesReturnSummaryExportTableMock: vi.fn(),
  renderHtmlToPdfOrHtmlMock: vi.fn(),
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
vi.mock("@/modules/reports/sales/services/sales-report-service", () => ({
  salesReportService: { getSalesReturnSummary: getSalesReturnSummaryMock },
}));
vi.mock("@/lib/excel-export", () => ({
  exportToExcelBuffer: exportToExcelBufferMock,
}));
vi.mock("@/engines/reporting/sales-reports", () => ({
  toSalesReturnSummaryExportTable: toSalesReturnSummaryExportTableMock,
}));
vi.mock("@/lib/pdf-generation", () => ({
  renderHtmlToPdfOrHtml: renderHtmlToPdfOrHtmlMock,
}));
vi.mock("@/lib/pdf-templates/report-pdf-template", () => ({
  buildReportHtml: buildReportHtmlMock,
}));
vi.mock("@/lib/logger", () => ({
  logger: { error: errorMock },
}));

function request(query: string): Request {
  return new Request(`http://localhost/reports/sales/returns/export${query}`);
}

const VALID_QUERY = "?dateFrom=2027-01-01&dateTo=2027-03-31";
const EMPTY_REPORT: SalesReturnSummaryReport = { rows: [], totalGrandTotal: 0 };

describe("GET /reports/sales/returns/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentCompanyUserMock.mockResolvedValue({ id: "user-1", companyId: "company-1", role: "Accountant" });
    assertPermissionMock.mockResolvedValue(undefined);
    getSalesReturnSummaryMock.mockResolvedValue(EMPTY_REPORT);
    toSalesReturnSummaryExportTableMock.mockReturnValue([{ sheetName: "Sales Return Summary", columns: [], rows: [] }]);
    exportToExcelBufferMock.mockResolvedValue(Buffer.from("fake-xlsx"));
    buildReportHtmlMock.mockReturnValue("<html></html>");
    renderHtmlToPdfOrHtmlMock.mockResolvedValue({ kind: "pdf", buffer: Buffer.from("%PDF-fake") });
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
    expect(getSalesReturnSummaryMock).not.toHaveBeenCalled();
  });

  it("maps a plain AppError to 400", async () => {
    getSalesReturnSummaryMock.mockRejectedValue(new AppError("Something about the filters was invalid."));

    const response = await GET(request(VALID_QUERY));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Something about the filters was invalid." });
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
      'attachment; filename="Sales-Return-Summary-2027-01-01_to_2027-03-31.xlsx"'
    );
    expect(Buffer.from(await response.arrayBuffer()).toString()).toBe("fake-xlsx");
    expect(assertPermissionMock).toHaveBeenCalledWith(expect.anything(), "reports", "export");
  });

  it("succeeds with an omitted customerId/status — both optional, defaulting server-side", async () => {
    const response = await GET(request(VALID_QUERY));

    expect(response.status).toBe(200);
    expect(getSalesReturnSummaryMock).toHaveBeenCalledWith(
      expect.objectContaining({ dateFrom: "2027-01-01", dateTo: "2027-03-31", status: "POSTED" })
    );
    expect(getSalesReturnSummaryMock.mock.calls[0][0]).not.toHaveProperty("customerId");
  });

  it("passes customerId/status through when present in the query string", async () => {
    const response = await GET(
      request(`${VALID_QUERY}&customerId=11111111-1111-4111-8111-111111111111&status=DRAFT`)
    );

    expect(response.status).toBe(200);
    expect(getSalesReturnSummaryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dateFrom: "2027-01-01",
        dateTo: "2027-03-31",
        customerId: "11111111-1111-4111-8111-111111111111",
        status: "DRAFT",
      })
    );
  });

  describe("format=pdf", () => {
    it("returns a %PDF--prefixed buffer with the correct headers on success", async () => {
      const response = await GET(request(`${VALID_QUERY}&format=pdf`));

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("application/pdf");
      expect(response.headers.get("Content-Disposition")).toBe(
        'attachment; filename="Sales-Return-Summary-2027-01-01_to_2027-03-31.pdf"'
      );
      const buffer = Buffer.from(await response.arrayBuffer());
      expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    });

    it("reuses the exact same toSalesReturnSummaryExportTable shaping as the xlsx path — one shaping function, two rendering targets", async () => {
      const sharedTables = [{ sheetName: "Sales Return Summary", columns: [], rows: [] }];
      toSalesReturnSummaryExportTableMock.mockReturnValue(sharedTables);

      await GET(request(`${VALID_QUERY}&format=pdf`));

      expect(buildReportHtmlMock).toHaveBeenCalledWith(sharedTables);
      expect(exportToExcelBufferMock).not.toHaveBeenCalled();
    });

    it("renders A4 portrait per the reports paper-size convention", async () => {
      await GET(request(`${VALID_QUERY}&format=pdf`));

      expect(renderHtmlToPdfOrHtmlMock).toHaveBeenCalledWith(expect.any(String), { format: "A4", orientation: "portrait" });
    });

    it("applies the same reports:export permission gate as the xlsx path", async () => {
      assertPermissionMock.mockRejectedValue(new AuthorizationError("You do not have permission to export reports."));

      const response = await GET(request(`${VALID_QUERY}&format=pdf`));

      expect(response.status).toBe(403);
      expect(getSalesReturnSummaryMock).not.toHaveBeenCalled();
      expect(renderHtmlToPdfOrHtmlMock).not.toHaveBeenCalled();
    });

    it("applies the same filter validation as the xlsx path", async () => {
      const response = await GET(request(`?dateFrom=not-a-date&dateTo=2027-03-31&format=pdf`));

      expect(response.status).toBe(400);
      expect(getCurrentCompanyUserMock).not.toHaveBeenCalled();
    });

    it("returns a generic 500 and logs an unexpected render failure", async () => {
      // A genuine rendering crash (not the Chromium-unavailable case, which
      // renderHtmlToPdfOrHtml itself catches and turns into the
      // {kind:"html"} fallback tested below rather than a throw) must still
      // surface as a real 500.
      renderHtmlToPdfOrHtmlMock.mockRejectedValue(new Error("Unexpected template rendering crash"));

      const response = await GET(request(`${VALID_QUERY}&format=pdf`));

      expect(response.status).toBe(500);
      expect(errorMock).toHaveBeenCalledTimes(1);
    });

    it("falls back to the raw HTML (no Content-Disposition) when server-side Chromium isn't available", async () => {
      renderHtmlToPdfOrHtmlMock.mockResolvedValue({ kind: "html", html: "<html>fallback</html>" });

      const response = await GET(request(`${VALID_QUERY}&format=pdf`));

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
      expect(response.headers.get("Content-Disposition")).toBeNull();
      expect(await response.text()).toBe("<html>fallback</html>");
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
