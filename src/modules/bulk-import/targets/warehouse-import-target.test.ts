import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BulkImportResolutionCache } from "@/types/bulk-import";

const { findManyActiveBranchMock, createWarehouseMock } = vi.hoisted(() => ({
  findManyActiveBranchMock: vi.fn(),
  createWarehouseMock: vi.fn(),
}));

vi.mock("@/modules/branch/repositories/branch-repository", () => ({
  branchRepository: { findManyActive: findManyActiveBranchMock },
}));
vi.mock("@/modules/warehouses/services/warehouse-service", () => ({
  warehouseService: { createWarehouse: createWarehouseMock },
}));

import { warehouseImportTarget } from "./warehouse-import-target";

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
    name: "Main Warehouse",
    code: "WH-MAIN",
    ...overrides,
  };
}

describe("warehouseImportTarget.resolveRow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function cache(): BulkImportResolutionCache {
    return new Map();
  }

  it("resolves an existing Branch by name, case-insensitively", async () => {
    findManyActiveBranchMock.mockResolvedValue([mainBranch()]);

    const result = await warehouseImportTarget.resolveRow(baseRow({ branch: "main branch" }), COMPANY_A, cache());

    expect(result.status).toBe("valid");
    if (result.status === "valid") {
      expect(result.input.branchId).toBe(MAIN_BRANCH_ID);
    }
  });

  it("rejects an unresolvable Branch name with a clear error", async () => {
    findManyActiveBranchMock.mockResolvedValue([mainBranch()]);

    const result = await warehouseImportTarget.resolveRow(baseRow({ branch: "Unknown Branch" }), COMPANY_A, cache());

    expect(result.status).toBe("invalid");
    if (result.status === "invalid") {
      expect(result.errors[0]).toMatch(/Branch "Unknown Branch" was not found/);
    }
  });

  it("leaves branchId undefined when the column is left blank", async () => {
    findManyActiveBranchMock.mockResolvedValue([mainBranch()]);

    const result = await warehouseImportTarget.resolveRow(baseRow(), COMPANY_A, cache());

    expect(result.status).toBe("valid");
    if (result.status === "valid") {
      expect(result.input.branchId).toBeUndefined();
    }
  });

  it("fetches active branches only once per shared cache across many rows", async () => {
    findManyActiveBranchMock.mockResolvedValue([mainBranch()]);
    const sharedCache = cache();

    await warehouseImportTarget.resolveRow(baseRow({ branch: "Main Branch" }), COMPANY_A, sharedCache);
    await warehouseImportTarget.resolveRow(
      baseRow({ name: "Secondary Warehouse", code: "WH-2", branch: "Main Branch" }),
      COMPANY_A,
      sharedCache
    );

    expect(findManyActiveBranchMock).toHaveBeenCalledTimes(1);
  });

  it("surfaces the target's own schema errors (e.g. a code that is too short)", async () => {
    findManyActiveBranchMock.mockResolvedValue([]);

    const result = await warehouseImportTarget.resolveRow(baseRow({ code: "W" }), COMPANY_A, cache());

    expect(result.status).toBe("invalid");
  });
});

describe("warehouseImportTarget.createRow", () => {
  it("is a thin pass-through to warehouseService.createWarehouse", async () => {
    createWarehouseMock.mockResolvedValue({ id: "wh-1" });
    findManyActiveBranchMock.mockResolvedValue([]);

    const result = await warehouseImportTarget.resolveRow(baseRow(), COMPANY_A, new Map());
    expect(result.status).toBe("valid");
    if (result.status !== "valid") return;

    const created = await warehouseImportTarget.createRow(result.input);

    expect(createWarehouseMock).toHaveBeenCalledWith(result.input);
    expect(created).toEqual({ id: "wh-1" });
  });
});
