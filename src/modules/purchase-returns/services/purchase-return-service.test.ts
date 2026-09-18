import { beforeEach, describe, expect, it, vi } from "vitest";

// Mirrors sales-return-service.test.ts's / purchase-invoice-service.test.ts's
// convention — mock the module-boundary repository, sibling
// repositories/services/engines, and the session/permission/Prisma
// boundaries. assertPurchaseLedgerMappingValid (company/utils) is left REAL
// so the ledger-mapping-matrix assertions are genuine, exercised through the
// mocked ledgerGroupRepository/ledgerRepository beneath it.
const {
  findManyMock,
  findByIdMock,
  createMock,
  replaceItemsAndUpdateMock,
  replaceItemsAndPostMock,
  updateStatusMock,
  findPurchaseInvoiceForReturnMock,
  sumPostedReturnedQuantitiesMock,
  findRefundLedgerForReturnMock,
  findSupplierLedgerIdMock,
  findSelectableRefundLedgersMock,
  findPostedInvoicesForPickerMock,
  getCurrentCompanyUserMock,
  getCurrentFinancialYearMock,
  assertPermissionMock,
  ensureSequenceMock,
  generateNumberMock,
  ledgerGroupFindManyMock,
  findLedgersForValidationMock,
  getSettingsMock,
  postVoucherMock,
  cancelVoucherMock,
  recordMovementsMock,
  assertPaymentModeMatchesLedgerMock,
  FAKE_TX,
} = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  findByIdMock: vi.fn(),
  createMock: vi.fn(),
  replaceItemsAndUpdateMock: vi.fn(),
  replaceItemsAndPostMock: vi.fn(),
  updateStatusMock: vi.fn(),
  findPurchaseInvoiceForReturnMock: vi.fn(),
  sumPostedReturnedQuantitiesMock: vi.fn(),
  findRefundLedgerForReturnMock: vi.fn(),
  findSupplierLedgerIdMock: vi.fn(),
  findSelectableRefundLedgersMock: vi.fn(),
  findPostedInvoicesForPickerMock: vi.fn(),
  getCurrentCompanyUserMock: vi.fn(),
  getCurrentFinancialYearMock: vi.fn(),
  assertPermissionMock: vi.fn(),
  ensureSequenceMock: vi.fn(),
  generateNumberMock: vi.fn(),
  ledgerGroupFindManyMock: vi.fn(),
  findLedgersForValidationMock: vi.fn(),
  getSettingsMock: vi.fn(),
  postVoucherMock: vi.fn(),
  cancelVoucherMock: vi.fn(),
  recordMovementsMock: vi.fn(),
  assertPaymentModeMatchesLedgerMock: vi.fn(),
  FAKE_TX: { marker: "fake-tx" },
}));

vi.mock("@/modules/purchase-returns/repositories/purchase-return-repository", () => ({
  purchaseReturnRepository: {
    findMany: findManyMock,
    findById: findByIdMock,
    create: createMock,
    replaceItemsAndUpdate: replaceItemsAndUpdateMock,
    replaceItemsAndPost: replaceItemsAndPostMock,
    updateStatus: updateStatusMock,
    findPurchaseInvoiceForReturn: findPurchaseInvoiceForReturnMock,
    sumPostedReturnedQuantities: sumPostedReturnedQuantitiesMock,
    findRefundLedgerForReturn: findRefundLedgerForReturnMock,
    findSupplierLedgerId: findSupplierLedgerIdMock,
    findSelectableRefundLedgers: findSelectableRefundLedgersMock,
    findPostedInvoicesForPicker: findPostedInvoicesForPickerMock,
  },
}));

vi.mock("@/lib/current-user", () => ({ getCurrentCompanyUser: getCurrentCompanyUserMock }));
vi.mock("@/lib/current-financial-year", () => ({ getCurrentFinancialYear: getCurrentFinancialYearMock }));
vi.mock("@/lib/permissions", () => ({ assertPermission: assertPermissionMock }));
vi.mock("@/lib/payment-mode-validation", () => ({ assertPaymentModeMatchesLedger: assertPaymentModeMatchesLedgerMock }));

vi.mock("@/engines/document-number/document-number-engine", () => ({
  documentNumberEngine: { ensureSequence: ensureSequenceMock, generateNumber: generateNumberMock },
}));

vi.mock("@/engines/voucher/voucher-engine", () => ({
  voucherEngine: { postVoucher: postVoucherMock, cancelVoucher: cancelVoucherMock },
}));
vi.mock("@/engines/inventory/inventory-engine", () => ({
  inventoryEngine: { recordMovements: recordMovementsMock },
}));

vi.mock("@/modules/ledger-groups/repositories/ledger-group-repository", () => ({
  ledgerGroupRepository: { findMany: ledgerGroupFindManyMock },
}));
vi.mock("@/modules/ledgers/repositories/ledger-repository", () => ({
  ledgerRepository: { findLedgersForValidation: findLedgersForValidationMock },
}));

vi.mock("@/modules/company/services/company-settings-service", () => ({
  companySettingsService: { getSettings: getSettingsMock },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: (fn: (tx: unknown) => unknown) => fn(FAKE_TX) },
}));

import { AppError } from "@/lib/app-error";
import { prisma } from "@/lib/prisma";
import { purchaseReturnService } from "@/modules/purchase-returns/services/purchase-return-service";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_COMPANY_ID = "99999999-9999-4999-8999-999999999999";
const FY_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";
const SUPPLIER_ID = "44444444-4444-4444-8444-444444444444";
const SUPPLIER_LEDGER_ID = "55555555-5555-4555-8555-555555555555";
const PRODUCT_ID = "66666666-6666-4666-8666-666666666666";
const WAREHOUSE_ID = "77777777-7777-4777-8777-777777777777";
const INVOICE_ID = "88888888-8888-4888-8888-888888888888";
const ITEM_ID = "99999999-9999-4999-8999-999999999999";
const VOUCHER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const RETURN_ID = "pret-1";
const PAYMENT_MODE_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const PURCHASE_GROUP_ID = "10000000-0000-4000-8000-000000000001";
const TAXES_GROUP_ID = "10000000-0000-4000-8000-000000000002";
const CASH_GROUP_ID = "10000000-0000-4000-8000-000000000003";
const OTHER_GROUP_ID = "10000000-0000-4000-8000-000000000004";

const LEDGER_GROUPS = [
  { id: PURCHASE_GROUP_ID, companyId: COMPANY_ID, name: "Purchase Accounts", parentGroupId: null },
  { id: TAXES_GROUP_ID, companyId: COMPANY_ID, name: "Duties & Taxes", parentGroupId: null },
  { id: CASH_GROUP_ID, companyId: COMPANY_ID, name: "Cash-in-Hand", parentGroupId: null },
  { id: OTHER_GROUP_ID, companyId: COMPANY_ID, name: "Sales Accounts", parentGroupId: null },
];

const PURCHASE_LEDGER_ID = "20000000-0000-4000-8000-000000000001";
const INPUT_CGST_LEDGER_ID = "20000000-0000-4000-8000-000000000002";
const INPUT_SGST_LEDGER_ID = "20000000-0000-4000-8000-000000000003";
const INPUT_IGST_LEDGER_ID = "20000000-0000-4000-8000-000000000004";
const INPUT_CESS_LEDGER_ID = "20000000-0000-4000-8000-000000000005";
const ROUND_OFF_LEDGER_ID = "20000000-0000-4000-8000-000000000006";
const REFUND_LEDGER_ID = "20000000-0000-4000-8000-000000000007";
const BANK_REFUND_LEDGER_ID = "20000000-0000-4000-8000-000000000008";
const INVALID_REFUND_LEDGER_ID = "20000000-0000-4000-8000-000000000009";

const COMPLETE_SETTINGS = {
  purchaseLedgerId: PURCHASE_LEDGER_ID,
  inputCgstLedgerId: INPUT_CGST_LEDGER_ID,
  inputSgstLedgerId: INPUT_SGST_LEDGER_ID,
  inputIgstLedgerId: INPUT_IGST_LEDGER_ID,
  inputCessLedgerId: INPUT_CESS_LEDGER_ID,
  roundOffLedgerId: ROUND_OFF_LEDGER_ID,
};

function ledgerInfo(
  id: string,
  ledgerGroupId: string,
  overrides: Record<string, unknown> = {}
): { id: string; name: string; companyId: string; isActive: boolean; ledgerGroupId: string; hasBankAccount: boolean } {
  return { id, name: `Ledger ${id}`, companyId: COMPANY_ID, isActive: true, ledgerGroupId, hasBankAccount: false, ...overrides };
}

const LEDGERS_BY_ID: Record<string, ReturnType<typeof ledgerInfo>> = {
  [PURCHASE_LEDGER_ID]: ledgerInfo(PURCHASE_LEDGER_ID, PURCHASE_GROUP_ID),
  [INPUT_CGST_LEDGER_ID]: ledgerInfo(INPUT_CGST_LEDGER_ID, TAXES_GROUP_ID),
  [INPUT_SGST_LEDGER_ID]: ledgerInfo(INPUT_SGST_LEDGER_ID, TAXES_GROUP_ID),
  [INPUT_IGST_LEDGER_ID]: ledgerInfo(INPUT_IGST_LEDGER_ID, TAXES_GROUP_ID),
  [INPUT_CESS_LEDGER_ID]: ledgerInfo(INPUT_CESS_LEDGER_ID, TAXES_GROUP_ID),
  [ROUND_OFF_LEDGER_ID]: ledgerInfo(ROUND_OFF_LEDGER_ID, OTHER_GROUP_ID),
};

// quantity 10 x rate 100 = 1000 taxable, 18% intra-state = 90 CGST + 90 SGST.
function invoiceForReturn(overrides: Record<string, unknown> = {}) {
  return {
    id: INVOICE_ID,
    companyId: COMPANY_ID,
    financialYearId: FY_ID,
    invoiceNumber: "PINV-0001",
    invoiceDate: new Date("2026-09-01T00:00:00.000Z"),
    status: "POSTED",
    supplierId: SUPPLIER_ID,
    supplierName: "Acme Supplies",
    items: [
      {
        id: ITEM_ID,
        productId: PRODUCT_ID,
        productName: "Product A",
        productCode: "A",
        warehouseId: WAREHOUSE_ID,
        warehouseName: "Main Warehouse",
        unitSymbol: "Nos",
        unitDecimalPlaces: 0,
        quantity: 10,
        rate: 100,
        ratePercent: 18,
        cessPercent: 0,
        taxableAmount: 1000,
        cgst: 90,
        sgst: 90,
        igst: 0,
        cess: 0,
        isTaxOverridden: false,
        overriddenCgst: null,
        overriddenSgst: null,
        overriddenIgst: null,
        overriddenCess: null,
      },
    ],
    ...overrides,
  };
}

// A return of 2 of the 10 units above: 200 taxable, 18 CGST, 18 SGST, 236 grand total.
function purchaseReturnRow(overrides: Record<string, unknown> = {}) {
  return {
    id: RETURN_ID,
    companyId: COMPANY_ID,
    financialYearId: FY_ID,
    returnNumber: null,
    returnDate: new Date("2026-09-10T00:00:00.000Z"),
    purchaseInvoiceId: INVOICE_ID,
    purchaseInvoice: {
      id: INVOICE_ID,
      invoiceNumber: "PINV-0001",
      invoiceDate: new Date("2026-09-01T00:00:00.000Z"),
      supplierId: SUPPLIER_ID,
      supplierName: "Acme Supplies",
    },
    refundMode: "LEDGER_ADJUSTMENT",
    refundLedgerId: null,
    refundLedger: null,
    paymentModeId: null,
    paymentMode: null,
    status: "DRAFT",
    reason: null,
    taxableAmount: 200,
    totalCgst: 18,
    totalSgst: 18,
    totalIgst: 0,
    totalCess: 0,
    grandTotal: 236,
    voucherId: null,
    createdByUserId: USER_ID,
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [
      {
        id: "ret-item-1",
        purchaseReturnId: RETURN_ID,
        lineNumber: 1,
        purchaseInvoiceItemId: ITEM_ID,
        purchaseInvoiceItem: {
          id: ITEM_ID,
          productId: PRODUCT_ID,
          productName: "Product A",
          productCode: "A",
          warehouseId: WAREHOUSE_ID,
          warehouseName: "Main Warehouse",
        },
        quantity: 2,
        taxableAmount: 200,
        cgst: 18,
        sgst: 18,
        igst: 0,
        cess: 0,
        totalAmount: 236,
      },
    ],
    ...overrides,
  };
}

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    purchaseInvoiceId: INVOICE_ID,
    returnDate: "2026-09-10",
    lines: [{ purchaseInvoiceItemId: ITEM_ID, quantity: 2 }],
    ...overrides,
  };
}

const CURRENT_USER = {
  id: USER_ID,
  username: "admin",
  fullName: "Admin",
  userType: "COMPANY" as const,
  role: "Company Admin",
  companyId: COMPANY_ID,
};

const CURRENT_FY = {
  id: FY_ID,
  companyId: COMPANY_ID,
  name: "2026-2027",
  startDate: new Date("2026-04-01T00:00:00.000Z"),
  endDate: new Date("2027-03-31T00:00:00.000Z"),
  isCurrent: true,
  isClosed: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  findManyMock.mockReset();
  findByIdMock.mockReset();
  createMock.mockReset();
  replaceItemsAndUpdateMock.mockReset();
  replaceItemsAndPostMock.mockReset();
  updateStatusMock.mockReset();
  findPurchaseInvoiceForReturnMock.mockReset();
  sumPostedReturnedQuantitiesMock.mockReset();
  findRefundLedgerForReturnMock.mockReset();
  findSupplierLedgerIdMock.mockReset();
  findSelectableRefundLedgersMock.mockReset();
  findPostedInvoicesForPickerMock.mockReset();
  getCurrentCompanyUserMock.mockReset();
  getCurrentFinancialYearMock.mockReset();
  assertPermissionMock.mockReset();
  ensureSequenceMock.mockReset();
  generateNumberMock.mockReset();
  ledgerGroupFindManyMock.mockReset();
  findLedgersForValidationMock.mockReset();
  getSettingsMock.mockReset();
  postVoucherMock.mockReset();
  cancelVoucherMock.mockReset();
  recordMovementsMock.mockReset();
  assertPaymentModeMatchesLedgerMock.mockReset();

  getCurrentCompanyUserMock.mockResolvedValue(CURRENT_USER);
  getCurrentFinancialYearMock.mockResolvedValue(CURRENT_FY);
  assertPermissionMock.mockResolvedValue(undefined);
  assertPaymentModeMatchesLedgerMock.mockResolvedValue(undefined);
  findPurchaseInvoiceForReturnMock.mockResolvedValue(invoiceForReturn());
  sumPostedReturnedQuantitiesMock.mockResolvedValue(new Map());
  findSupplierLedgerIdMock.mockResolvedValue(SUPPLIER_LEDGER_ID);
  findRefundLedgerForReturnMock.mockResolvedValue(ledgerInfo(REFUND_LEDGER_ID, CASH_GROUP_ID));
  getSettingsMock.mockResolvedValue(COMPLETE_SETTINGS);
  ledgerGroupFindManyMock.mockResolvedValue(LEDGER_GROUPS);
  findLedgersForValidationMock.mockImplementation(async (_client: unknown, ids: readonly string[]) =>
    ids.map((id) => LEDGERS_BY_ID[id]).filter(Boolean)
  );
  generateNumberMock.mockResolvedValue({ documentSequenceId: "seq-1", number: 1, formatted: "PRET-0001" });
  createMock.mockResolvedValue(purchaseReturnRow());
  postVoucherMock.mockResolvedValue({ id: VOUCHER_ID });
  recordMovementsMock.mockResolvedValue([]);
  replaceItemsAndPostMock.mockResolvedValue(
    purchaseReturnRow({ status: "POSTED", voucherId: VOUCHER_ID, returnNumber: "PRET-0001" })
  );
});

describe("createDraft", () => {
  it("creates a DRAFT return with returnNumber untouched (numbering deferred to posting)", async () => {
    await purchaseReturnService.createDraft(validInput());
    expect(ensureSequenceMock).not.toHaveBeenCalled();
    expect(generateNumberMock).not.toHaveBeenCalled();
    expect(createMock).toHaveBeenCalledWith(
      FAKE_TX,
      COMPANY_ID,
      FY_ID,
      expect.objectContaining({ purchaseInvoiceId: INVOICE_ID, refundMode: "LEDGER_ADJUSTMENT", grandTotal: 236 }),
      [expect.objectContaining({ purchaseInvoiceItemId: ITEM_ID, quantity: 2, taxableAmount: 200, cgst: 18, sgst: 18 })],
      USER_ID
    );
  });

  it("rejects when the source invoice is not POSTED", async () => {
    findPurchaseInvoiceForReturnMock.mockResolvedValueOnce(invoiceForReturn({ status: "DRAFT" }));
    await expect(purchaseReturnService.createDraft(validInput())).rejects.toThrow(
      "Only a posted purchase invoice can be returned against."
    );
  });

  it("rejects when the source invoice does not belong to this company", async () => {
    findPurchaseInvoiceForReturnMock.mockResolvedValueOnce(null);
    await expect(purchaseReturnService.createDraft(validInput())).rejects.toThrow("Purchase invoice not found.");
  });

  it("rejects a return date before the invoice date", async () => {
    await expect(purchaseReturnService.createDraft(validInput({ returnDate: "2026-08-01" }))).rejects.toThrow(
      "Return date cannot be before the invoice date."
    );
  });

  it("rejects a line quantity exceeding the remaining returnable quantity", async () => {
    sumPostedReturnedQuantitiesMock.mockResolvedValueOnce(new Map([[ITEM_ID, 9]]));
    await expect(
      purchaseReturnService.createDraft(validInput({ lines: [{ purchaseInvoiceItemId: ITEM_ID, quantity: 2 }] }))
    ).rejects.toThrow("exceed the remaining returnable quantity");
  });

  it("caps correctly across two sequential partial returns (returnable shrinks after a POSTED sibling)", async () => {
    sumPostedReturnedQuantitiesMock.mockResolvedValueOnce(new Map([[ITEM_ID, 6]]));
    // 10 - 6 = 4 remaining; requesting 4 succeeds.
    await purchaseReturnService.createDraft(validInput({ lines: [{ purchaseInvoiceItemId: ITEM_ID, quantity: 4 }] }));
    expect(createMock).toHaveBeenCalled();
  });

  it("rejects a line referencing an item that doesn't belong to the invoice", async () => {
    const unrelatedItemId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    await expect(
      purchaseReturnService.createDraft(validInput({ lines: [{ purchaseInvoiceItemId: unrelatedItemId, quantity: 1 }] }))
    ).rejects.toThrow("does not belong to the selected purchase invoice");
  });

  it("every rejection is an AppError", async () => {
    findPurchaseInvoiceForReturnMock.mockResolvedValueOnce(null);
    await expect(purchaseReturnService.createDraft(validInput())).rejects.toBeInstanceOf(AppError);
  });

  it("defaults refundMode to LEDGER_ADJUSTMENT when omitted — no WALK_IN-style forcing exists on the purchase side", async () => {
    await purchaseReturnService.createDraft(validInput({ refundMode: undefined }));
    expect(createMock).toHaveBeenCalledWith(
      FAKE_TX,
      COMPANY_ID,
      FY_ID,
      expect.objectContaining({ refundMode: "LEDGER_ADJUSTMENT" }),
      expect.any(Array),
      USER_ID
    );
  });

  it("requires a refundLedgerId when CASH_REFUND is explicitly chosen", async () => {
    await expect(purchaseReturnService.createDraft(validInput({ refundMode: "CASH_REFUND" }))).rejects.toThrow(
      "Select a refund ledger for a cash refund."
    );
  });

  // 92-payment-mode-integration-purchase.md — mirrors
  // sales-return-service.test.ts's identical assertion.
  it("requires a paymentModeId when CASH_REFUND is explicitly chosen", async () => {
    await expect(
      purchaseReturnService.createDraft(validInput({ refundMode: "CASH_REFUND", refundLedgerId: REFUND_LEDGER_ID }))
    ).rejects.toThrow("Select a payment mode for a cash refund.");
  });

  it("accepts CASH_REFUND with a Cash-in-Hand refund ledger", async () => {
    await purchaseReturnService.createDraft(
      validInput({ refundMode: "CASH_REFUND", refundLedgerId: REFUND_LEDGER_ID, paymentModeId: PAYMENT_MODE_ID })
    );
    expect(createMock).toHaveBeenCalledWith(
      FAKE_TX,
      COMPANY_ID,
      FY_ID,
      expect.objectContaining({ refundMode: "CASH_REFUND", refundLedgerId: REFUND_LEDGER_ID, paymentModeId: PAYMENT_MODE_ID }),
      expect.any(Array),
      USER_ID
    );
  });

  it("accepts CASH_REFUND with a bank-linked refund ledger", async () => {
    findRefundLedgerForReturnMock.mockResolvedValueOnce(
      ledgerInfo(BANK_REFUND_LEDGER_ID, OTHER_GROUP_ID, { hasBankAccount: true })
    );
    await purchaseReturnService.createDraft(
      validInput({ refundMode: "CASH_REFUND", refundLedgerId: BANK_REFUND_LEDGER_ID, paymentModeId: PAYMENT_MODE_ID })
    );
    expect(createMock).toHaveBeenCalled();
  });

  // Code review finding: verify assertPaymentModeMatchesLedger is validated
  // against the global `prisma` singleton at draft-save time, mirroring
  // sales-return-service.test.ts's identical assertion.
  it("validates the payment mode against the refund ledger via the global prisma client, not a transaction", async () => {
    await purchaseReturnService.createDraft(
      validInput({ refundMode: "CASH_REFUND", refundLedgerId: REFUND_LEDGER_ID, paymentModeId: PAYMENT_MODE_ID })
    );
    expect(assertPaymentModeMatchesLedgerMock).toHaveBeenCalledWith(prisma, PAYMENT_MODE_ID, REFUND_LEDGER_ID, COMPANY_ID);
  });

  it("rejects a refund ledger that is neither Cash-in-Hand nor bank-linked", async () => {
    findRefundLedgerForReturnMock.mockResolvedValueOnce(ledgerInfo(INVALID_REFUND_LEDGER_ID, OTHER_GROUP_ID));
    await expect(
      purchaseReturnService.createDraft(
        validInput({ refundMode: "CASH_REFUND", refundLedgerId: INVALID_REFUND_LEDGER_ID, paymentModeId: PAYMENT_MODE_ID })
      )
    ).rejects.toThrow("is not a Cash-in-Hand or bank-linked ledger");
  });

  it("rejects an inactive refund ledger", async () => {
    findRefundLedgerForReturnMock.mockResolvedValueOnce(ledgerInfo(REFUND_LEDGER_ID, CASH_GROUP_ID, { isActive: false }));
    await expect(
      purchaseReturnService.createDraft(
        validInput({ refundMode: "CASH_REFUND", refundLedgerId: REFUND_LEDGER_ID, paymentModeId: PAYMENT_MODE_ID })
      )
    ).rejects.toThrow("inactive");
  });
});

describe("updateDraft", () => {
  it("updates a DRAFT return's lines/refund details when the invoice is left unchanged", async () => {
    findByIdMock.mockResolvedValueOnce(purchaseReturnRow());
    replaceItemsAndUpdateMock.mockResolvedValueOnce(purchaseReturnRow({ reason: "Damaged in transit" }));

    await purchaseReturnService.updateDraft(RETURN_ID, validInput({ reason: "Damaged in transit" }));

    expect(replaceItemsAndUpdateMock).toHaveBeenCalledWith(
      FAKE_TX,
      RETURN_ID,
      COMPANY_ID,
      ["DRAFT"],
      expect.objectContaining({ purchaseInvoiceId: INVOICE_ID, reason: "Damaged in transit" }),
      expect.any(Array)
    );
  });

  it("rejects re-pointing a draft return to a different purchase invoice", async () => {
    findByIdMock.mockResolvedValueOnce(purchaseReturnRow({ purchaseInvoiceId: INVOICE_ID }));
    const otherInvoiceId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

    await expect(
      purchaseReturnService.updateDraft(RETURN_ID, validInput({ purchaseInvoiceId: otherInvoiceId }))
    ).rejects.toThrow("Cannot change the invoice a return is linked to");
    expect(replaceItemsAndUpdateMock).not.toHaveBeenCalled();
  });

  it("rejects updating a return that no longer belongs to this company", async () => {
    findByIdMock.mockResolvedValueOnce(purchaseReturnRow({ companyId: OTHER_COMPANY_ID }));
    await expect(purchaseReturnService.updateDraft(RETURN_ID, validInput())).rejects.toThrow(
      "Purchase return not found."
    );
  });

  it("rejects updating a return that is no longer DRAFT", async () => {
    findByIdMock.mockResolvedValueOnce(purchaseReturnRow({ status: "POSTED" }));
    await expect(purchaseReturnService.updateDraft(RETURN_ID, validInput())).rejects.toThrow(
      "can no longer be changed"
    );
  });
});

describe("postPurchaseReturn — orchestration and ledger entries", () => {
  it("posts: generates returnNumber, records OUT stock, posts a balanced reversing voucher, LEDGER_ADJUSTMENT debits the supplier ledger", async () => {
    findByIdMock.mockResolvedValueOnce(purchaseReturnRow()).mockResolvedValueOnce(purchaseReturnRow());

    await purchaseReturnService.postPurchaseReturn(RETURN_ID);

    expect(ensureSequenceMock).toHaveBeenCalledWith(COMPANY_ID, FY_ID, "PURCHASE_RETURN");
    expect(ensureSequenceMock).toHaveBeenCalledWith(COMPANY_ID, FY_ID, "PURCHASE_RETURN_VOUCHER");
    expect(generateNumberMock).toHaveBeenCalledWith(FAKE_TX, {
      companyId: COMPANY_ID,
      financialYearId: FY_ID,
      documentType: "PURCHASE_RETURN",
    });

    expect(recordMovementsMock).toHaveBeenCalledWith(
      COMPANY_ID,
      [expect.objectContaining({ productId: PRODUCT_ID, direction: "OUT", transactionType: "PURCHASE_RETURN" })],
      FAKE_TX
    );

    expect(postVoucherMock).toHaveBeenCalledWith(
      COMPANY_ID,
      expect.objectContaining({ voucherType: "PURCHASE_RETURN", referenceType: "PURCHASE_RETURN" }),
      FAKE_TX
    );
    const entries = postVoucherMock.mock.calls[0][1].entries;
    // 200 taxable + 18 CGST + 18 SGST = 236, all CREDIT, single DEBIT to the supplier ledger.
    expect(entries).toEqual(
      expect.arrayContaining([
        { ledgerId: PURCHASE_LEDGER_ID, entryType: "CREDIT", amount: 200 },
        { ledgerId: INPUT_CGST_LEDGER_ID, entryType: "CREDIT", amount: 18 },
        { ledgerId: INPUT_SGST_LEDGER_ID, entryType: "CREDIT", amount: 18 },
        { ledgerId: SUPPLIER_LEDGER_ID, entryType: "DEBIT", amount: 236 },
      ])
    );

    expect(replaceItemsAndPostMock).toHaveBeenCalledWith(
      FAKE_TX,
      RETURN_ID,
      COMPANY_ID,
      expect.objectContaining({ grandTotal: 236 }),
      expect.any(Array),
      { documentSequenceId: "seq-1", number: 1, formatted: "PRET-0001" },
      VOUCHER_ID
    );
  });

  it("CASH_REFUND debits the refund ledger instead of the supplier ledger", async () => {
    const row = purchaseReturnRow({ refundMode: "CASH_REFUND", refundLedgerId: REFUND_LEDGER_ID, paymentModeId: PAYMENT_MODE_ID });
    findByIdMock.mockResolvedValueOnce(row).mockResolvedValueOnce(row);

    await purchaseReturnService.postPurchaseReturn(RETURN_ID);

    const entries = postVoucherMock.mock.calls[0][1].entries;
    expect(entries).toEqual(expect.arrayContaining([{ ledgerId: REFUND_LEDGER_ID, entryType: "DEBIT", amount: 236 }]));
    expect(entries.some((e: { ledgerId: string }) => e.ledgerId === SUPPLIER_LEDGER_ID)).toBe(false);
  });

  // Code review finding: posting must re-validate the payment mode against
  // the refund ledger INSIDE the same transaction as the rest of posting
  // (FAKE_TX), never through the outside-transaction global `prisma` —
  // mirrors sales-return-service.test.ts's identical assertion.
  it("validates the payment mode against the refund ledger using the posting transaction, not the global prisma client", async () => {
    const row = purchaseReturnRow({ refundMode: "CASH_REFUND", refundLedgerId: REFUND_LEDGER_ID, paymentModeId: PAYMENT_MODE_ID });
    findByIdMock.mockResolvedValueOnce(row).mockResolvedValueOnce(row);

    await purchaseReturnService.postPurchaseReturn(RETURN_ID);

    expect(assertPaymentModeMatchesLedgerMock).toHaveBeenCalledWith(FAKE_TX, PAYMENT_MODE_ID, REFUND_LEDGER_ID, COMPANY_ID);
  });

  it("re-validates returnable quantity inside the posting transaction (concurrency guard)", async () => {
    findByIdMock.mockResolvedValueOnce(purchaseReturnRow()).mockResolvedValueOnce(purchaseReturnRow());
    // A concurrent POSTED sibling consumed the remaining capacity between
    // draft creation and this post — the fresh re-check inside the
    // transaction must catch it.
    sumPostedReturnedQuantitiesMock.mockResolvedValueOnce(new Map([[ITEM_ID, 9]]));

    await expect(purchaseReturnService.postPurchaseReturn(RETURN_ID)).rejects.toThrow(
      "exceed the remaining returnable quantity"
    );
    expect(postVoucherMock).not.toHaveBeenCalled();
  });

  it("rejects posting when the source invoice was cancelled since this return was drafted", async () => {
    findByIdMock.mockResolvedValueOnce(purchaseReturnRow()).mockResolvedValueOnce(purchaseReturnRow());
    findPurchaseInvoiceForReturnMock.mockResolvedValue(invoiceForReturn({ status: "CANCELLED" }));

    await expect(purchaseReturnService.postPurchaseReturn(RETURN_ID)).rejects.toThrow(
      "Only a posted purchase invoice can be returned against."
    );
    expect(postVoucherMock).not.toHaveBeenCalled();
  });

  it("rejects posting when a CASH_REFUND's refundLedgerId was deactivated in the meantime", async () => {
    const row = purchaseReturnRow({ refundMode: "CASH_REFUND", refundLedgerId: REFUND_LEDGER_ID, paymentModeId: PAYMENT_MODE_ID });
    findByIdMock.mockResolvedValueOnce(row).mockResolvedValueOnce(row);
    findRefundLedgerForReturnMock.mockResolvedValueOnce(ledgerInfo(REFUND_LEDGER_ID, CASH_GROUP_ID, { isActive: false }));

    await expect(purchaseReturnService.postPurchaseReturn(RETURN_ID)).rejects.toThrow("inactive");
    expect(postVoucherMock).not.toHaveBeenCalled();
  });

  it.each([
    ["purchaseLedgerId", "Purchase Account"],
    ["inputCgstLedgerId", "Input CGST"],
    ["inputSgstLedgerId", "Input SGST"],
    ["inputIgstLedgerId", "Input IGST"],
    ["inputCessLedgerId", "Input Cess"],
    ["roundOffLedgerId", "Round Off"],
  ])("rejects posting when %s is missing, naming %s", async (field, label) => {
    findByIdMock.mockResolvedValueOnce(purchaseReturnRow()).mockResolvedValueOnce(purchaseReturnRow());
    getSettingsMock.mockResolvedValueOnce({ ...COMPLETE_SETTINGS, [field]: null });
    await expect(purchaseReturnService.postPurchaseReturn(RETURN_ID)).rejects.toThrow(label);
    expect(postVoucherMock).not.toHaveBeenCalled();
  });

  it.each([
    ["purchaseLedgerId", "Purchase Account"],
    ["inputCgstLedgerId", "Input CGST"],
    ["inputSgstLedgerId", "Input SGST"],
    ["inputIgstLedgerId", "Input IGST"],
    ["inputCessLedgerId", "Input Cess"],
  ])("rejects posting when %s points at the wrong ledger group", async (field, label) => {
    findByIdMock.mockResolvedValueOnce(purchaseReturnRow()).mockResolvedValueOnce(purchaseReturnRow());
    const wrongGroupLedgerId = "30000000-0000-4000-8000-000000000099";
    getSettingsMock.mockResolvedValueOnce({ ...COMPLETE_SETTINGS, [field]: wrongGroupLedgerId });
    findLedgersForValidationMock.mockImplementationOnce(async (_client: unknown, ids: readonly string[]) =>
      ids.map((id) => (id === wrongGroupLedgerId ? ledgerInfo(wrongGroupLedgerId, OTHER_GROUP_ID) : LEDGERS_BY_ID[id])).filter(Boolean)
    );
    await expect(purchaseReturnService.postPurchaseReturn(RETURN_ID)).rejects.toThrow(label);
    expect(postVoucherMock).not.toHaveBeenCalled();
  });

  it("rejects posting when a mapped ledger is inactive", async () => {
    findByIdMock.mockResolvedValueOnce(purchaseReturnRow()).mockResolvedValueOnce(purchaseReturnRow());
    findLedgersForValidationMock.mockImplementationOnce(async (_client: unknown, ids: readonly string[]) =>
      ids
        .map((id) => (id === PURCHASE_LEDGER_ID ? { ...LEDGERS_BY_ID[id], isActive: false } : LEDGERS_BY_ID[id]))
        .filter(Boolean)
    );
    await expect(purchaseReturnService.postPurchaseReturn(RETURN_ID)).rejects.toThrow("is inactive");
    expect(postVoucherMock).not.toHaveBeenCalled();
  });

  it("rejects posting when a mapped ledger belongs to a different company", async () => {
    findByIdMock.mockResolvedValueOnce(purchaseReturnRow()).mockResolvedValueOnce(purchaseReturnRow());
    findLedgersForValidationMock.mockImplementationOnce(async (_client: unknown, ids: readonly string[]) =>
      ids
        .map((id) => (id === PURCHASE_LEDGER_ID ? { ...LEDGERS_BY_ID[id], companyId: OTHER_COMPANY_ID } : LEDGERS_BY_ID[id]))
        .filter(Boolean)
    );
    await expect(purchaseReturnService.postPurchaseReturn(RETURN_ID)).rejects.toThrow("invalid");
    expect(postVoucherMock).not.toHaveBeenCalled();
  });

  it("rejects posting a non-DRAFT return", async () => {
    findByIdMock.mockResolvedValueOnce(purchaseReturnRow({ status: "POSTED" }));
    await expect(purchaseReturnService.postPurchaseReturn(RETURN_ID)).rejects.toThrow("can no longer be posted");
  });

  it("rejects when the return belongs to a different company", async () => {
    findByIdMock.mockResolvedValueOnce(purchaseReturnRow({ companyId: OTHER_COMPANY_ID }));
    await expect(purchaseReturnService.postPurchaseReturn(RETURN_ID)).rejects.toThrow("Purchase return not found.");
  });

  it("gates posting on the approve permission", async () => {
    findByIdMock.mockResolvedValueOnce(purchaseReturnRow()).mockResolvedValueOnce(purchaseReturnRow());
    await purchaseReturnService.postPurchaseReturn(RETURN_ID);
    expect(assertPermissionMock).toHaveBeenCalledWith(CURRENT_USER, "purchase", "approve");
  });
});

describe("cancelPurchaseReturn", () => {
  it("reverses the voucher and stock (direction IN, undoing the earlier OUT) atomically, both on the same tx", async () => {
    const posted = purchaseReturnRow({ status: "POSTED", voucherId: VOUCHER_ID, returnNumber: "PRET-0001" });
    findByIdMock.mockResolvedValueOnce(posted).mockResolvedValueOnce(posted);
    updateStatusMock.mockResolvedValueOnce(1);
    findByIdMock.mockResolvedValueOnce(purchaseReturnRow({ status: "CANCELLED", voucherId: VOUCHER_ID }));

    await purchaseReturnService.cancelPurchaseReturn(RETURN_ID);

    expect(cancelVoucherMock).toHaveBeenCalledWith(COMPANY_ID, VOUCHER_ID, FAKE_TX);
    expect(recordMovementsMock).toHaveBeenCalledWith(
      COMPANY_ID,
      [expect.objectContaining({ productId: PRODUCT_ID, direction: "IN", transactionType: "PURCHASE_RETURN" })],
      FAKE_TX
    );
    expect(updateStatusMock).toHaveBeenCalledWith(FAKE_TX, RETURN_ID, COMPANY_ID, ["POSTED"], "CANCELLED");
  });

  it("an injected failure in the stock reversal prevents the status flip (single-transaction atomicity)", async () => {
    const posted = purchaseReturnRow({ status: "POSTED", voucherId: VOUCHER_ID });
    findByIdMock.mockResolvedValueOnce(posted).mockResolvedValueOnce(posted);
    recordMovementsMock.mockRejectedValueOnce(new Error("stock reversal failed"));

    await expect(purchaseReturnService.cancelPurchaseReturn(RETURN_ID)).rejects.toThrow("stock reversal failed");
    expect(updateStatusMock).not.toHaveBeenCalled();
  });

  it("rejects cancelling a DRAFT return", async () => {
    findByIdMock.mockResolvedValueOnce(purchaseReturnRow({ status: "DRAFT" }));
    await expect(purchaseReturnService.cancelPurchaseReturn(RETURN_ID)).rejects.toThrow(
      "Only a posted purchase return can be cancelled."
    );
  });

  it("rejects when a concurrent cancellation already won the race", async () => {
    const posted = purchaseReturnRow({ status: "POSTED", voucherId: VOUCHER_ID });
    findByIdMock.mockResolvedValueOnce(posted).mockResolvedValueOnce(posted);
    updateStatusMock.mockResolvedValueOnce(0);
    await expect(purchaseReturnService.cancelPurchaseReturn(RETURN_ID)).rejects.toThrow(
      "Only a posted purchase return can be cancelled."
    );
  });

  it("gates on the approve permission", async () => {
    const posted = purchaseReturnRow({ status: "POSTED", voucherId: VOUCHER_ID });
    findByIdMock.mockResolvedValueOnce(posted).mockResolvedValueOnce(posted);
    updateStatusMock.mockResolvedValueOnce(1);
    findByIdMock.mockResolvedValueOnce(purchaseReturnRow({ status: "CANCELLED" }));
    await purchaseReturnService.cancelPurchaseReturn(RETURN_ID);
    expect(assertPermissionMock).toHaveBeenCalledWith(CURRENT_USER, "purchase", "approve");
  });
});

describe("getPurchaseReturn / listPurchaseReturns — cross-company and scoping", () => {
  it("getPurchaseReturn returns null for a cross-company return", async () => {
    findByIdMock.mockResolvedValueOnce(purchaseReturnRow({ companyId: OTHER_COMPANY_ID }));
    await expect(purchaseReturnService.getPurchaseReturn(RETURN_ID)).resolves.toBeNull();
  });

  it("listPurchaseReturns returns [] with no active financial year", async () => {
    getCurrentFinancialYearMock.mockResolvedValueOnce(null);
    const result = await purchaseReturnService.listPurchaseReturns();
    expect(result).toEqual([]);
    expect(findManyMock).not.toHaveBeenCalled();
  });
});

// 69-purchase-reports.md's Purchase Return Summary calls this instead of
// listPurchaseReturns — mirrors sales-return-service.test.ts's own
// `listSalesReturnsForReport` coverage; the only difference from its
// purchase:view-gated sibling is which permission it checks.
describe("listPurchaseReturnsForReport", () => {
  it("gates on reports:view, not purchase:view", async () => {
    await purchaseReturnService.listPurchaseReturnsForReport();
    expect(assertPermissionMock).toHaveBeenCalledWith(expect.anything(), "reports", "view");
  });

  it("returns [] with no active financial year, without calling the repository", async () => {
    getCurrentFinancialYearMock.mockResolvedValueOnce(null);
    const result = await purchaseReturnService.listPurchaseReturnsForReport();
    expect(result).toEqual([]);
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it("delegates to purchaseReturnRepository.findMany scoped to the caller's company + active financial year", async () => {
    findManyMock.mockResolvedValueOnce([]);
    await purchaseReturnService.listPurchaseReturnsForReport({ status: "POSTED" });
    expect(findManyMock).toHaveBeenCalledWith(COMPANY_ID, FY_ID, { status: "POSTED" });
  });
});

describe("getReturnableInvoice", () => {
  it("returns null for a non-POSTED invoice", async () => {
    findPurchaseInvoiceForReturnMock.mockResolvedValueOnce(invoiceForReturn({ status: "DRAFT" }));
    await expect(purchaseReturnService.getReturnableInvoice(INVOICE_ID)).resolves.toBeNull();
  });

  it("computes returnable quantity as original minus already-returned", async () => {
    sumPostedReturnedQuantitiesMock.mockResolvedValueOnce(new Map([[ITEM_ID, 3]]));
    const result = await purchaseReturnService.getReturnableInvoice(INVOICE_ID);
    expect(result?.lines[0]).toEqual(
      expect.objectContaining({ originalQuantity: 10, returnedQuantity: 3, returnableQuantity: 7 })
    );
  });
});
