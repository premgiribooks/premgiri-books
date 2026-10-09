import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "@/lib/app-error";
import { AuthenticationError, AuthorizationError } from "@/lib/current-user";

import { GET } from "./route";

const { getCurrentCompanyUserMock, assertPermissionMock, getOfflineExportMock, buildWorkbookMock, errorMock, infoMock } = vi.hoisted(() => ({
  getCurrentCompanyUserMock: vi.fn(),
  assertPermissionMock: vi.fn(),
  getOfflineExportMock: vi.fn(),
  buildWorkbookMock: vi.fn(),
  errorMock: vi.fn(),
  infoMock: vi.fn(),
}));

vi.mock("@/lib/current-user", () => ({
  AuthenticationError: class AuthenticationError extends Error {},
  AuthorizationError: class AuthorizationError extends Error {},
  getCurrentCompanyUser: getCurrentCompanyUserMock,
}));
vi.mock("@/lib/permissions", () => ({ assertPermission: assertPermissionMock }));
vi.mock("@/modules/gst/services/gstr1-offline-export-service", () => ({
  gstr1OfflineExportService: { getOfflineExport: getOfflineExportMock },
}));
vi.mock("@/engines/gst/gstr1-offline/build-gstr1-workbook", () => ({ buildGstr1OfflineWorkbook: buildWorkbookMock }));
vi.mock("@/lib/logger", () => ({ logger: { error: errorMock, info: infoMock } }));

const OFFLINE_DATA = { b2cs: [], hsnB2c: [], docs: [] };

function request(query: string): Request {
  return new Request(`http://localhost/gst/gstr-1/export${query}`);
}

beforeEach(() => {
  getCurrentCompanyUserMock.mockReset().mockResolvedValue({ id: "u1", companyId: "c1" });
  assertPermissionMock.mockReset().mockResolvedValue(undefined);
  getOfflineExportMock.mockReset().mockResolvedValue(OFFLINE_DATA);
  buildWorkbookMock.mockReset().mockResolvedValue(Buffer.from("xlsx-bytes"));
  errorMock.mockReset();
  infoMock.mockReset();
});

describe("GET /gst/gstr-1/export", () => {
  it("returns the workbook as an xlsx attachment named for the period", async () => {
    const response = await GET(request("?from=2026-04-01&to=2026-04-30"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="GSTR1-portal-import-2026-04-01_to_2026-04-30.xlsx"');
    expect(Buffer.from(await response.arrayBuffer()).toString()).toBe("xlsx-bytes");
  });

  it("marks the download no-store so shared caches never keep tax data", async () => {
    const response = await GET(request("?from=2026-04-01&to=2026-04-30"));

    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("checks the session before validating input, so an anonymous caller always gets 401", async () => {
    getCurrentCompanyUserMock.mockRejectedValue(new AuthenticationError("Sign in required"));

    const response = await GET(request("?from=garbage&to=garbage"));

    expect(response.status).toBe(401);
  });

  it("requires reports/export and hands the service UTC-midnight dates", async () => {
    await GET(request("?from=2026-04-01&to=2026-04-30"));

    expect(assertPermissionMock).toHaveBeenCalledWith(expect.objectContaining({ companyId: "c1" }), "reports", "export");
    expect(getOfflineExportMock).toHaveBeenCalledWith({
      from: new Date("2026-04-01T00:00:00.000Z"),
      to: new Date("2026-04-30T00:00:00.000Z"),
    });
    expect(buildWorkbookMock).toHaveBeenCalledWith(OFFLINE_DATA);
  });

  it("returns 400 for a missing or invalid date range without reading any data", async () => {
    const missing = await GET(request(""));
    const reversed = await GET(request("?from=2026-04-30&to=2026-04-01"));
    const impossible = await GET(request("?from=2026-02-31&to=2026-03-01"));

    expect([missing.status, reversed.status, impossible.status]).toEqual([400, 400, 400]);
    expect(getOfflineExportMock).not.toHaveBeenCalled();
  });

  it("returns 401 when the user is not authenticated", async () => {
    getCurrentCompanyUserMock.mockRejectedValue(new AuthenticationError("Sign in required"));

    const response = await GET(request("?from=2026-04-01&to=2026-04-30"));

    expect(response.status).toBe(401);
    expect(getOfflineExportMock).not.toHaveBeenCalled();
  });

  it("returns 403 when the user lacks reports/export", async () => {
    assertPermissionMock.mockRejectedValue(new AuthorizationError("Not allowed"));

    const response = await GET(request("?from=2026-04-01&to=2026-04-30"));

    expect(response.status).toBe(403);
    expect(getOfflineExportMock).not.toHaveBeenCalled();
  });

  it("returns an AppError's message as a 400 so the screen can show it", async () => {
    getOfflineExportMock.mockRejectedValue(new AppError("2 draft sales invoice(s) are dated in this period."));

    const response = await GET(request("?from=2026-04-01&to=2026-04-30"));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "2 draft sales invoice(s) are dated in this period." });
  });

  it("hides an unexpected error behind a generic 500 and logs it", async () => {
    getOfflineExportMock.mockRejectedValue(new Error("connection string leaked"));

    const response = await GET(request("?from=2026-04-01&to=2026-04-30"));

    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("connection string");
    expect(errorMock).toHaveBeenCalled();
  });
});
