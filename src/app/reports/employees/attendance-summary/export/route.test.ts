import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "@/lib/app-error";
import { AuthenticationError, AuthorizationError } from "@/lib/current-user";
import type { AttendanceSummaryReport } from "@/types/employee-report";

import { GET } from "./route";

const {
  getCurrentCompanyUserMock,
  assertPermissionMock,
  getAttendanceSummaryReportMock,
  exportToExcelBufferMock,
  toAttendanceSummaryExportTableMock,
  errorMock,
} = vi.hoisted(() => ({
  getCurrentCompanyUserMock: vi.fn(),
  assertPermissionMock: vi.fn(),
  getAttendanceSummaryReportMock: vi.fn(),
  exportToExcelBufferMock: vi.fn(),
  toAttendanceSummaryExportTableMock: vi.fn(),
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
vi.mock("@/modules/reports/employees/services/employee-report-service", () => ({
  employeeReportService: { getAttendanceSummaryReport: getAttendanceSummaryReportMock },
}));
vi.mock("@/lib/excel-export", () => ({
  exportToExcelBuffer: exportToExcelBufferMock,
}));
vi.mock("@/engines/reporting/employee-reports", () => ({
  toAttendanceSummaryExportTable: toAttendanceSummaryExportTableMock,
}));
vi.mock("@/lib/logger", () => ({
  logger: { error: errorMock },
}));

function request(query: string): Request {
  return new Request(`http://localhost/reports/employees/attendance-summary/export${query}`);
}

const VALID_QUERY = "?periodStart=2026-01-01&periodEnd=2026-01-31";

describe("GET /reports/employees/attendance-summary/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentCompanyUserMock.mockResolvedValue({ id: "user-1", companyId: "company-1", role: "Accountant" });
    assertPermissionMock.mockResolvedValue(undefined);
    getAttendanceSummaryReportMock.mockResolvedValue({
      periodStart: "2026-01-01",
      periodEnd: "2026-01-31",
      rows: [],
    } as AttendanceSummaryReport);
    toAttendanceSummaryExportTableMock.mockReturnValue([{ sheetName: "Attendance Summary", columns: [], rows: [] }]);
    exportToExcelBufferMock.mockResolvedValue(Buffer.from("fake-xlsx"));
  });

  it("returns 400 for a missing/invalid period — never reaching the service", async () => {
    const response = await GET(request("?periodStart=not-a-date&periodEnd=2026-01-31"));

    expect(response.status).toBe(400);
    expect(getCurrentCompanyUserMock).not.toHaveBeenCalled();
  });

  it("returns 400 when periodEnd is before periodStart", async () => {
    const response = await GET(request("?periodStart=2026-01-31&periodEnd=2026-01-01"));

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
    expect(getAttendanceSummaryReportMock).not.toHaveBeenCalled();
  });

  it("maps a plain AppError to 400", async () => {
    getAttendanceSummaryReportMock.mockRejectedValue(new AppError("Something went wrong."));

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

  it("passes explicit employeeId/branchId filters through to the service", async () => {
    await GET(
      request(
        "?periodStart=2026-01-01&periodEnd=2026-01-31&employeeId=11111111-1111-4111-8111-111111111111&branchId=22222222-2222-4222-8222-222222222222"
      )
    );

    expect(getAttendanceSummaryReportMock).toHaveBeenCalledWith({
      periodStart: "2026-01-01",
      periodEnd: "2026-01-31",
      employeeId: "11111111-1111-4111-8111-111111111111",
      branchId: "22222222-2222-4222-8222-222222222222",
    });
  });

  it("returns the workbook buffer with the correct headers on success", async () => {
    const response = await GET(request(VALID_QUERY));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="Attendance-Summary-2026-01-01_to_2026-01-31.xlsx"'
    );
    expect(Buffer.from(await response.arrayBuffer()).toString()).toBe("fake-xlsx");
    expect(assertPermissionMock).toHaveBeenCalledWith(expect.anything(), "reports", "export");
  });
});
