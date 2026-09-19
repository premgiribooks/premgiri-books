import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "@/lib/app-error";
import { AuthorizationError } from "@/lib/current-user";
import type { ImportReport } from "@/types/bulk-import";

const {
  getCurrentCompanyUserMock,
  assertPermissionMock,
  getImportTargetMock,
  parseImportFileMock,
  previewImportMock,
  commitImportMock,
  buildImportErrorReportMock,
} = vi.hoisted(() => ({
  getCurrentCompanyUserMock: vi.fn(),
  assertPermissionMock: vi.fn(),
  getImportTargetMock: vi.fn(),
  parseImportFileMock: vi.fn(),
  previewImportMock: vi.fn(),
  commitImportMock: vi.fn(),
  buildImportErrorReportMock: vi.fn(),
}));

vi.mock("@/lib/current-user", () => ({
  AuthenticationError: class AuthenticationError extends Error {},
  AuthorizationError: class AuthorizationError extends Error {},
  getCurrentCompanyUser: getCurrentCompanyUserMock,
}));
vi.mock("@/lib/permissions", () => ({
  assertPermission: assertPermissionMock,
}));
vi.mock("@/modules/bulk-import/services/bulk-import-service", () => ({
  bulkImportService: {
    getImportTarget: getImportTargetMock,
    parseImportFile: parseImportFileMock,
    previewImport: previewImportMock,
    commitImport: commitImportMock,
    buildImportErrorReport: buildImportErrorReportMock,
  },
}));

import { commitImportAction, downloadErrorReportAction, uploadAndPreviewAction } from "./bulk-import-actions";

const FAKE_TARGET = { key: "products", label: "Products", columns: [{ key: "name", header: "Name", required: true, example: "" }] };

function fileFormData(overrides: { target?: string; file?: File | null } = {}): FormData {
  const formData = new FormData();
  formData.set("target", overrides.target ?? "products");
  if (overrides.file !== null) {
    formData.set("file", overrides.file ?? new File(["a,b\n1,2"], "products.csv", { type: "text/csv" }));
  }
  return formData;
}

describe("uploadAndPreviewAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentCompanyUserMock.mockResolvedValue({ id: "user-1", companyId: "company-1", role: "Administrator" });
    assertPermissionMock.mockResolvedValue(undefined);
    getImportTargetMock.mockReturnValue(FAKE_TARGET);
    parseImportFileMock.mockResolvedValue([{ rowNumber: 2, row: { name: "Alpha" } }]);
    previewImportMock.mockResolvedValue({ validCount: 1, invalidCount: 0, rows: [] });
  });

  it("rejects an unauthorized user before ever parsing the file", async () => {
    assertPermissionMock.mockRejectedValue(new AuthorizationError("You do not have permission to create masters."));

    const result = await uploadAndPreviewAction(fileFormData());

    expect(result.success).toBe(false);
    expect(parseImportFileMock).not.toHaveBeenCalled();
  });

  it("rejects a request with no file attached", async () => {
    const result = await uploadAndPreviewAction(fileFormData({ file: null }));

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/select a file/i);
  });

  it("rejects a disallowed file extension (e.g. .pdf)", async () => {
    const result = await uploadAndPreviewAction(
      fileFormData({ file: new File(["x"], "products.pdf", { type: "application/pdf" }) })
    );

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/\.xlsx or \.csv/);
    expect(parseImportFileMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid target", async () => {
    const result = await uploadAndPreviewAction(fileFormData({ target: "not-a-real-target" }));

    expect(result.success).toBe(false);
  });

  it("rejects a file larger than the configured size cap, before ever parsing it", async () => {
    const oversized = new File([new Uint8Array(6 * 1024 * 1024)], "products.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const result = await uploadAndPreviewAction(fileFormData({ file: oversized }));

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/larger than/i);
    expect(parseImportFileMock).not.toHaveBeenCalled();
  });

  it("parses and previews a valid upload, returning the target's own columns alongside the preview", async () => {
    const result = await uploadAndPreviewAction(fileFormData());

    expect(result.success).toBe(true);
    expect(result.data?.columns).toBe(FAKE_TARGET.columns);
    expect(result.data?.preview).toEqual({ validCount: 1, invalidCount: 0, rows: [] });
    expect(previewImportMock).toHaveBeenCalledWith(FAKE_TARGET, [{ rowNumber: 2, row: { name: "Alpha" } }], "company-1");
  });

  it("gates the employees target on employees:create, not masters:create — TARGET_PERMISSION_MODULE's one deliberate divergence", async () => {
    const result = await uploadAndPreviewAction(fileFormData({ target: "employees" }));

    expect(result.success).toBe(true);
    expect(assertPermissionMock).toHaveBeenCalledWith(expect.anything(), "employees", "create");
  });
});

describe("commitImportAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentCompanyUserMock.mockResolvedValue({ id: "user-1", companyId: "company-1", role: "Administrator" });
    assertPermissionMock.mockResolvedValue(undefined);
    getImportTargetMock.mockReturnValue(FAKE_TARGET);
  });

  it("rejects an unauthorized user before ever calling commitImport", async () => {
    assertPermissionMock.mockRejectedValue(new AuthorizationError("You do not have permission to create masters."));

    const result = await commitImportAction("products", [{ rowNumber: 2, row: { name: "Alpha" } }]);

    expect(result.success).toBe(false);
    expect(commitImportMock).not.toHaveBeenCalled();
  });

  it("commits the given rows and returns the report", async () => {
    const report: ImportReport = { createdCount: 1, failedCount: 0, rows: [] };
    commitImportMock.mockResolvedValue(report);

    const result = await commitImportAction("products", [{ rowNumber: 2, row: { name: "Alpha" } }]);

    expect(result).toEqual({ success: true, data: report });
    expect(commitImportMock).toHaveBeenCalledWith(FAKE_TARGET, [{ rowNumber: 2, row: { name: "Alpha" } }], "company-1");
  });

  it("rejects a rows array beyond the 1,000-row cap before ever calling commitImport — a Server Action argument is reachable independently of the upload/preview step", async () => {
    const rows = Array.from({ length: 1001 }, (_, i) => ({ rowNumber: i + 2, row: { name: `Row${i}` } }));

    const result = await commitImportAction("products", rows);

    expect(result.success).toBe(false);
    expect(commitImportMock).not.toHaveBeenCalled();
  });

  it("rejects a malformed row shape (e.g. a non-string cell value) rather than letting it reach resolveRow unvalidated", async () => {
    const malformedRows = [{ rowNumber: 2, row: { name: 12345 } }] as unknown as Parameters<typeof commitImportAction>[1];

    const result = await commitImportAction("products", malformedRows);

    expect(result.success).toBe(false);
    expect(commitImportMock).not.toHaveBeenCalled();
  });

  it("propagates an unexpected commitImport failure as a generic action error", async () => {
    commitImportMock.mockRejectedValue(new AppError("Something went wrong."));

    const result = await commitImportAction("products", []);

    expect(result.success).toBe(false);
  });

  it("gates the employees target on employees:create, not masters:create — TARGET_PERMISSION_MODULE's one deliberate divergence", async () => {
    commitImportMock.mockResolvedValue({ createdCount: 0, failedCount: 0, rows: [] });

    const result = await commitImportAction("employees", []);

    expect(result.success).toBe(true);
    expect(assertPermissionMock).toHaveBeenCalledWith(expect.anything(), "employees", "create");
  });
});

describe("downloadErrorReportAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentCompanyUserMock.mockResolvedValue({ id: "user-1", companyId: "company-1", role: "Administrator" });
    assertPermissionMock.mockResolvedValue(undefined);
    getImportTargetMock.mockReturnValue(FAKE_TARGET);
  });

  it("rejects an unauthorized user", async () => {
    assertPermissionMock.mockRejectedValue(new AuthorizationError("nope"));

    const result = await downloadErrorReportAction("products", { createdCount: 0, failedCount: 1, rows: [] });

    expect(result.success).toBe(false);
    expect(buildImportErrorReportMock).not.toHaveBeenCalled();
  });

  it("returns a base64-encoded workbook and a filename derived from the target's label", async () => {
    buildImportErrorReportMock.mockResolvedValue(Buffer.from("fake-xlsx"));

    const result = await downloadErrorReportAction("products", { createdCount: 0, failedCount: 1, rows: [] });

    expect(result.success).toBe(true);
    expect(result.data?.filename).toBe("Products-import-errors.xlsx");
    expect(Buffer.from(result.data?.base64 ?? "", "base64").toString()).toBe("fake-xlsx");
  });

  it("gates the employees target on employees:create, not masters:create — TARGET_PERMISSION_MODULE's one deliberate divergence", async () => {
    getImportTargetMock.mockReturnValue({ key: "employees", label: "Employees", columns: [] });
    buildImportErrorReportMock.mockResolvedValue(Buffer.from("fake-xlsx"));

    const result = await downloadErrorReportAction("employees", { createdCount: 0, failedCount: 1, rows: [] });

    expect(result.success).toBe(true);
    expect(assertPermissionMock).toHaveBeenCalledWith(expect.anything(), "employees", "create");
  });
});
