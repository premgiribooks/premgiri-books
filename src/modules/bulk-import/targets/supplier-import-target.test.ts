import { beforeEach, describe, expect, it, vi } from "vitest";

const { findManyLedgerGroupMock, createSupplierMock } = vi.hoisted(() => ({
  findManyLedgerGroupMock: vi.fn(),
  createSupplierMock: vi.fn(),
}));

vi.mock("@/modules/ledger-groups/repositories/ledger-group-repository", () => ({
  ledgerGroupRepository: { findMany: findManyLedgerGroupMock },
}));
vi.mock("@/modules/suppliers/services/supplier-service", () => ({
  supplierService: { createSupplier: createSupplierMock },
}));

import { supplierImportTarget } from "./supplier-import-target";

const COMPANY_A = "company-a";
const SUNDRY_CREDITORS_ID = "11111111-1111-4111-8111-111111111111";
const SUNDRY_DEBTORS_ID = "22222222-2222-4222-8222-222222222222";

function creditorGroup() {
  return {
    id: SUNDRY_CREDITORS_ID,
    companyId: COMPANY_A,
    name: "Sundry Creditors",
    parentGroupId: null,
    natureType: "LIABILITY",
    isActive: true,
    isSystemDefined: true,
  };
}

function debtorGroup() {
  return {
    id: SUNDRY_DEBTORS_ID,
    companyId: COMPANY_A,
    name: "Sundry Debtors",
    parentGroupId: null,
    natureType: "ASSET",
    isActive: true,
    isSystemDefined: true,
  };
}

function baseRow(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    displayName: "XYZ Distributors",
    openingBalance: "0",
    openingBalanceType: "CREDIT",
    ...overrides,
  };
}

describe("supplierImportTarget.resolveRow", () => {
  beforeEach(() => vi.clearAllMocks());

  it("auto-selects the sole Sundry Creditors group when the Ledger Group column is left blank", async () => {
    findManyLedgerGroupMock.mockResolvedValue([creditorGroup(), debtorGroup()]);

    const result = await supplierImportTarget.resolveRow(baseRow(), COMPANY_A, new Map());

    expect(result.status).toBe("valid");
    if (result.status === "valid") {
      expect(result.input.ledgerGroupId).toBe(SUNDRY_CREDITORS_ID);
    }
  });

  it("rejects a Ledger Group name outside the Sundry Creditors subtree (e.g. a Sundry Debtors group)", async () => {
    findManyLedgerGroupMock.mockResolvedValue([creditorGroup(), debtorGroup()]);

    const result = await supplierImportTarget.resolveRow(baseRow({ ledgerGroup: "Sundry Debtors" }), COMPANY_A, new Map());

    expect(result.status).toBe("invalid");
    if (result.status === "invalid") {
      expect(result.errors[0]).toMatch(/was not found under Sundry Creditors/);
    }
  });

  it("surfaces the target's own schema errors (e.g. a negative opening balance)", async () => {
    findManyLedgerGroupMock.mockResolvedValue([creditorGroup()]);

    const result = await supplierImportTarget.resolveRow(baseRow({ openingBalance: "-5" }), COMPANY_A, new Map());

    expect(result.status).toBe("invalid");
  });

  it("rejects a blank Opening Balance rather than silently defaulting it to 0 — the column is required", async () => {
    findManyLedgerGroupMock.mockResolvedValue([creditorGroup()]);

    const result = await supplierImportTarget.resolveRow(baseRow({ openingBalance: "" }), COMPANY_A, new Map());

    expect(result.status).toBe("invalid");
    if (result.status === "invalid") {
      expect(result.errors).toContain("Opening balance is required.");
    }
  });
});

describe("supplierImportTarget.createRow", () => {
  it("is a thin pass-through to supplierService.createSupplier", async () => {
    createSupplierMock.mockResolvedValue({ id: "sup-1" });
    findManyLedgerGroupMock.mockResolvedValue([creditorGroup()]);

    const result = await supplierImportTarget.resolveRow(baseRow(), COMPANY_A, new Map());
    expect(result.status).toBe("valid");
    if (result.status !== "valid") return;

    const created = await supplierImportTarget.createRow(result.input);

    expect(createSupplierMock).toHaveBeenCalledWith(result.input);
    expect(created).toEqual({ id: "sup-1" });
  });
});
