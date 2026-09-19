import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "@/lib/app-error";
import { AuthenticationError, AuthorizationError } from "@/lib/current-user";
import type { TrialBalanceReport } from "@/engines/reporting/types";

import { GET } from "./route";

const { getCurrentCompanyUserMock, assertPermissionMock, getTrialBalanceReportMock, exportToExcelBufferMock, toTrialBalanceExportTableMock, errorMock } =
  vi.hoisted(() => ({
    getCurrentCompanyUserMock: vi.fn(),
    assertPermissionMock: vi.fn(),
    getTrialBalanceReportMock: vi.fn(),
    exportToExcelBufferMock: vi.fn(),
    toTrialBalanceExportTableMock: vi.fn(),
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
vi.mock("@/modules/reports/services/trial-balance-report-service", () => ({
  trialBalanceReportService: { getTrialBalanceReport: getTrialBalanceReportMock },
}));
vi.mock("@/lib/excel-export", () => ({
  exportToExcelBuffer: exportToExcelBufferMock,
}));
vi.mock("@/engines/reporting/trial-balance", () => ({
  toTrialBalanceExportTable: toTrialBalanceExportTableMock,
}));
vi.mock("@/lib/logger", () => ({
  logger: { error: errorMock },
}));

function request(query: string): Request {
  return new Request(`http://localhost/reports/trial-balance/export${query}`);
}

const VALID_QUERY = "?financialYearId=11111111-1111-4111-8111-111111111111&asOfDate=2027-03-31";

describe("GET /reports/trial-balance/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentCompanyUserMock.mockResolvedValue({ id: "user-1", companyId: "company-1", role: "Accountant" });
    assertPermissionMock.mockResolvedValue(undefined);
    getTrialBalanceReportMock.mockResolvedValue({ sections: [], totalDebit: 0, totalCredit: 0 } as TrialBalanceReport);
    toTrialBalanceExportTableMock.mockReturnValue([{ sheetName: "Trial Balance", columns: [], rows: [] }]);
    exportToExcelBufferMock.mockResolvedValue(Buffer.from("fake-xlsx"));
  });

  it("returns 400 for a missing/invalid financialYearId or asOfDate — never reaching the service", async () => {
    const response = await GET(request("?financialYearId=not-a-uuid&asOfDate=2027-03-31"));

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
    expect(getTrialBalanceReportMock).not.toHaveBeenCalled();
  });

  it("maps a plain AppError (e.g. an invalid financial year) to 400", async () => {
    getTrialBalanceReportMock.mockRejectedValue(new AppError("Financial year not found."));

    const response = await GET(request(VALID_QUERY));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Financial year not found." });
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
    expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="Trial-Balance-2027-03-31.xlsx"');
    expect(Buffer.from(await response.arrayBuffer()).toString()).toBe("fake-xlsx");
    expect(assertPermissionMock).toHaveBeenCalledWith(expect.anything(), "reports", "export");
  });
});
