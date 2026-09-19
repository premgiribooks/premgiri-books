import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "@/lib/app-error";
import { AuthenticationError, AuthorizationError } from "@/lib/current-user";

const { getCurrentCompanyUserMock, assertPermissionMock, getImportTargetMock, buildImportTemplateMock, errorMock } = vi.hoisted(
  () => ({
    getCurrentCompanyUserMock: vi.fn(),
    assertPermissionMock: vi.fn(),
    getImportTargetMock: vi.fn(),
    buildImportTemplateMock: vi.fn(),
    errorMock: vi.fn(),
  })
);

vi.mock("@/lib/current-user", () => ({
  AuthenticationError: class AuthenticationError extends Error {},
  AuthorizationError: class AuthorizationError extends Error {},
  getCurrentCompanyUser: getCurrentCompanyUserMock,
}));
vi.mock("@/lib/permissions", () => ({
  assertPermission: assertPermissionMock,
}));
vi.mock("@/modules/bulk-import/services/bulk-import-service", () => ({
  bulkImportService: { getImportTarget: getImportTargetMock, buildImportTemplate: buildImportTemplateMock },
}));
vi.mock("@/lib/logger", () => ({
  logger: { error: errorMock },
}));

import { GET } from "./route";

function request(query: string): Request {
  return new Request(`http://localhost/api/bulk-import/template${query}`);
}

describe("GET /api/bulk-import/template", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentCompanyUserMock.mockResolvedValue({ id: "user-1", companyId: "company-1" });
    assertPermissionMock.mockResolvedValue(undefined);
    getImportTargetMock.mockReturnValue({ key: "products", label: "Products", columns: [] });
    buildImportTemplateMock.mockResolvedValue(Buffer.from("fake-xlsx"));
  });

  it("returns 400 for a missing/invalid target", async () => {
    const response = await GET(request("?target=not-a-real-target"));

    expect(response.status).toBe(400);
    expect(getCurrentCompanyUserMock).not.toHaveBeenCalled();
  });

  it("maps AuthenticationError to 401", async () => {
    getCurrentCompanyUserMock.mockRejectedValue(new AuthenticationError());

    const response = await GET(request("?target=products"));

    expect(response.status).toBe(401);
  });

  it("maps AuthorizationError (missing masters:view) to 403", async () => {
    assertPermissionMock.mockRejectedValue(new AuthorizationError("You do not have permission to view masters."));

    const response = await GET(request("?target=products"));

    expect(response.status).toBe(403);
    expect(buildImportTemplateMock).not.toHaveBeenCalled();
  });

  it("maps a plain AppError to 400", async () => {
    buildImportTemplateMock.mockRejectedValue(new AppError("Something is wrong."));

    const response = await GET(request("?target=products"));

    expect(response.status).toBe(400);
  });

  it("returns a generic 500 and logs an unexpected failure", async () => {
    buildImportTemplateMock.mockRejectedValue(new Error("boom"));

    const response = await GET(request("?target=products"));

    expect(response.status).toBe(500);
    expect(errorMock).toHaveBeenCalledTimes(1);
  });

  it("returns the template buffer with the correct headers on success", async () => {
    const response = await GET(request("?target=products"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="Products-import-template.xlsx"');
    expect(Buffer.from(await response.arrayBuffer()).toString()).toBe("fake-xlsx");
    expect(assertPermissionMock).toHaveBeenCalledWith(expect.anything(), "masters", "view");
  });

  it("gates the employees target on employees:view, not masters:view — TARGET_PERMISSION_MODULE's one deliberate divergence", async () => {
    getImportTargetMock.mockReturnValue({ key: "employees", label: "Employees", columns: [] });

    const response = await GET(request("?target=employees"));

    expect(response.status).toBe(200);
    expect(assertPermissionMock).toHaveBeenCalledWith(expect.anything(), "employees", "view");
  });
});
