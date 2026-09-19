import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "@/lib/app-error";
import { AuthenticationError, AuthorizationError } from "@/lib/current-user";
import type { CustomerDirectoryReport } from "@/types/customer-report";

import { GET } from "./route";

const {
  getCurrentCompanyUserMock,
  assertPermissionMock,
  getCustomerDirectoryMock,
  exportToExcelBufferMock,
  toCustomerDirectoryExportTableMock,
  renderHtmlToPdfMock,
  buildReportHtmlMock,
  errorMock,
} = vi.hoisted(() => ({
  getCurrentCompanyUserMock: vi.fn(),
  assertPermissionMock: vi.fn(),
  getCustomerDirectoryMock: vi.fn(),
  exportToExcelBufferMock: vi.fn(),
  toCustomerDirectoryExportTableMock: vi.fn(),
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
vi.mock("@/modules/reports/customers/services/customer-report-service", () => ({
  customerReportService: { getCustomerDirectory: getCustomerDirectoryMock },
}));
vi.mock("@/lib/excel-export", () => ({
  exportToExcelBuffer: exportToExcelBufferMock,
}));
vi.mock("@/engines/reporting/customer-reports", () => ({
  toCustomerDirectoryExportTable: toCustomerDirectoryExportTableMock,
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

function request(query = ""): Request {
  return new Request(`http://localhost/reports/customers/directory/export${query}`);
}

describe("GET /reports/customers/directory/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentCompanyUserMock.mockResolvedValue({ id: "user-1", companyId: "company-1", role: "Accountant" });
    assertPermissionMock.mockResolvedValue(undefined);
    getCustomerDirectoryMock.mockResolvedValue({ rows: [] } as CustomerDirectoryReport);
    toCustomerDirectoryExportTableMock.mockReturnValue([{ sheetName: "Customer Directory", columns: [], rows: [] }]);
    exportToExcelBufferMock.mockResolvedValue(Buffer.from("fake-xlsx"));
    buildReportHtmlMock.mockReturnValue("<html></html>");
    renderHtmlToPdfMock.mockResolvedValue(Buffer.from("%PDF-fake"));
  });

  it("returns 400 for an invalid customerType or status", async () => {
    const response = await GET(request("?customerType=NOT_A_TYPE"));

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
    expect(getCustomerDirectoryMock).not.toHaveBeenCalled();
  });

  it("maps a plain AppError to 400", async () => {
    getCustomerDirectoryMock.mockRejectedValue(new AppError("Something went wrong."));

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
    expect(getCustomerDirectoryMock).toHaveBeenCalledWith({ status: "active" });
  });

  it("passes explicit customerType/status filters through to the service", async () => {
    await GET(request("?customerType=WHOLESALE&status=all"));

    expect(getCustomerDirectoryMock).toHaveBeenCalledWith({ customerType: "WHOLESALE", status: "all" });
  });

  it("returns the workbook buffer with the correct headers on success", async () => {
    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="Customer-Directory.xlsx"');
    expect(Buffer.from(await response.arrayBuffer()).toString()).toBe("fake-xlsx");
    expect(assertPermissionMock).toHaveBeenCalledWith(expect.anything(), "reports", "export");
  });

  describe("format=pdf", () => {
    it("returns a %PDF--prefixed buffer with the correct headers on success", async () => {
      const response = await GET(request("?format=pdf"));

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("application/pdf");
      expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="Customer-Directory.pdf"');
      const buffer = Buffer.from(await response.arrayBuffer());
      expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    });

    it("reuses the exact same toCustomerDirectoryExportTable shaping as the xlsx path — one shaping function, two rendering targets", async () => {
      const sharedTables = [{ sheetName: "Customer Directory", columns: [], rows: [] }];
      toCustomerDirectoryExportTableMock.mockReturnValue(sharedTables);

      await GET(request("?format=pdf"));

      expect(buildReportHtmlMock).toHaveBeenCalledWith(sharedTables);
      expect(exportToExcelBufferMock).not.toHaveBeenCalled();
    });

    it("renders A4 portrait per the reports paper-size convention", async () => {
      await GET(request("?format=pdf"));

      expect(renderHtmlToPdfMock).toHaveBeenCalledWith(expect.any(String), { format: "A4", orientation: "portrait" });
    });

    it("applies the same reports:export permission gate as the xlsx path", async () => {
      assertPermissionMock.mockRejectedValue(new AuthorizationError("You do not have permission to export reports."));

      const response = await GET(request("?format=pdf"));

      expect(response.status).toBe(403);
      expect(getCustomerDirectoryMock).not.toHaveBeenCalled();
      expect(renderHtmlToPdfMock).not.toHaveBeenCalled();
    });

    it("applies the same filter validation as the xlsx path", async () => {
      const response = await GET(request("?customerType=NOT_A_TYPE&format=pdf"));

      expect(response.status).toBe(400);
      expect(getCurrentCompanyUserMock).not.toHaveBeenCalled();
    });

    it("returns a generic 500 and logs an unexpected render failure", async () => {
      renderHtmlToPdfMock.mockRejectedValue(new Error("Chromium launch failed"));

      const response = await GET(request("?format=pdf"));

      expect(response.status).toBe(500);
      expect(errorMock).toHaveBeenCalledTimes(1);
    });

    it("falls back to xlsx for an unrecognized format value instead of erroring", async () => {
      const response = await GET(request("?format=something-unknown"));

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
    });
  });
});
