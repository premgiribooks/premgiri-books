import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BulkImportResolutionCache } from "@/types/bulk-import";

const { findManyLedgerGroupMock, createCustomerMock } = vi.hoisted(() => ({
  findManyLedgerGroupMock: vi.fn(),
  createCustomerMock: vi.fn(),
}));

vi.mock("@/modules/ledger-groups/repositories/ledger-group-repository", () => ({
  ledgerGroupRepository: { findMany: findManyLedgerGroupMock },
}));
vi.mock("@/modules/customers/services/customer-service", () => ({
  customerService: { createCustomer: createCustomerMock },
}));

import { customerImportTarget } from "./customer-import-target";

const COMPANY_A = "company-a";
const SUNDRY_DEBTORS_ID = "11111111-1111-4111-8111-111111111111";
const RETAIL_DEBTORS_ID = "22222222-2222-4222-8222-222222222222";
const SUNDRY_CREDITORS_ID = "33333333-3333-4333-8333-333333333333";

function debtorGroup(overrides: Record<string, unknown> = {}) {
  return {
    id: SUNDRY_DEBTORS_ID,
    companyId: COMPANY_A,
    name: "Sundry Debtors",
    parentGroupId: null,
    natureType: "ASSET",
    isActive: true,
    isSystemDefined: true,
    ...overrides,
  };
}

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

function baseRow(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    displayName: "ABC Traders",
    customerType: "RETAIL",
    openingBalance: "0",
    openingBalanceType: "DEBIT",
    ...overrides,
  };
}

describe("customerImportTarget.resolveRow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function cache(): BulkImportResolutionCache {
    return new Map();
  }

  it("auto-selects the sole Sundry Debtors group when the Ledger Group column is left blank", async () => {
    findManyLedgerGroupMock.mockResolvedValue([debtorGroup(), creditorGroup()]);

    const result = await customerImportTarget.resolveRow(baseRow(), COMPANY_A, cache());

    expect(result.status).toBe("valid");
    if (result.status === "valid") {
      expect(result.input.ledgerGroupId).toBe(SUNDRY_DEBTORS_ID);
    }
  });

  it("requires an explicit Ledger Group name when more than one Sundry Debtors group exists", async () => {
    findManyLedgerGroupMock.mockResolvedValue([debtorGroup(), debtorGroup({ id: RETAIL_DEBTORS_ID, name: "Retail Debtors", parentGroupId: SUNDRY_DEBTORS_ID })]);

    const result = await customerImportTarget.resolveRow(baseRow(), COMPANY_A, cache());

    expect(result.status).toBe("invalid");
    if (result.status === "invalid") {
      expect(result.errors[0]).toMatch(/more than one Sundry Debtors group/);
    }
  });

  it("resolves an explicitly named Ledger Group, case-insensitively", async () => {
    findManyLedgerGroupMock.mockResolvedValue([
      debtorGroup(),
      debtorGroup({ id: RETAIL_DEBTORS_ID, name: "Retail Debtors", parentGroupId: SUNDRY_DEBTORS_ID }),
    ]);

    const result = await customerImportTarget.resolveRow(baseRow({ ledgerGroup: "retail debtors" }), COMPANY_A, cache());

    expect(result.status).toBe("valid");
    if (result.status === "valid") {
      expect(result.input.ledgerGroupId).toBe(RETAIL_DEBTORS_ID);
    }
  });

  it("rejects a Ledger Group name outside the Sundry Debtors subtree (e.g. a Sundry Creditors group)", async () => {
    findManyLedgerGroupMock.mockResolvedValue([debtorGroup(), creditorGroup()]);

    const result = await customerImportTarget.resolveRow(baseRow({ ledgerGroup: "Sundry Creditors" }), COMPANY_A, cache());

    expect(result.status).toBe("invalid");
    if (result.status === "invalid") {
      expect(result.errors[0]).toMatch(/was not found under Sundry Debtors/);
    }
  });

  it("fetches ledger groups only once per shared cache across many rows", async () => {
    findManyLedgerGroupMock.mockResolvedValue([debtorGroup()]);
    const sharedCache = cache();

    await customerImportTarget.resolveRow(baseRow(), COMPANY_A, sharedCache);
    await customerImportTarget.resolveRow(baseRow({ displayName: "XYZ Traders" }), COMPANY_A, sharedCache);

    expect(findManyLedgerGroupMock).toHaveBeenCalledTimes(1);
  });

  it("surfaces the target's own schema errors (e.g. an invalid customer type)", async () => {
    findManyLedgerGroupMock.mockResolvedValue([debtorGroup()]);

    const result = await customerImportTarget.resolveRow(baseRow({ customerType: "GOVERNMENT" }), COMPANY_A, cache());

    expect(result.status).toBe("invalid");
  });

  it("rejects a blank Opening Balance rather than silently defaulting it to 0 — the column is required", async () => {
    findManyLedgerGroupMock.mockResolvedValue([debtorGroup()]);

    const result = await customerImportTarget.resolveRow(baseRow({ openingBalance: "" }), COMPANY_A, cache());

    expect(result.status).toBe("invalid");
    if (result.status === "invalid") {
      expect(result.errors).toContain("Opening balance is required.");
    }
  });
});

describe("customerImportTarget.createRow", () => {
  it("is a thin pass-through to customerService.createCustomer", async () => {
    createCustomerMock.mockResolvedValue({ id: "cust-1" });
    findManyLedgerGroupMock.mockResolvedValue([debtorGroup()]);

    const result = await customerImportTarget.resolveRow(baseRow(), COMPANY_A, new Map());
    expect(result.status).toBe("valid");
    if (result.status !== "valid") return;

    const created = await customerImportTarget.createRow(result.input);

    expect(createCustomerMock).toHaveBeenCalledWith(result.input);
    expect(created).toEqual({ id: "cust-1" });
  });
});
