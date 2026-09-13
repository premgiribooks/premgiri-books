import { describe, expect, it, vi, beforeEach } from "vitest";

// vi.mock's factory is hoisted above this module's own top-level code, so
// the mocks it closes over must come from vi.hoisted() — mirrors
// price-list-repository.test.ts's identical convention. runInTransaction
// calls prisma.$transaction(fn), so the mock just invokes the callback with
// a fake transaction client exposing the same sub-mocks.
const {
  findManyMock,
  txFindUniqueMock,
  txUpdateMock,
  txCreateManyMock,
} = vi.hoisted(() => {
  return {
    findManyMock: vi.fn(),
    txFindUniqueMock: vi.fn(),
    txUpdateMock: vi.fn(),
    txCreateManyMock: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    paymentMode: { findMany: (...args: unknown[]) => findManyMock(...args) },
    $transaction: (fn: (tx: unknown) => unknown) =>
      fn({
        paymentMode: {
          findUnique: (...args: unknown[]) => txFindUniqueMock(...args),
          update: (...args: unknown[]) => txUpdateMock(...args),
        },
      }),
  },
}));

import { paymentModeRepository } from "@/modules/payment-modes/repositories/payment-mode-repository";

const COMPANY_ID = "company-1";
const OTHER_COMPANY_ID = "company-2";

const EXISTING_ROW = {
  id: "mode-1",
  companyId: COMPANY_ID,
  name: "Cash",
  ledgerClass: "CASH",
  isSystemDefined: true,
  isActive: true,
};

function resetMocks() {
  findManyMock.mockReset();
  txFindUniqueMock.mockReset();
  txUpdateMock.mockReset();
  txCreateManyMock.mockReset();
}

describe("paymentModeRepository.update — cross-company isolation", () => {
  beforeEach(resetMocks);

  it("returns null when the payment mode belongs to a different company", async () => {
    txFindUniqueMock.mockResolvedValueOnce({ ...EXISTING_ROW, companyId: OTHER_COMPANY_ID });

    const result = await paymentModeRepository.update("mode-1", COMPANY_ID, {
      name: "Cash",
      ledgerClass: "CASH",
    });

    expect(result).toBeNull();
    expect(txUpdateMock).not.toHaveBeenCalled();
  });

  it("returns null when the payment mode does not exist", async () => {
    txFindUniqueMock.mockResolvedValueOnce(null);

    const result = await paymentModeRepository.update("missing", COMPANY_ID, {
      name: "Cash",
      ledgerClass: "CASH",
    });

    expect(result).toBeNull();
  });

  it("updates name/ledgerClass on a same-company row, including a seeded (isSystemDefined) one", async () => {
    txFindUniqueMock.mockResolvedValueOnce(EXISTING_ROW);
    txUpdateMock.mockResolvedValueOnce({ ...EXISTING_ROW, name: "Petty Cash", ledgerClass: "ANY" });

    const result = await paymentModeRepository.update("mode-1", COMPANY_ID, {
      name: "Petty Cash",
      ledgerClass: "ANY",
    });

    expect(result).toEqual({ ...EXISTING_ROW, name: "Petty Cash", ledgerClass: "ANY" });
    expect(txUpdateMock).toHaveBeenCalledWith({
      where: { id: "mode-1" },
      data: { name: "Petty Cash", ledgerClass: "ANY" },
    });
  });
});

describe("paymentModeRepository.activate / deactivate", () => {
  beforeEach(resetMocks);

  it("activate returns not_found for a cross-company row", async () => {
    txFindUniqueMock.mockResolvedValueOnce({ ...EXISTING_ROW, companyId: OTHER_COMPANY_ID });

    const result = await paymentModeRepository.activate("mode-1", COMPANY_ID);

    expect(result).toEqual({ status: "not_found" });
    expect(txUpdateMock).not.toHaveBeenCalled();
  });

  it("deactivate returns not_found for a cross-company row", async () => {
    txFindUniqueMock.mockResolvedValueOnce({ ...EXISTING_ROW, companyId: OTHER_COMPANY_ID });

    const result = await paymentModeRepository.deactivate("mode-1", COMPANY_ID);

    expect(result).toEqual({ status: "not_found" });
    expect(txUpdateMock).not.toHaveBeenCalled();
  });

  // Activate/Deactivate toggle isActive only — never any other field
  // (86-payment-mode-master.md's Business Rules).
  it("activate flips only isActive to true, touching no other field", async () => {
    txFindUniqueMock.mockResolvedValueOnce({ ...EXISTING_ROW, isActive: false });
    txUpdateMock.mockResolvedValueOnce({ ...EXISTING_ROW, isActive: true });

    const result = await paymentModeRepository.activate("mode-1", COMPANY_ID);

    expect(result).toEqual({ status: "ok", paymentMode: { ...EXISTING_ROW, isActive: true } });
    expect(txUpdateMock).toHaveBeenCalledWith({
      where: { id: "mode-1" },
      data: { isActive: true },
    });
  });

  it("deactivate flips only isActive to false, touching no other field", async () => {
    txFindUniqueMock.mockResolvedValueOnce(EXISTING_ROW);
    txUpdateMock.mockResolvedValueOnce({ ...EXISTING_ROW, isActive: false });

    const result = await paymentModeRepository.deactivate("mode-1", COMPANY_ID);

    expect(result).toEqual({ status: "ok", paymentMode: { ...EXISTING_ROW, isActive: false } });
    expect(txUpdateMock).toHaveBeenCalledWith({
      where: { id: "mode-1" },
      data: { isActive: false },
    });
  });
});

// No permanent delete path exists anywhere on the repository — Activate/
// Deactivate only (86-payment-mode-master.md's Business Rules).
describe("paymentModeRepository — no delete method", () => {
  it("exposes no delete/remove method", () => {
    expect((paymentModeRepository as Record<string, unknown>).delete).toBeUndefined();
    expect((paymentModeRepository as Record<string, unknown>).remove).toBeUndefined();
  });
});

describe("paymentModeRepository.findMany", () => {
  beforeEach(resetMocks);

  it("scopes the query to the given company", async () => {
    findManyMock.mockResolvedValueOnce([]);

    await paymentModeRepository.findMany(COMPANY_ID);

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: COMPANY_ID } })
    );
  });
});

describe("paymentModeRepository.seedDefaults", () => {
  beforeEach(resetMocks);

  it("seeds exactly the five defaults with the correct ledgerClass and isSystemDefined: true", async () => {
    txCreateManyMock.mockResolvedValueOnce({ count: 5 });
    const tx = { paymentMode: { createMany: txCreateManyMock } } as unknown as Parameters<
      typeof paymentModeRepository.seedDefaults
    >[1];

    await paymentModeRepository.seedDefaults(COMPANY_ID, tx);

    expect(txCreateManyMock).toHaveBeenCalledTimes(1);
    const { data } = txCreateManyMock.mock.calls[0][0];
    expect(data).toHaveLength(5);
    expect(data.every((row: { companyId: string; isSystemDefined: boolean }) => row.companyId === COMPANY_ID)).toBe(
      true
    );
    expect(data.every((row: { isSystemDefined: boolean }) => row.isSystemDefined === true)).toBe(true);
    expect(data).toEqual([
      { name: "Cash", ledgerClass: "CASH", companyId: COMPANY_ID, isSystemDefined: true },
      { name: "Bank Transfer", ledgerClass: "BANK", companyId: COMPANY_ID, isSystemDefined: true },
      { name: "UPI", ledgerClass: "BANK", companyId: COMPANY_ID, isSystemDefined: true },
      { name: "Card", ledgerClass: "BANK", companyId: COMPANY_ID, isSystemDefined: true },
      { name: "Cheque", ledgerClass: "BANK", companyId: COMPANY_ID, isSystemDefined: true },
    ]);
  });
});
