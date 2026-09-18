import { beforeEach, describe, expect, it, vi } from "vitest";

// Mirrors ledger-class.test.ts's convention — mock the two repository
// boundaries getLedgerPaymentClass reads through, plus a fake `client` whose
// only requirement here is a `paymentMode.findUnique` method (the real
// caller passes either the global `prisma` or a transaction client).
const { ledgerGroupFindManyMock, findLedgersForValidationMock, paymentModeFindUniqueMock } = vi.hoisted(() => ({
  ledgerGroupFindManyMock: vi.fn(),
  findLedgersForValidationMock: vi.fn(),
  paymentModeFindUniqueMock: vi.fn(),
}));

vi.mock("@/modules/ledger-groups/repositories/ledger-group-repository", () => ({
  ledgerGroupRepository: { findMany: ledgerGroupFindManyMock },
}));
vi.mock("@/modules/ledgers/repositories/ledger-repository", () => ({
  ledgerRepository: { findLedgersForValidation: findLedgersForValidationMock },
}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { assertPaymentModeMatchesLedger } from "@/lib/payment-mode-validation";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_COMPANY_ID = "99999999-9999-4999-8999-999999999999";
const CASH_GROUP_ID = "10000000-0000-4000-8000-000000000001";
const OTHER_GROUP_ID = "10000000-0000-4000-8000-000000000002";
const CASH_LEDGER_ID = "20000000-0000-4000-8000-000000000001";
const BANK_LEDGER_ID = "20000000-0000-4000-8000-000000000002";
const OTHER_LEDGER_ID = "20000000-0000-4000-8000-000000000003";
const PAYMENT_MODE_ID = "30000000-0000-4000-8000-000000000001";

const LEDGER_GROUPS = [
  { id: CASH_GROUP_ID, companyId: COMPANY_ID, name: "Cash-in-Hand", parentGroupId: null },
  { id: OTHER_GROUP_ID, companyId: COMPANY_ID, name: "Sundry Creditors", parentGroupId: null },
];

const CASH_LEDGER = { id: CASH_LEDGER_ID, name: "Cash", companyId: COMPANY_ID, isActive: true, ledgerGroupId: CASH_GROUP_ID, hasBankAccount: false };
const BANK_LEDGER = { id: BANK_LEDGER_ID, name: "HDFC Bank", companyId: COMPANY_ID, isActive: true, ledgerGroupId: OTHER_GROUP_ID, hasBankAccount: true };
const OTHER_LEDGER = { id: OTHER_LEDGER_ID, name: "Sundry Creditor", companyId: COMPANY_ID, isActive: true, ledgerGroupId: OTHER_GROUP_ID, hasBankAccount: false };

function fakeClient() {
  return { paymentMode: { findUnique: paymentModeFindUniqueMock } } as never;
}

beforeEach(() => {
  ledgerGroupFindManyMock.mockReset().mockResolvedValue(LEDGER_GROUPS);
  findLedgersForValidationMock.mockReset();
  paymentModeFindUniqueMock.mockReset();
});

describe("assertPaymentModeMatchesLedger", () => {
  it("accepts a CASH-class mode against a Cash-in-Hand ledger", async () => {
    paymentModeFindUniqueMock.mockResolvedValue({ id: PAYMENT_MODE_ID, companyId: COMPANY_ID, name: "Cash", ledgerClass: "CASH", isActive: true });
    findLedgersForValidationMock.mockResolvedValue([CASH_LEDGER]);
    await expect(
      assertPaymentModeMatchesLedger(fakeClient(), PAYMENT_MODE_ID, CASH_LEDGER_ID, COMPANY_ID)
    ).resolves.toBeUndefined();
  });

  it("accepts a BANK-class mode against a bank-linked ledger", async () => {
    paymentModeFindUniqueMock.mockResolvedValue({ id: PAYMENT_MODE_ID, companyId: COMPANY_ID, name: "Bank Transfer", ledgerClass: "BANK", isActive: true });
    findLedgersForValidationMock.mockResolvedValue([BANK_LEDGER]);
    await expect(
      assertPaymentModeMatchesLedger(fakeClient(), PAYMENT_MODE_ID, BANK_LEDGER_ID, COMPANY_ID)
    ).resolves.toBeUndefined();
  });

  it("accepts an ANY-class mode against either a Cash or a Bank ledger", async () => {
    paymentModeFindUniqueMock.mockResolvedValue({ id: PAYMENT_MODE_ID, companyId: COMPANY_ID, name: "Flexible", ledgerClass: "ANY", isActive: true });

    findLedgersForValidationMock.mockResolvedValue([CASH_LEDGER]);
    await expect(assertPaymentModeMatchesLedger(fakeClient(), PAYMENT_MODE_ID, CASH_LEDGER_ID, COMPANY_ID)).resolves.toBeUndefined();

    findLedgersForValidationMock.mockResolvedValue([BANK_LEDGER]);
    await expect(assertPaymentModeMatchesLedger(fakeClient(), PAYMENT_MODE_ID, BANK_LEDGER_ID, COMPANY_ID)).resolves.toBeUndefined();
  });

  it("rejects a CASH-class mode against a bank-linked ledger", async () => {
    paymentModeFindUniqueMock.mockResolvedValue({ id: PAYMENT_MODE_ID, companyId: COMPANY_ID, name: "Cash", ledgerClass: "CASH", isActive: true });
    findLedgersForValidationMock.mockResolvedValue([BANK_LEDGER]);
    await expect(
      assertPaymentModeMatchesLedger(fakeClient(), PAYMENT_MODE_ID, BANK_LEDGER_ID, COMPANY_ID)
    ).rejects.toThrow('Payment mode "Cash" requires a Cash-in-Hand ledger.');
  });

  it("rejects a BANK-class mode against a Cash-in-Hand ledger", async () => {
    paymentModeFindUniqueMock.mockResolvedValue({ id: PAYMENT_MODE_ID, companyId: COMPANY_ID, name: "Bank Transfer", ledgerClass: "BANK", isActive: true });
    findLedgersForValidationMock.mockResolvedValue([CASH_LEDGER]);
    await expect(
      assertPaymentModeMatchesLedger(fakeClient(), PAYMENT_MODE_ID, CASH_LEDGER_ID, COMPANY_ID)
    ).rejects.toThrow('Payment mode "Bank Transfer" requires a bank-linked ledger.');
  });

  it("rejects an ANY-class mode against a ledger that is neither Cash nor Bank", async () => {
    paymentModeFindUniqueMock.mockResolvedValue({ id: PAYMENT_MODE_ID, companyId: COMPANY_ID, name: "Flexible", ledgerClass: "ANY", isActive: true });
    findLedgersForValidationMock.mockResolvedValue([OTHER_LEDGER]);
    await expect(
      assertPaymentModeMatchesLedger(fakeClient(), PAYMENT_MODE_ID, OTHER_LEDGER_ID, COMPANY_ID)
    ).rejects.toThrow("requires a Cash-in-Hand or bank-linked ledger");
  });

  it("rejects an inactive payment mode outright, even with a matching ledger class", async () => {
    paymentModeFindUniqueMock.mockResolvedValue({ id: PAYMENT_MODE_ID, companyId: COMPANY_ID, name: "Cheque", ledgerClass: "BANK", isActive: false });
    findLedgersForValidationMock.mockResolvedValue([BANK_LEDGER]);
    await expect(
      assertPaymentModeMatchesLedger(fakeClient(), PAYMENT_MODE_ID, BANK_LEDGER_ID, COMPANY_ID)
    ).rejects.toThrow('Payment mode "Cheque" is inactive and cannot be used.');
  });

  it("rejects an unknown payment mode id", async () => {
    paymentModeFindUniqueMock.mockResolvedValue(null);
    await expect(
      assertPaymentModeMatchesLedger(fakeClient(), PAYMENT_MODE_ID, CASH_LEDGER_ID, COMPANY_ID)
    ).rejects.toThrow("Selected payment mode not found.");
  });

  it("rejects a payment mode belonging to another company", async () => {
    paymentModeFindUniqueMock.mockResolvedValue({ id: PAYMENT_MODE_ID, companyId: OTHER_COMPANY_ID, name: "Cash", ledgerClass: "CASH", isActive: true });
    await expect(
      assertPaymentModeMatchesLedger(fakeClient(), PAYMENT_MODE_ID, CASH_LEDGER_ID, COMPANY_ID)
    ).rejects.toThrow("Selected payment mode not found.");
  });
});
