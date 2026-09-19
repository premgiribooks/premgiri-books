import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BulkImportResolutionCache } from "@/types/bulk-import";

const { findManyActiveBranchMock, createEmployeeMock } = vi.hoisted(() => ({
  findManyActiveBranchMock: vi.fn(),
  createEmployeeMock: vi.fn(),
}));

vi.mock("@/modules/branch/repositories/branch-repository", () => ({
  branchRepository: { findManyActive: findManyActiveBranchMock },
}));
vi.mock("@/modules/employees/services/employee-service", () => ({
  employeeService: { createEmployee: createEmployeeMock },
}));

import { employeeImportTarget } from "./employee-import-target";

const COMPANY_A = "company-a";
const MAIN_BRANCH_ID = "11111111-1111-4111-8111-111111111111";

function mainBranch(overrides: Record<string, unknown> = {}) {
  return {
    id: MAIN_BRANCH_ID,
    companyId: COMPANY_A,
    branchName: "Main Branch",
    branchCode: "BR-MAIN",
    isActive: true,
    ...overrides,
  };
}

function baseRow(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    employeeCode: "EMP-001",
    fullName: "Ramesh Kumar",
    joiningDate: "2024-04-01",
    ...overrides,
  };
}

describe("employeeImportTarget.resolveRow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function cache(): BulkImportResolutionCache {
    return new Map();
  }

  it("resolves an existing Branch by name, case-insensitively", async () => {
    findManyActiveBranchMock.mockResolvedValue([mainBranch()]);

    const result = await employeeImportTarget.resolveRow(baseRow({ branch: "main branch" }), COMPANY_A, cache());

    expect(result.status).toBe("valid");
    if (result.status === "valid") {
      expect(result.input.branchId).toBe(MAIN_BRANCH_ID);
    }
  });

  it("rejects an unresolvable Branch name with a clear error", async () => {
    findManyActiveBranchMock.mockResolvedValue([mainBranch()]);

    const result = await employeeImportTarget.resolveRow(baseRow({ branch: "Unknown Branch" }), COMPANY_A, cache());

    expect(result.status).toBe("invalid");
    if (result.status === "invalid") {
      expect(result.errors[0]).toMatch(/Branch "Unknown Branch" was not found/);
    }
  });

  it("rejects a Joining Date that is not in YYYY-MM-DD format", async () => {
    findManyActiveBranchMock.mockResolvedValue([]);

    const result = await employeeImportTarget.resolveRow(baseRow({ joiningDate: "01/04/2024" }), COMPANY_A, cache());

    expect(result.status).toBe("invalid");
  });

  it("fetches active branches only once per shared cache across many rows", async () => {
    findManyActiveBranchMock.mockResolvedValue([mainBranch()]);
    const sharedCache = cache();

    await employeeImportTarget.resolveRow(baseRow({ branch: "Main Branch" }), COMPANY_A, sharedCache);
    await employeeImportTarget.resolveRow(
      baseRow({ employeeCode: "EMP-002", branch: "Main Branch" }),
      COMPANY_A,
      sharedCache
    );

    expect(findManyActiveBranchMock).toHaveBeenCalledTimes(1);
  });
});

describe("employeeImportTarget.createRow", () => {
  it("is a thin pass-through to employeeService.createEmployee", async () => {
    createEmployeeMock.mockResolvedValue({ id: "emp-1" });
    findManyActiveBranchMock.mockResolvedValue([]);

    const result = await employeeImportTarget.resolveRow(baseRow(), COMPANY_A, new Map());
    expect(result.status).toBe("valid");
    if (result.status !== "valid") return;

    const created = await employeeImportTarget.createRow(result.input);

    expect(createEmployeeMock).toHaveBeenCalledWith(result.input);
    expect(created).toEqual({ id: "emp-1" });
  });
});
