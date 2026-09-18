import { beforeEach, describe, expect, it, vi } from "vitest";

// Mirrors sales-invoice-service.test.ts's convention — mock the
// module-boundary repository, sibling services/engines, and the session/
// permission/Prisma boundaries.
const {
  findManyMock,
  findByIdMock,
  createMock,
  replaceItemsAndUpdateMock,
  replaceItemsAndPostMock,
  updateStatusMock,
  findSalesInvoiceForReturnMock,
  sumPostedReturnedQuantitiesMock,
  findRefundLedgerForReturnMock,
  findCustomerLedgerIdMock,
  findSelectableRefundLedgersMock,
  findPostedInvoicesForPickerMock,
  getCurrentCompanyUserMock,
  getCurrentFinancialYearMock,
  assertPermissionMock,
  ensureSequenceMock,
  generateNumberMock,
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
  findSalesInvoiceForReturnMock: vi.fn(),
  sumPostedReturnedQuantitiesMock: vi.fn(),
  findRefundLedgerForReturnMock: vi.fn(),
  findCustomerLedgerIdMock: vi.fn(),
  findSelectableRefundLedgersMock: vi.fn(),
  findPostedInvoicesForPickerMock: vi.fn(),
  getCurrentCompanyUserMock: vi.fn(),
  getCurrentFinancialYearMock: vi.fn(),
  assertPermissionMock: vi.fn(),
  ensureSequenceMock: vi.fn(),
  generateNumberMock: vi.fn(),
  getSettingsMock: vi.fn(),
  postVoucherMock: vi.fn(),
  cancelVoucherMock: vi.fn(),
  recordMovementsMock: vi.fn(),
  assertPaymentModeMatchesLedgerMock: vi.fn(),
  FAKE_TX: { marker: "fake-tx" },
}));

vi.mock("@/modules/sales-returns/repositories/sales-return-repository", () => ({
  salesReturnRepository: {
    findMany: findManyMock,
    findById: findByIdMock,
    create: createMock,
    replaceItemsAndUpdate: replaceItemsAndUpdateMock,
    replaceItemsAndPost: replaceItemsAndPostMock,
    updateStatus: updateStatusMock,
    findSalesInvoiceForReturn: findSalesInvoiceForReturnMock,
    sumPostedReturnedQuantities: sumPostedReturnedQuantitiesMock,
    findRefundLedgerForReturn: findRefundLedgerForReturnMock,
    findCustomerLedgerId: findCustomerLedgerIdMock,
    findSelectableRefundLedgers: findSelectableRefundLedgersMock,
    findPostedInvoicesForPicker: findPostedInvoicesForPickerMock,
  },
}));

vi.mock("@/lib/current-user", () => ({ getCurrentCompanyUser: getCurrentCompanyUserMock }));
vi.mock("@/lib/current-financial-year", () => ({ getCurrentFinancialYear: getCurrentFinancialYearMock }));
vi.mock("@/lib/permissions", () => ({ assertPermission: assertPermissionMock }));

vi.mock("@/engines/document-number/document-number-engine", () => ({
  documentNumberEngine: { ensureSequence: ensureSequenceMock, generateNumber: generateNumberMock },
}));

vi.mock("@/engines/voucher/voucher-engine", () => ({
  voucherEngine: { postVoucher: postVoucherMock, cancelVoucher: cancelVoucherMock },
}));
vi.mock("@/engines/inventory/inventory-engine", () => ({
  inventoryEngine: { recordMovements: recordMovementsMock },
}));

vi.mock("@/modules/company/services/company-settings-service", () => ({
  companySettingsService: { getSettings: getSettingsMock },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: (fn: (tx: unknown) => unknown) => fn(FAKE_TX) },
}));
vi.mock("@/lib/payment-mode-validation", () => ({ assertPaymentModeMatchesLedger: assertPaymentModeMatchesLedgerMock }));

import { AppError } from "@/lib/app-error";
import { prisma } from "@/lib/prisma";
import { salesReturnService } from "@/modules/sales-returns/services/sales-return-service";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_COMPANY_ID = "99999999-9999-4999-8999-999999999999";
const FY_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";
const CUSTOMER_ID = "44444444-4444-4444-8444-444444444444";
const CUSTOMER_LEDGER_ID = "55555555-5555-4555-8555-555555555555";
const PRODUCT_ID = "66666666-6666-4666-8666-666666666666";
const WAREHOUSE_ID = "77777777-7777-4777-8777-777777777777";
const INVOICE_ID = "88888888-8888-4888-8888-888888888888";
const ITEM_ID = "99999999-9999-4999-8999-999999999999";
const REFUND_LEDGER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const VOUCHER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PAYMENT_MODE_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const RETURN_ID = "ret-1";

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

const COMPLETE_SETTINGS = {
  salesLedgerId: "s1111111-1111-4111-8111-111111111111",
  outputCgstLedgerId: "c1111111-1111-4111-8111-111111111111",
  outputSgstLedgerId: "g1111111-1111-4111-8111-111111111111",
  outputIgstLedgerId: "i1111111-1111-4111-8111-111111111111",
  outputCessLedgerId: "e1111111-1111-4111-8111-111111111111",
  roundOffLedgerId: "r1111111-1111-4111-8111-111111111111",
};

// quantity 10 x rate 100 = 1000 taxable, 18% intra-state = 90 CGST + 90 SGST.
function invoiceForReturn(overrides: Record<string, unknown> = {}) {
  return {
    id: INVOICE_ID,
    companyId: COMPANY_ID,
    financialYearId: FY_ID,
    invoiceNumber: "INV-0001",
    invoiceDate: new Date("2026-09-01T00:00:00.000Z"),
    status: "POSTED",
    customerMode: "PERMANENT",
    customerId: CUSTOMER_ID,
    customerName: "Acme Co",
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
function salesReturnRow(overrides: Record<string, unknown> = {}) {
  return {
    id: RETURN_ID,
    companyId: COMPANY_ID,
    financialYearId: FY_ID,
    returnNumber: null,
    returnDate: new Date("2026-09-10T00:00:00.000Z"),
    salesInvoiceId: INVOICE_ID,
    salesInvoice: {
      id: INVOICE_ID,
      invoiceNumber: "INV-0001",
      invoiceDate: new Date("2026-09-01T00:00:00.000Z"),
      customerMode: "PERMANENT",
      customerId: CUSTOMER_ID,
      customerName: "Acme Co",
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
        salesReturnId: RETURN_ID,
        lineNumber: 1,
        salesInvoiceItemId: ITEM_ID,
        salesInvoiceItem: {
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
    salesInvoiceId: INVOICE_ID,
    returnDate: "2026-09-10",
    lines: [{ salesInvoiceItemId: ITEM_ID, quantity: 2 }],
    ...overrides,
  };
}

beforeEach(() => {
  findManyMock.mockReset();
  findByIdMock.mockReset();
  createMock.mockReset();
  replaceItemsAndUpdateMock.mockReset();
  replaceItemsAndPostMock.mockReset();
  updateStatusMock.mockReset();
  findSalesInvoiceForReturnMock.mockReset();
  sumPostedReturnedQuantitiesMock.mockReset();
  findRefundLedgerForReturnMock.mockReset();
  findCustomerLedgerIdMock.mockReset();
  findSelectableRefundLedgersMock.mockReset();
  findPostedInvoicesForPickerMock.mockReset();
  getCurrentCompanyUserMock.mockReset();
  getCurrentFinancialYearMock.mockReset();
  assertPermissionMock.mockReset();
  ensureSequenceMock.mockReset();
  generateNumberMock.mockReset();
  getSettingsMock.mockReset();
  postVoucherMock.mockReset();
  cancelVoucherMock.mockReset();
  recordMovementsMock.mockReset();
  assertPaymentModeMatchesLedgerMock.mockReset();

  getCurrentCompanyUserMock.mockResolvedValue(CURRENT_USER);
  getCurrentFinancialYearMock.mockResolvedValue(CURRENT_FY);
  assertPermissionMock.mockResolvedValue(undefined);
  assertPaymentModeMatchesLedgerMock.mockResolvedValue(undefined);
  findSalesInvoiceForReturnMock.mockResolvedValue(invoiceForReturn());
  sumPostedReturnedQuantitiesMock.mockResolvedValue(new Map());
  findCustomerLedgerIdMock.mockResolvedValue(CUSTOMER_LEDGER_ID);
  findRefundLedgerForReturnMock.mockResolvedValue({ id: REFUND_LEDGER_ID, companyId: COMPANY_ID, isActive: true });
  getSettingsMock.mockResolvedValue(COMPLETE_SETTINGS);
  generateNumberMock.mockResolvedValue({ documentSequenceId: "seq-1", number: 1, formatted: "SR-0001" });
  createMock.mockResolvedValue(salesReturnRow());
  postVoucherMock.mockResolvedValue({ id: VOUCHER_ID });
  recordMovementsMock.mockResolvedValue([]);
  replaceItemsAndPostMock.mockResolvedValue(salesReturnRow({ status: "POSTED", voucherId: VOUCHER_ID, returnNumber: "SR-0001" }));
});

describe("createDraft", () => {
  it("creates a DRAFT return with returnNumber untouched (numbering deferred to posting)", async () => {
    await salesReturnService.createDraft(validInput());
    expect(ensureSequenceMock).not.toHaveBeenCalled();
    expect(generateNumberMock).not.toHaveBeenCalled();
    expect(createMock).toHaveBeenCalledWith(
      FAKE_TX,
      COMPANY_ID,
      FY_ID,
      expect.objectContaining({ salesInvoiceId: INVOICE_ID, refundMode: "LEDGER_ADJUSTMENT", grandTotal: 236 }),
      [expect.objectContaining({ salesInvoiceItemId: ITEM_ID, quantity: 2, taxableAmount: 200, cgst: 18, sgst: 18 })],
      USER_ID
    );
  });

  it("rejects when the source invoice is not POSTED", async () => {
    findSalesInvoiceForReturnMock.mockResolvedValueOnce(invoiceForReturn({ status: "DRAFT" }));
    await expect(salesReturnService.createDraft(validInput())).rejects.toThrow(
      "Only a posted sales invoice can be returned against."
    );
  });

  it("rejects when the source invoice does not belong to this company", async () => {
    findSalesInvoiceForReturnMock.mockResolvedValueOnce(null);
    await expect(salesReturnService.createDraft(validInput())).rejects.toThrow("Sales invoice not found.");
  });

  it("rejects a return date before the invoice date", async () => {
    await expect(salesReturnService.createDraft(validInput({ returnDate: "2026-08-01" }))).rejects.toThrow(
      "Return date cannot be before the invoice date."
    );
  });

  it("rejects a line quantity exceeding the remaining returnable quantity", async () => {
    sumPostedReturnedQuantitiesMock.mockResolvedValueOnce(new Map([[ITEM_ID, 9]]));
    await expect(salesReturnService.createDraft(validInput({ lines: [{ salesInvoiceItemId: ITEM_ID, quantity: 2 }] }))).rejects.toThrow(
      "exceed the remaining returnable quantity"
    );
  });

  it("caps correctly across two sequential partial returns (returnable shrinks after a POSTED sibling)", async () => {
    sumPostedReturnedQuantitiesMock.mockResolvedValueOnce(new Map([[ITEM_ID, 6]]));
    // 10 - 6 = 4 remaining; requesting 4 succeeds.
    await salesReturnService.createDraft(validInput({ lines: [{ salesInvoiceItemId: ITEM_ID, quantity: 4 }] }));
    expect(createMock).toHaveBeenCalled();
  });

  it("rejects a line referencing an item that doesn't belong to the invoice", async () => {
    const unrelatedItemId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    await expect(
      salesReturnService.createDraft(validInput({ lines: [{ salesInvoiceItemId: unrelatedItemId, quantity: 1 }] }))
    ).rejects.toThrow("does not belong to the selected sales invoice");
  });

  it("every rejection is an AppError", async () => {
    findSalesInvoiceForReturnMock.mockResolvedValueOnce(null);
    await expect(salesReturnService.createDraft(validInput())).rejects.toBeInstanceOf(AppError);
  });

  describe("WALK_IN-forces-CASH_REFUND rule", () => {
    it("forces CASH_REFUND when the source invoice has no customer ledger and refundMode is omitted", async () => {
      findSalesInvoiceForReturnMock.mockResolvedValue(invoiceForReturn({ customerMode: "WALK_IN", customerId: null }));
      await salesReturnService.createDraft(
        validInput({ refundMode: undefined, refundLedgerId: REFUND_LEDGER_ID, paymentModeId: PAYMENT_MODE_ID })
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

    it("rejects an explicit LEDGER_ADJUSTMENT for a WALK_IN-sourced return", async () => {
      findSalesInvoiceForReturnMock.mockResolvedValue(invoiceForReturn({ customerMode: "WALK_IN", customerId: null }));
      await expect(salesReturnService.createDraft(validInput({ refundMode: "LEDGER_ADJUSTMENT" }))).rejects.toThrow(
        "refund mode must be Cash Refund"
      );
    });

    it("requires a refundLedgerId once forced to CASH_REFUND", async () => {
      findSalesInvoiceForReturnMock.mockResolvedValue(invoiceForReturn({ customerMode: "WALK_IN", customerId: null }));
      await expect(salesReturnService.createDraft(validInput({ refundMode: undefined }))).rejects.toThrow(
        "Select a refund ledger for a cash refund."
      );
    });

    it("applies the same forcing to a never-converted QUICK invoice (no customerId, not just literal WALK_IN)", async () => {
      findSalesInvoiceForReturnMock.mockResolvedValue(invoiceForReturn({ customerMode: "QUICK", customerId: null }));
      await salesReturnService.createDraft(
        validInput({ refundMode: undefined, refundLedgerId: REFUND_LEDGER_ID, paymentModeId: PAYMENT_MODE_ID })
      );
      expect(createMock).toHaveBeenCalledWith(
        FAKE_TX,
        COMPANY_ID,
        FY_ID,
        expect.objectContaining({ refundMode: "CASH_REFUND" }),
        expect.any(Array),
        USER_ID
      );
    });

    it("rejects an inactive refund ledger", async () => {
      findRefundLedgerForReturnMock.mockResolvedValueOnce({ id: REFUND_LEDGER_ID, companyId: COMPANY_ID, isActive: false });
      await expect(
        salesReturnService.createDraft(
          validInput({ refundMode: "CASH_REFUND", refundLedgerId: REFUND_LEDGER_ID, paymentModeId: PAYMENT_MODE_ID })
        )
      ).rejects.toThrow("inactive");
    });

    // Code review finding: verify assertPaymentModeMatchesLedger is
    // validated against the global `prisma` singleton at draft-save time —
    // the counterpart posting-time assertion below confirms the
    // transaction-scoped `tx` is used instead.
    it("validates the payment mode against the refund ledger using the global prisma client, not a transaction", async () => {
      await salesReturnService.createDraft(
        validInput({ refundMode: "CASH_REFUND", refundLedgerId: REFUND_LEDGER_ID, paymentModeId: PAYMENT_MODE_ID })
      );
      expect(assertPaymentModeMatchesLedgerMock).toHaveBeenCalledWith(prisma, PAYMENT_MODE_ID, REFUND_LEDGER_ID, COMPANY_ID);
    });
  });
});

describe("postSalesReturn — orchestration and ledger entries", () => {
  it("posts: generates returnNumber, records IN stock, posts a balanced reversing voucher, LEDGER_ADJUSTMENT credits the customer ledger", async () => {
    findByIdMock.mockResolvedValueOnce(salesReturnRow()).mockResolvedValueOnce(salesReturnRow());

    await salesReturnService.postSalesReturn(RETURN_ID);

    expect(ensureSequenceMock).toHaveBeenCalledWith(COMPANY_ID, FY_ID, "SALES_RETURN");
    expect(ensureSequenceMock).toHaveBeenCalledWith(COMPANY_ID, FY_ID, "SALES_RETURN_VOUCHER");
    expect(generateNumberMock).toHaveBeenCalledWith(FAKE_TX, { companyId: COMPANY_ID, financialYearId: FY_ID, documentType: "SALES_RETURN" });

    expect(recordMovementsMock).toHaveBeenCalledWith(
      COMPANY_ID,
      [expect.objectContaining({ productId: PRODUCT_ID, direction: "IN", transactionType: "SALES_RETURN" })],
      FAKE_TX
    );

    expect(postVoucherMock).toHaveBeenCalledWith(
      COMPANY_ID,
      expect.objectContaining({ voucherType: "SALES_RETURN", referenceType: "SALES_RETURN" }),
      FAKE_TX
    );
    const entries = postVoucherMock.mock.calls[0][1].entries;
    // 200 taxable + 18 CGST + 18 SGST = 236, all DEBIT, single CREDIT to the customer ledger.
    expect(entries).toEqual(
      expect.arrayContaining([
        { ledgerId: COMPLETE_SETTINGS.salesLedgerId, entryType: "DEBIT", amount: 200 },
        { ledgerId: COMPLETE_SETTINGS.outputCgstLedgerId, entryType: "DEBIT", amount: 18 },
        { ledgerId: COMPLETE_SETTINGS.outputSgstLedgerId, entryType: "DEBIT", amount: 18 },
        { ledgerId: CUSTOMER_LEDGER_ID, entryType: "CREDIT", amount: 236 },
      ])
    );

    expect(replaceItemsAndPostMock).toHaveBeenCalledWith(
      FAKE_TX,
      RETURN_ID,
      COMPANY_ID,
      expect.objectContaining({ grandTotal: 236 }),
      expect.any(Array),
      { documentSequenceId: "seq-1", number: 1, formatted: "SR-0001" },
      VOUCHER_ID
    );
  });

  it("CASH_REFUND credits the refund ledger instead of the customer ledger", async () => {
    const row = salesReturnRow({ refundMode: "CASH_REFUND", refundLedgerId: REFUND_LEDGER_ID, paymentModeId: PAYMENT_MODE_ID });
    findByIdMock.mockResolvedValueOnce(row).mockResolvedValueOnce(row);

    await salesReturnService.postSalesReturn(RETURN_ID);

    const entries = postVoucherMock.mock.calls[0][1].entries;
    expect(entries).toEqual(expect.arrayContaining([{ ledgerId: REFUND_LEDGER_ID, entryType: "CREDIT", amount: 236 }]));
    expect(entries.some((e: { ledgerId: string }) => e.ledgerId === CUSTOMER_LEDGER_ID)).toBe(false);
  });

  // Code review finding: posting must re-validate the payment mode against
  // the refund ledger INSIDE the posting transaction (FAKE_TX), never the
  // outside-transaction global `prisma`.
  it("validates the payment mode against the refund ledger using the posting transaction, not the global prisma client", async () => {
    const row = salesReturnRow({ refundMode: "CASH_REFUND", refundLedgerId: REFUND_LEDGER_ID, paymentModeId: PAYMENT_MODE_ID });
    findByIdMock.mockResolvedValueOnce(row).mockResolvedValueOnce(row);

    await salesReturnService.postSalesReturn(RETURN_ID);

    expect(assertPaymentModeMatchesLedgerMock).toHaveBeenCalledWith(FAKE_TX, PAYMENT_MODE_ID, REFUND_LEDGER_ID, COMPANY_ID);
  });

  it("re-validates returnable quantity inside the posting transaction (concurrency guard)", async () => {
    findByIdMock.mockResolvedValueOnce(salesReturnRow()).mockResolvedValueOnce(salesReturnRow());
    // A concurrent POSTED sibling consumed the remaining capacity between
    // draft creation and this post — the fresh re-check inside the
    // transaction must catch it.
    sumPostedReturnedQuantitiesMock.mockResolvedValueOnce(new Map([[ITEM_ID, 9]]));

    await expect(salesReturnService.postSalesReturn(RETURN_ID)).rejects.toThrow("exceed the remaining returnable quantity");
    expect(postVoucherMock).not.toHaveBeenCalled();
  });

  it("rejects posting when the source invoice was cancelled since this return was drafted", async () => {
    findByIdMock.mockResolvedValueOnce(salesReturnRow()).mockResolvedValueOnce(salesReturnRow());
    findSalesInvoiceForReturnMock.mockResolvedValue(invoiceForReturn({ status: "CANCELLED" }));

    await expect(salesReturnService.postSalesReturn(RETURN_ID)).rejects.toThrow(
      "Only a posted sales invoice can be returned against."
    );
    expect(postVoucherMock).not.toHaveBeenCalled();
  });

  it("rejects posting when a CASH_REFUND's refundLedgerId was deactivated in the meantime", async () => {
    const row = salesReturnRow({ refundMode: "CASH_REFUND", refundLedgerId: REFUND_LEDGER_ID, paymentModeId: PAYMENT_MODE_ID });
    findByIdMock.mockResolvedValueOnce(row).mockResolvedValueOnce(row);
    findRefundLedgerForReturnMock.mockResolvedValueOnce({ id: REFUND_LEDGER_ID, companyId: COMPANY_ID, isActive: false });

    await expect(salesReturnService.postSalesReturn(RETURN_ID)).rejects.toThrow("inactive");
    expect(postVoucherMock).not.toHaveBeenCalled();
  });

  it.each([
    ["salesLedgerId", "Sales Account"],
    ["outputCgstLedgerId", "Output CGST"],
    ["outputSgstLedgerId", "Output SGST"],
    ["outputIgstLedgerId", "Output IGST"],
    ["outputCessLedgerId", "Output Cess"],
    ["roundOffLedgerId", "Round Off"],
  ])("rejects posting when %s is not configured, naming %s", async (field, label) => {
    findByIdMock.mockResolvedValueOnce(salesReturnRow()).mockResolvedValueOnce(salesReturnRow());
    getSettingsMock.mockResolvedValueOnce({ ...COMPLETE_SETTINGS, [field]: null });
    await expect(salesReturnService.postSalesReturn(RETURN_ID)).rejects.toThrow(label);
    expect(postVoucherMock).not.toHaveBeenCalled();
  });

  it("rejects posting a non-DRAFT return", async () => {
    findByIdMock.mockResolvedValueOnce(salesReturnRow({ status: "POSTED" }));
    await expect(salesReturnService.postSalesReturn(RETURN_ID)).rejects.toThrow("can no longer be posted");
  });

  it("rejects when the return belongs to a different company", async () => {
    findByIdMock.mockResolvedValueOnce(salesReturnRow({ companyId: OTHER_COMPANY_ID }));
    await expect(salesReturnService.postSalesReturn(RETURN_ID)).rejects.toThrow("Sales return not found.");
  });

  it("gates posting on the approve permission", async () => {
    findByIdMock.mockResolvedValueOnce(salesReturnRow()).mockResolvedValueOnce(salesReturnRow());
    await salesReturnService.postSalesReturn(RETURN_ID);
    expect(assertPermissionMock).toHaveBeenCalledWith(CURRENT_USER, "sales", "approve");
  });
});

describe("cancelSalesReturn", () => {
  it("reverses the voucher and stock (direction OUT, undoing the earlier IN) atomically, both on the same tx", async () => {
    const posted = salesReturnRow({ status: "POSTED", voucherId: VOUCHER_ID, returnNumber: "SR-0001" });
    findByIdMock.mockResolvedValueOnce(posted).mockResolvedValueOnce(posted);
    updateStatusMock.mockResolvedValueOnce(1);
    findByIdMock.mockResolvedValueOnce(salesReturnRow({ status: "CANCELLED", voucherId: VOUCHER_ID }));

    await salesReturnService.cancelSalesReturn(RETURN_ID);

    expect(cancelVoucherMock).toHaveBeenCalledWith(COMPANY_ID, VOUCHER_ID, FAKE_TX);
    expect(recordMovementsMock).toHaveBeenCalledWith(
      COMPANY_ID,
      [expect.objectContaining({ productId: PRODUCT_ID, direction: "OUT", transactionType: "SALES_RETURN" })],
      FAKE_TX
    );
    expect(updateStatusMock).toHaveBeenCalledWith(FAKE_TX, RETURN_ID, COMPANY_ID, ["POSTED"], "CANCELLED");
  });

  it("rejects cancelling a DRAFT return", async () => {
    findByIdMock.mockResolvedValueOnce(salesReturnRow({ status: "DRAFT" }));
    await expect(salesReturnService.cancelSalesReturn(RETURN_ID)).rejects.toThrow(
      "Only a posted sales return can be cancelled."
    );
  });

  it("rejects when a concurrent cancellation already won the race", async () => {
    const posted = salesReturnRow({ status: "POSTED", voucherId: VOUCHER_ID });
    findByIdMock.mockResolvedValueOnce(posted).mockResolvedValueOnce(posted);
    updateStatusMock.mockResolvedValueOnce(0);
    await expect(salesReturnService.cancelSalesReturn(RETURN_ID)).rejects.toThrow(
      "Only a posted sales return can be cancelled."
    );
  });

  it("gates on the approve permission", async () => {
    const posted = salesReturnRow({ status: "POSTED", voucherId: VOUCHER_ID });
    findByIdMock.mockResolvedValueOnce(posted).mockResolvedValueOnce(posted);
    updateStatusMock.mockResolvedValueOnce(1);
    findByIdMock.mockResolvedValueOnce(salesReturnRow({ status: "CANCELLED" }));
    await salesReturnService.cancelSalesReturn(RETURN_ID);
    expect(assertPermissionMock).toHaveBeenCalledWith(CURRENT_USER, "sales", "approve");
  });
});

describe("getSalesReturn / listSalesReturns — cross-company and scoping", () => {
  it("getSalesReturn returns null for a cross-company return", async () => {
    findByIdMock.mockResolvedValueOnce(salesReturnRow({ companyId: OTHER_COMPANY_ID }));
    await expect(salesReturnService.getSalesReturn(RETURN_ID)).resolves.toBeNull();
  });

  it("listSalesReturns returns [] with no active financial year", async () => {
    getCurrentFinancialYearMock.mockResolvedValueOnce(null);
    const result = await salesReturnService.listSalesReturns();
    expect(result).toEqual([]);
    expect(findManyMock).not.toHaveBeenCalled();
  });
});

// 68-sales-reports.md's Sales Return Summary calls this method instead of
// listSalesReturns — the only difference is the permission it gates on.
describe("listSalesReturnsForReport", () => {
  it("gates on reports:view, not sales:view", async () => {
    await salesReturnService.listSalesReturnsForReport();
    expect(assertPermissionMock).toHaveBeenCalledWith(expect.anything(), "reports", "view");
  });

  it("returns [] with no active financial year, without calling the repository", async () => {
    getCurrentFinancialYearMock.mockResolvedValueOnce(null);
    const result = await salesReturnService.listSalesReturnsForReport();
    expect(result).toEqual([]);
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it("scopes the read to the caller's own company and active financial year", async () => {
    findManyMock.mockResolvedValueOnce([]);
    await salesReturnService.listSalesReturnsForReport({ status: "POSTED" });
    expect(findManyMock).toHaveBeenCalledWith(COMPANY_ID, FY_ID, { status: "POSTED" });
  });
});

describe("getReturnableInvoice", () => {
  it("returns null for a non-POSTED invoice", async () => {
    findSalesInvoiceForReturnMock.mockResolvedValueOnce(invoiceForReturn({ status: "DRAFT" }));
    await expect(salesReturnService.getReturnableInvoice(INVOICE_ID)).resolves.toBeNull();
  });

  it("computes returnable quantity as original minus already-returned", async () => {
    sumPostedReturnedQuantitiesMock.mockResolvedValueOnce(new Map([[ITEM_ID, 3]]));
    const result = await salesReturnService.getReturnableInvoice(INVOICE_ID);
    expect(result?.lines[0]).toEqual(
      expect.objectContaining({ originalQuantity: 10, returnedQuantity: 3, returnableQuantity: 7 })
    );
  });
});
