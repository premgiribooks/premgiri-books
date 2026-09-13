import { describe, expect, it, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

// Mirrors credit-note-service.test.ts's/employee-service.test.ts's
// convention — mock the module-boundary repository plus the session/
// permission boundary, rather than hitting a real database or session.
const { findByIdMock, activateMock, deactivateMock, getCurrentCompanyUserMock, assertPermissionMock } =
  vi.hoisted(() => ({
    findByIdMock: vi.fn(),
    activateMock: vi.fn(),
    deactivateMock: vi.fn(),
    getCurrentCompanyUserMock: vi.fn(),
    assertPermissionMock: vi.fn(),
  }));

vi.mock("@/modules/payment-modes/repositories/payment-mode-repository", () => ({
  paymentModeRepository: {
    findById: findByIdMock,
    activate: activateMock,
    deactivate: deactivateMock,
  },
}));

vi.mock("@/lib/current-user", () => ({
  getCurrentCompanyUser: getCurrentCompanyUserMock,
}));

vi.mock("@/lib/permissions", () => ({
  assertPermission: assertPermissionMock,
}));

import { paymentModeService, translatePersistError } from "@/modules/payment-modes/services/payment-mode-service";

const COMPANY_ID = "company-1";
const OTHER_COMPANY_ID = "company-2";

function uniqueConstraintError(target: string[]): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
    meta: { target },
  });
}

describe("paymentModeService.translatePersistError", () => {
  it("translates a name uniqueness violation into a friendly, per-company message", () => {
    expect(() => translatePersistError(uniqueConstraintError(["companyId", "name"]))).toThrow(
      "A payment mode with this name already exists in this company."
    );
  });

  it("rethrows any other error unchanged", () => {
    const error = new Error("boom");
    expect(() => translatePersistError(error)).toThrow(error);
  });
});

describe("paymentModeService.getPaymentMode — cross-company isolation", () => {
  beforeEach(() => {
    findByIdMock.mockReset();
    getCurrentCompanyUserMock.mockReset();
    assertPermissionMock.mockReset();
    getCurrentCompanyUserMock.mockResolvedValue({ id: "user-1", companyId: COMPANY_ID, role: "Admin" });
    assertPermissionMock.mockResolvedValue(undefined);
  });

  it("returns null for a payment mode id belonging to a different company", async () => {
    findByIdMock.mockResolvedValueOnce({ id: "mode-1", companyId: OTHER_COMPANY_ID });

    const result = await paymentModeService.getPaymentMode("mode-1");

    expect(result).toBeNull();
  });

  it("returns the row for a same-company id", async () => {
    const row = { id: "mode-1", companyId: COMPANY_ID, name: "Cash", ledgerClass: "CASH" };
    findByIdMock.mockResolvedValueOnce(row);

    const result = await paymentModeService.getPaymentMode("mode-1");

    expect(result).toEqual(row);
  });
});

// Activate/Deactivate gate on "delete" — the permission catalog has no
// dedicated activate/deactivate action, mirroring every other master-data
// service in this codebase (unitService, ledgerService, bankAccountService,
// …). 86-payment-mode-master.md's own prose claims Bank Management gates
// status changes under "edit" instead — that does not match
// bank-account-service.ts's actual code (LIFECYCLE_ACTION = "delete");
// resolved here in favor of the universal, verified codebase convention (see
// progress-tracker.md for the recorded discrepancy).
describe("paymentModeService activate/deactivate — permission gate", () => {
  beforeEach(() => {
    activateMock.mockReset();
    deactivateMock.mockReset();
    getCurrentCompanyUserMock.mockReset();
    assertPermissionMock.mockReset();
    getCurrentCompanyUserMock.mockResolvedValue({ id: "user-1", companyId: COMPANY_ID, role: "Admin" });
    assertPermissionMock.mockResolvedValue(undefined);
  });

  it("activatePaymentMode asserts the 'delete' action, not 'edit'", async () => {
    activateMock.mockResolvedValueOnce({ status: "ok", paymentMode: { id: "mode-1" } });

    await paymentModeService.activatePaymentMode("mode-1");

    expect(assertPermissionMock).toHaveBeenCalledWith(expect.anything(), "accounting", "delete");
  });

  it("deactivatePaymentMode asserts the 'delete' action, not 'edit'", async () => {
    deactivateMock.mockResolvedValueOnce({ status: "ok", paymentMode: { id: "mode-1" } });

    await paymentModeService.deactivatePaymentMode("mode-1");

    expect(assertPermissionMock).toHaveBeenCalledWith(expect.anything(), "accounting", "delete");
  });

  it("throws a not-found AppError when the row does not exist", async () => {
    activateMock.mockResolvedValueOnce({ status: "not_found" });

    await expect(paymentModeService.activatePaymentMode("missing")).rejects.toThrow(
      "Payment mode not found."
    );
  });
});

// No permanent delete path exists anywhere on the service — Activate/
// Deactivate only (86-payment-mode-master.md's Business Rules).
describe("paymentModeService — no delete method", () => {
  it("exposes no delete/remove method", () => {
    expect((paymentModeService as Record<string, unknown>).deletePaymentMode).toBeUndefined();
    expect((paymentModeService as Record<string, unknown>).removePaymentMode).toBeUndefined();
  });
});
