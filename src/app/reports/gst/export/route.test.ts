import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "@/lib/app-error";
import { AuthenticationError, AuthorizationError } from "@/lib/current-user";
import type { GstDashboardReport } from "@/types/gst-dashboard";

import { GET } from "./route";

const {
  getCurrentCompanyUserMock,
  assertPermissionMock,
  getGstDashboardMock,
  exportToExcelBufferMock,
  toGstDashboardExportTableMock,
  renderHtmlToPdfMock,
  buildReportHtmlMock,
  errorMock,
} = vi.hoisted(() => ({
  getCurrentCompanyUserMock: vi.fn(),
  assertPermissionMock: vi.fn(),
  getGstDashboardMock: vi.fn(),
  exportToExcelBufferMock: vi.fn(),
  toGstDashboardExportTableMock: vi.fn(),
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
vi.mock("@/modules/reports/services/gst-reports-service", () => ({
  gstReportsService: { getGstDashboard: getGstDashboardMock },
}));
vi.mock("@/lib/excel-export", () => ({
  exportToExcelBuffer: exportToExcelBufferMock,
}));
vi.mock("@/engines/reporting/gst-dashboard", () => ({
  toGstDashboardExportTable: toGstDashboardExportTableMock,
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
  return new Request(`http://localhost/reports/gst/export${query}`);
}

const VALID_QUERY = "?from=2027-01-01&to=2027-03-31";

describe("GET /reports/gst/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentCompanyUserMock.mockResolvedValue({ id: "user-1", companyId: "company-1", role: "Accountant" });
    assertPermissionMock.mockResolvedValue(undefined);
    getGstDashboardMock.mockResolvedValue({
      months: [],
      totals: { outputTax: 0, inputTax: 0, netLiability: 0 },
      hsnSummary: { rows: [], totals: { taxableAmount: 0, cgst: 0, sgst: 0, igst: 0, cess: 0, totalAmount: 0 } },
    } as GstDashboardReport);
    toGstDashboardExportTableMock.mockReturnValue([
      { sheetName: "GST Trend", columns: [], rows: [] },
      { sheetName: "HSN Summary", columns: [], rows: [] },
    ]);
    exportToExcelBufferMock.mockResolvedValue(Buffer.from("fake-xlsx"));
    buildReportHtmlMock.mockReturnValue("<html></html>");
    renderHtmlToPdfMock.mockResolvedValue(Buffer.from("%PDF-fake"));
  });

  it("returns 400 for a missing/invalid from or to — never reaching the service", async () => {
    const response = await GET(request("?from=not-a-date&to=2027-03-31"));

    expect(response.status).toBe(400);
    expect(getCurrentCompanyUserMock).not.toHaveBeenCalled();
  });

  it("returns 400 when to is before from", async () => {
    const response = await GET(request("?from=2027-03-31&to=2027-01-01"));

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
    expect(getGstDashboardMock).not.toHaveBeenCalled();
  });

  it("maps a plain AppError to 400", async () => {
    getGstDashboardMock.mockRejectedValue(new AppError("Something went wrong reading the GST dashboard."));

    const response = await GET(request(VALID_QUERY));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Something went wrong reading the GST dashboard." });
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
      'attachment; filename="GST-Reports-2027-01-01_to_2027-03-31.xlsx"'
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
        'attachment; filename="GST-Reports-2027-01-01_to_2027-03-31.pdf"'
      );
      const buffer = Buffer.from(await response.arrayBuffer());
      expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    });

    it("reuses the exact same toGstDashboardExportTable shaping as the xlsx path — one shaping function, two rendering targets", async () => {
      const sharedTables = [
        { sheetName: "GST Trend", columns: [], rows: [] },
        { sheetName: "HSN Summary", columns: [], rows: [] },
      ];
      toGstDashboardExportTableMock.mockReturnValue(sharedTables);

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
      expect(getGstDashboardMock).not.toHaveBeenCalled();
      expect(renderHtmlToPdfMock).not.toHaveBeenCalled();
    });

    it("applies the same filter validation as the xlsx path", async () => {
      const response = await GET(request("?from=not-a-date&to=2027-03-31&format=pdf"));

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
