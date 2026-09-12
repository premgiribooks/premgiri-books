import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mirrors sales-invoice-service.test.ts's convention — mock the
// module-boundary repository, sibling services/engines, and the
// session/permission/Prisma boundaries. The GST Engine itself is left REAL
// so the engine-composition assertions are genuine.
const {
  findManyMock,
  findByIdMock,
  createMock,
  replaceItemsAndUpdateMock,
  replaceItemsAndPostMock,
  updateStatusMock,
  findSupplierForInvoiceMock,
  findProductsForLinesMock,
  findWarehousesForLinesMock,
  findInvoiceableProductsMock,
  findSelectableWarehousesMock,
  findCompanyStateCodeMock,
  findLedgersForValidationMock,
  findActiveLedgersForPaymentPickerMock,
  aggregateItemWisePurchasesMock,
  aggregatePartyWisePurchasesMock,
  getCurrentCompanyUserMock,
  getCurrentFinancialYearMock,
  assertPermissionMock,
  ensureSequenceMock,
  generateNumberMock,
  previewNextNumberMock,
  ledgerGroupFindManyMock,
  getSettingsMock,
  getGoodsReceiptNoteMock,
  markInvoicedMock,
  getPurchaseOrderMock,
  postVoucherMock,
  cancelVoucherMock,
  recordMovementsMock,
  FAKE_TX,
} = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  findByIdMock: vi.fn(),
  createMock: vi.fn(),
  replaceItemsAndUpdateMock: vi.fn(),
  replaceItemsAndPostMock: vi.fn(),
  updateStatusMock: vi.fn(),
  findSupplierForInvoiceMock: vi.fn(),
  findProductsForLinesMock: vi.fn(),
  findWarehousesForLinesMock: vi.fn(),
  findInvoiceableProductsMock: vi.fn(),
  findSelectableWarehousesMock: vi.fn(),
  findCompanyStateCodeMock: vi.fn(),
  findLedgersForValidationMock: vi.fn(),
  findActiveLedgersForPaymentPickerMock: vi.fn(),
  aggregateItemWisePurchasesMock: vi.fn(),
  aggregatePartyWisePurchasesMock: vi.fn(),
  getCurrentCompanyUserMock: vi.fn(),
  getCurrentFinancialYearMock: vi.fn(),
  assertPermissionMock: vi.fn(),
  ensureSequenceMock: vi.fn(),
  generateNumberMock: vi.fn(),
  previewNextNumberMock: vi.fn(),
  ledgerGroupFindManyMock: vi.fn(),
  getSettingsMock: vi.fn(),
  getGoodsReceiptNoteMock: vi.fn(),
  markInvoicedMock: vi.fn(),
  getPurchaseOrderMock: vi.fn(),
  postVoucherMock: vi.fn(),
  cancelVoucherMock: vi.fn(),
  recordMovementsMock: vi.fn(),
  FAKE_TX: { marker: "fake-tx" },
}));

vi.mock("@/modules/purchase-invoices/repositories/purchase-invoice-repository", () => ({
  purchaseInvoiceRepository: {
    findMany: findManyMock,
    findById: findByIdMock,
    create: createMock,
    replaceItemsAndUpdate: replaceItemsAndUpdateMock,
    replaceItemsAndPost: replaceItemsAndPostMock,
    updateStatus: updateStatusMock,
    findSupplierForInvoice: findSupplierForInvoiceMock,
    findProductsForLines: findProductsForLinesMock,
    findWarehousesForLines: findWarehousesForLinesMock,
    findInvoiceableProducts: findInvoiceableProductsMock,
    findSelectableWarehouses: findSelectableWarehousesMock,
    findCompanyStateCode: findCompanyStateCodeMock,
    findActiveLedgersForPaymentPicker: findActiveLedgersForPaymentPickerMock,
    aggregateItemWisePurchases: aggregateItemWisePurchasesMock,
    aggregatePartyWisePurchases: aggregatePartyWisePurchasesMock,
  },
}));

vi.mock("@/lib/current-user", () => ({ getCurrentCompanyUser: getCurrentCompanyUserMock }));
vi.mock("@/lib/current-financial-year", () => ({ getCurrentFinancialYear: getCurrentFinancialYearMock }));
vi.mock("@/lib/permissions", () => ({ assertPermission: assertPermissionMock }));

vi.mock("@/engines/document-number/document-number-engine", () => ({
  documentNumberEngine: {
    ensureSequence: ensureSequenceMock,
    generateNumber: generateNumberMock,
    previewNextNumber: previewNextNumberMock,
  },
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
// assertPurchaseLedgerMappingValid (moved to company/utils/purchase-ledger-mapping.ts
// so Purchase Return can share it) reads ledgers via ledgerRepository, not
// purchaseInvoiceRepository — reuses the same mock fn so every existing
// findLedgersForValidationMock setup below continues to drive both the
// ledger-mapping check and the payment-ledger check identically.
vi.mock("@/modules/ledgers/repositories/ledger-repository", () => ({
  ledgerRepository: { findLedgersForValidation: findLedgersForValidationMock },
}));
vi.mock("@/modules/goods-receipt-notes/services/goods-receipt-note-service", () => ({
  goodsReceiptNoteService: { getGoodsReceiptNote: getGoodsReceiptNoteMock, markInvoiced: markInvoicedMock },
}));
vi.mock("@/modules/purchase-orders/services/purchase-order-service", () => ({
  purchaseOrderService: { getPurchaseOrder: getPurchaseOrderMock },
}));
vi.mock("@/modules/company/services/company-settings-service", () => ({
  companySettingsService: { getSettings: getSettingsMock },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: (fn: (tx: unknown) => unknown) => fn(FAKE_TX) },
}));

import { AppError } from "@/lib/app-error";
import { purchaseInvoiceService } from "@/modules/purchase-invoices/services/purchase-invoice-service";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_COMPANY_ID = "99999999-9999-4999-8999-999999999999";
const FY_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";
const SUPPLIER_ID = "44444444-4444-4444-8444-444444444444";
const SUPPLIER_LEDGER_ID = "45454545-4545-4545-8545-454545454545";
const PRODUCT_ID = "55555555-5555-4555-8555-555555555555";
const WAREHOUSE_ID = "66666666-6666-4666-8666-666666666666";
const LEDGER_ID = "77777777-7777-4777-8777-777777777777";
const VOUCHER_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const GRN_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

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
const CASH_LEDGER_ID = "20000000-0000-4000-8000-000000000007";
const BANK_LEDGER_ID = "20000000-0000-4000-8000-000000000008";
const INVALID_PAYMENT_LEDGER_ID = "20000000-0000-4000-8000-000000000009";

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
  [CASH_LEDGER_ID]: ledgerInfo(CASH_LEDGER_ID, CASH_GROUP_ID),
  [BANK_LEDGER_ID]: ledgerInfo(BANK_LEDGER_ID, OTHER_GROUP_ID, { hasBankAccount: true }),
  [INVALID_PAYMENT_LEDGER_ID]: ledgerInfo(INVALID_PAYMENT_LEDGER_ID, OTHER_GROUP_ID),
};

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

const ACTIVE_SUPPLIER = { id: SUPPLIER_ID, companyId: COMPANY_ID, isActive: true, ledgerId: SUPPLIER_LEDGER_ID };

const PRODUCT = {
  id: PRODUCT_ID,
  name: "Product A",
  productCode: "A",
  isActive: true,
  unitSymbol: "Nos",
  unitDecimalPlaces: 0,
  hsnCode: "1234",
  hasGstRate: true,
  ratePercent: 18,
  cessPercent: 0,
  purchasePrice: 50,
};

const WAREHOUSE = { id: WAREHOUSE_ID, name: "Main Warehouse", code: "WH1", isActive: true };

function validLines() {
  return [{ productId: PRODUCT_ID, warehouseId: WAREHOUSE_ID, quantity: 2, rate: 100 }];
}

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    supplierId: SUPPLIER_ID,
    supplierInvoiceNumber: "SUP-INV-001",
    invoiceDate: "2026-09-10",
    placeOfSupplyStateCode: "27",
    lines: validLines(),
    payments: [],
    ...overrides,
  };
}

function invoiceRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "pinv-1",
    companyId: COMPANY_ID,
    financialYearId: FY_ID,
    invoiceNumber: null,
    supplierInvoiceNumber: "SUP-INV-001",
    status: "DRAFT",
    supplierId: SUPPLIER_ID,
    placeOfSupplyStateCode: "27",
    invoiceDate: new Date("2026-09-10T00:00:00.000Z"),
    narration: null,
    purchaseOrderId: null,
    goodsReceiptNoteId: null,
    voucherId: null,
    items: [
      {
        id: "item-1",
        productId: PRODUCT_ID,
        warehouseId: WAREHOUSE_ID,
        quantity: 2,
        rate: 100,
        discountPercent: 0,
        discountAmount: 0,
        ratePercent: 18,
        cessPercent: 0,
        isTaxOverridden: false,
        overriddenCgst: null,
        overriddenSgst: null,
        overriddenIgst: null,
        overriddenCess: null,
        overrideReason: null,
        product: { id: PRODUCT_ID, name: "Product A" },
        warehouse: { id: WAREHOUSE_ID, name: "Main Warehouse" },
      },
    ],
    payments: [],
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
  findSupplierForInvoiceMock.mockReset();
  findProductsForLinesMock.mockReset();
  findWarehousesForLinesMock.mockReset();
  findInvoiceableProductsMock.mockReset();
  findSelectableWarehousesMock.mockReset();
  findCompanyStateCodeMock.mockReset();
  findLedgersForValidationMock.mockReset();
  findActiveLedgersForPaymentPickerMock.mockReset();
  aggregateItemWisePurchasesMock.mockReset();
  aggregatePartyWisePurchasesMock.mockReset();
  getCurrentCompanyUserMock.mockReset();
  getCurrentFinancialYearMock.mockReset();
  assertPermissionMock.mockReset();
  ensureSequenceMock.mockReset();
  generateNumberMock.mockReset();
  previewNextNumberMock.mockReset();
  ledgerGroupFindManyMock.mockReset();
  getSettingsMock.mockReset();
  getGoodsReceiptNoteMock.mockReset();
  markInvoicedMock.mockReset();
  getPurchaseOrderMock.mockReset();
  postVoucherMock.mockReset();
  cancelVoucherMock.mockReset();
  recordMovementsMock.mockReset();

  getCurrentCompanyUserMock.mockResolvedValue(CURRENT_USER);
  getCurrentFinancialYearMock.mockResolvedValue(CURRENT_FY);
  assertPermissionMock.mockResolvedValue(undefined);
  findSupplierForInvoiceMock.mockResolvedValue(ACTIVE_SUPPLIER);
  findCompanyStateCodeMock.mockResolvedValue("27");
  findProductsForLinesMock.mockResolvedValue([PRODUCT]);
  findWarehousesForLinesMock.mockResolvedValue([WAREHOUSE]);
  generateNumberMock.mockResolvedValue({ documentSequenceId: "seq-1", number: 1, formatted: "PINV-0001" });
  createMock.mockResolvedValue(invoiceRow());
  getSettingsMock.mockResolvedValue(COMPLETE_SETTINGS);
  ledgerGroupFindManyMock.mockResolvedValue(LEDGER_GROUPS);
  findLedgersForValidationMock.mockImplementation(async (_client: unknown, ids: readonly string[]) =>
    ids.map((id) => LEDGERS_BY_ID[id]).filter(Boolean)
  );
  getPurchaseOrderMock.mockResolvedValue({ id: "po-default", companyId: COMPANY_ID });
  postVoucherMock.mockResolvedValue({ id: VOUCHER_ID });
  recordMovementsMock.mockResolvedValue([]);
  replaceItemsAndPostMock.mockResolvedValue(invoiceRow({ status: "POSTED", voucherId: VOUCHER_ID, invoiceNumber: "PINV-0001" }));
});

describe("createDraft", () => {
  it("creates a DRAFT invoice with no invoiceNumber generated (nullable until posting)", async () => {
    await purchaseInvoiceService.createDraft(validInput());
    expect(ensureSequenceMock).not.toHaveBeenCalled();
    expect(generateNumberMock).not.toHaveBeenCalled();
    expect(createMock).toHaveBeenCalledWith(
      FAKE_TX,
      COMPANY_ID,
      FY_ID,
      expect.objectContaining({ supplierId: SUPPLIER_ID, supplierInvoiceNumber: "SUP-INV-001" }),
      [expect.objectContaining({ productId: PRODUCT_ID })],
      [],
      USER_ID
    );
  });

  it("rejects an overpayment against the freshly computed grand total", async () => {
    await expect(
      purchaseInvoiceService.createDraft(validInput({ payments: [{ ledgerId: CASH_LEDGER_ID, amount: 100000 }] }))
    ).rejects.toThrow("cannot exceed the invoice's grand total");
  });

  it("rejects when the supplier does not exist", async () => {
    findSupplierForInvoiceMock.mockResolvedValueOnce(null);
    await expect(purchaseInvoiceService.createDraft(validInput())).rejects.toThrow("Supplier not found.");
  });

  it("rejects a payment ledger that is neither Cash-in-Hand nor bank-linked", async () => {
    await expect(
      purchaseInvoiceService.createDraft(validInput({ payments: [{ ledgerId: INVALID_PAYMENT_LEDGER_ID, amount: 50 }] }))
    ).rejects.toThrow("is not a Cash-in-Hand or bank-linked ledger");
  });

  it("accepts a bank-linked payment ledger", async () => {
    await expect(
      purchaseInvoiceService.createDraft(validInput({ payments: [{ ledgerId: BANK_LEDGER_ID, amount: 50 }] }))
    ).resolves.toBeDefined();
  });

  it("every rejection is an AppError", async () => {
    findSupplierForInvoiceMock.mockResolvedValueOnce(null);
    await expect(purchaseInvoiceService.createDraft(validInput())).rejects.toBeInstanceOf(AppError);
  });

  it("translates a supplierInvoiceNumber unique-constraint collision into a friendly message", async () => {
    createMock.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "7.8.0",
        meta: { target: ["supplierInvoiceNumber"] },
      })
    );
    await expect(purchaseInvoiceService.createDraft(validInput())).rejects.toThrow(
      "A purchase invoice with this supplier invoice number already exists for this supplier."
    );
  });

  it("translates a goodsReceiptNoteId unique-constraint collision into a friendly message", async () => {
    getGoodsReceiptNoteMock.mockResolvedValueOnce({ id: GRN_ID, status: "RECEIVED" });
    createMock.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "7.8.0",
        meta: { target: ["goodsReceiptNoteId"] },
      })
    );
    await expect(purchaseInvoiceService.createDraft(validInput({ goodsReceiptNoteId: GRN_ID }))).rejects.toThrow(
      "This goods receipt note already has a purchase invoice linked to it."
    );
  });
});

describe("postPurchaseInvoice — orchestration order and ledger entries", () => {
  it("posts an invoice with no payments: stock IN, then balanced voucher, correct entries, invoiceNumber assigned", async () => {
    findByIdMock.mockResolvedValueOnce(invoiceRow()).mockResolvedValueOnce(invoiceRow());

    await purchaseInvoiceService.postPurchaseInvoice("pinv-1");

    expect(ensureSequenceMock).toHaveBeenCalledWith(COMPANY_ID, FY_ID, "PURCHASE_INVOICE");
    expect(ensureSequenceMock).toHaveBeenCalledWith(COMPANY_ID, FY_ID, "PURCHASE_VOUCHER");
    expect(recordMovementsMock).toHaveBeenCalledWith(
      COMPANY_ID,
      [expect.objectContaining({ productId: PRODUCT_ID, direction: "IN", transactionType: "PURCHASE" })],
      FAKE_TX
    );
    expect(postVoucherMock).toHaveBeenCalledWith(
      COMPANY_ID,
      expect.objectContaining({ voucherType: "PURCHASE", referenceType: "PURCHASE_INVOICE" }),
      FAKE_TX
    );

    const entries = postVoucherMock.mock.calls[0][1].entries;
    // 2 x 100 = 200 taxable, 18% GST intra-state = 18 CGST + 18 SGST, grand total 236, no payments -> full remainder to supplier ledger.
    expect(entries).toEqual(
      expect.arrayContaining([
        { ledgerId: PURCHASE_LEDGER_ID, entryType: "DEBIT", amount: 200 },
        { ledgerId: INPUT_CGST_LEDGER_ID, entryType: "DEBIT", amount: 18 },
        { ledgerId: INPUT_SGST_LEDGER_ID, entryType: "DEBIT", amount: 18 },
        { ledgerId: SUPPLIER_LEDGER_ID, entryType: "CREDIT", amount: 236 },
      ])
    );

    expect(replaceItemsAndPostMock).toHaveBeenCalledWith(
      FAKE_TX,
      "pinv-1",
      COMPANY_ID,
      "PINV-0001",
      expect.objectContaining({ grandTotal: 236 }),
      expect.any(Array),
      expect.any(Array),
      VOUCHER_ID
    );
  });

  it("produces IGST instead of CGST/SGST for an inter-state supply", async () => {
    const row = invoiceRow({ placeOfSupplyStateCode: "07" });
    findByIdMock.mockResolvedValueOnce(row).mockResolvedValueOnce(row);

    await purchaseInvoiceService.postPurchaseInvoice("pinv-1");

    const entries = postVoucherMock.mock.calls[0][1].entries;
    expect(entries).toEqual(expect.arrayContaining([{ ledgerId: INPUT_IGST_LEDGER_ID, entryType: "DEBIT", amount: 36 }]));
    expect(entries.some((e: { ledgerId: string }) => e.ledgerId === INPUT_CGST_LEDGER_ID)).toBe(false);
  });

  it("posts a DEBIT round-off entry when the exact total rounds up", async () => {
    // rate 100.006 x 2 -> not a clean multiple; use a rate that yields a fractional total.
    const row = invoiceRow({
      items: [{ ...invoiceRow().items[0], quantity: 3, rate: 33.33 }],
    });
    findByIdMock.mockResolvedValueOnce(row).mockResolvedValueOnce(row);

    await purchaseInvoiceService.postPurchaseInvoice("pinv-1");

    const entries = postVoucherMock.mock.calls[0][1].entries;
    const roundOffEntry = entries.find((e: { ledgerId: string }) => e.ledgerId === ROUND_OFF_LEDGER_ID);
    expect(roundOffEntry).toEqual({ ledgerId: ROUND_OFF_LEDGER_ID, entryType: "DEBIT", amount: 0.01 });
  });

  it("posts a CREDIT round-off entry when the exact total rounds down", async () => {
    // 1 x 100.01 @ 18% -> exact total 118.01, rounds down to 118 -> a
    // negative roundOff, the mirror of the DEBIT/rounds-up case above.
    const row = invoiceRow({
      items: [{ ...invoiceRow().items[0], quantity: 1, rate: 100.01 }],
    });
    findByIdMock.mockResolvedValueOnce(row).mockResolvedValueOnce(row);

    await purchaseInvoiceService.postPurchaseInvoice("pinv-1");

    const entries = postVoucherMock.mock.calls[0][1].entries;
    const roundOffEntry = entries.find((e: { ledgerId: string }) => e.ledgerId === ROUND_OFF_LEDGER_ID);
    expect(roundOffEntry).toEqual({ ledgerId: ROUND_OFF_LEDGER_ID, entryType: "CREDIT", amount: 0.01 });
  });

  it("posts no payment credit entries and full supplier remainder when no payments made", async () => {
    const row = invoiceRow();
    findByIdMock.mockResolvedValueOnce(row).mockResolvedValueOnce(row);
    await purchaseInvoiceService.postPurchaseInvoice("pinv-1");
    const entries = postVoucherMock.mock.calls[0][1].entries;
    expect(entries).toEqual(expect.arrayContaining([{ ledgerId: SUPPLIER_LEDGER_ID, entryType: "CREDIT", amount: 236 }]));
  });

  it("posts no supplier-ledger entry when payments cover the grand total exactly", async () => {
    const row = invoiceRow({ payments: [{ ledgerId: CASH_LEDGER_ID, amount: 236 }] });
    findByIdMock.mockResolvedValueOnce(row).mockResolvedValueOnce(row);

    await purchaseInvoiceService.postPurchaseInvoice("pinv-1");

    const entries = postVoucherMock.mock.calls[0][1].entries;
    expect(entries.some((e: { ledgerId: string }) => e.ledgerId === SUPPLIER_LEDGER_ID)).toBe(false);
    expect(entries).toEqual(expect.arrayContaining([{ ledgerId: CASH_LEDGER_ID, entryType: "CREDIT", amount: 236 }]));
  });

  it("splits a partial payment between the payment ledger and the supplier's remainder, balanced", async () => {
    const row = invoiceRow({ payments: [{ ledgerId: CASH_LEDGER_ID, amount: 100 }] });
    findByIdMock.mockResolvedValueOnce(row).mockResolvedValueOnce(row);

    await purchaseInvoiceService.postPurchaseInvoice("pinv-1");

    const entries: { ledgerId: string; entryType: "DEBIT" | "CREDIT"; amount: number }[] =
      postVoucherMock.mock.calls[0][1].entries;
    expect(entries).toEqual(
      expect.arrayContaining([
        { ledgerId: CASH_LEDGER_ID, entryType: "CREDIT", amount: 100 },
        { ledgerId: SUPPLIER_LEDGER_ID, entryType: "CREDIT", amount: 136 },
      ])
    );
    const debitTotal = entries.filter((e) => e.entryType === "DEBIT").reduce((sum, e) => sum + e.amount, 0);
    const creditTotal = entries.filter((e) => e.entryType === "CREDIT").reduce((sum, e) => sum + e.amount, 0);
    expect(debitTotal).toBe(creditTotal);
    expect(creditTotal).toBe(236);
  });

  it("splits a payment across two different ledgers plus the supplier's remainder, balanced", async () => {
    const row = invoiceRow({
      payments: [
        { ledgerId: CASH_LEDGER_ID, amount: 100 },
        { ledgerId: BANK_LEDGER_ID, amount: 50 },
      ],
    });
    findByIdMock.mockResolvedValueOnce(row).mockResolvedValueOnce(row);

    await purchaseInvoiceService.postPurchaseInvoice("pinv-1");

    const entries: { ledgerId: string; entryType: "DEBIT" | "CREDIT"; amount: number }[] =
      postVoucherMock.mock.calls[0][1].entries;
    expect(entries).toEqual(
      expect.arrayContaining([
        { ledgerId: CASH_LEDGER_ID, entryType: "CREDIT", amount: 100 },
        { ledgerId: BANK_LEDGER_ID, entryType: "CREDIT", amount: 50 },
        { ledgerId: SUPPLIER_LEDGER_ID, entryType: "CREDIT", amount: 86 },
      ])
    );
    const debitTotal = entries.filter((e) => e.entryType === "DEBIT").reduce((sum, e) => sum + e.amount, 0);
    const creditTotal = entries.filter((e) => e.entryType === "CREDIT").reduce((sum, e) => sum + e.amount, 0);
    expect(debitTotal).toBe(creditTotal);
    expect(creditTotal).toBe(236);
  });

  it("rejects an overpayment, validated against the freshly recomputed total", async () => {
    const row = invoiceRow({ payments: [{ ledgerId: CASH_LEDGER_ID, amount: 500 }] });
    findByIdMock.mockResolvedValueOnce(row).mockResolvedValueOnce(row);
    await expect(purchaseInvoiceService.postPurchaseInvoice("pinv-1")).rejects.toThrow(
      "Total payments cannot exceed the invoice's grand total."
    );
    expect(postVoucherMock).not.toHaveBeenCalled();
  });

  it("rejects a payment ledger that is neither Cash-in-Hand nor bank-linked at posting", async () => {
    const row = invoiceRow({ payments: [{ ledgerId: INVALID_PAYMENT_LEDGER_ID, amount: 50 }] });
    findByIdMock.mockResolvedValueOnce(row).mockResolvedValueOnce(row);
    await expect(purchaseInvoiceService.postPurchaseInvoice("pinv-1")).rejects.toThrow(
      "is not a Cash-in-Hand or bank-linked ledger"
    );
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
    const row = invoiceRow();
    findByIdMock.mockResolvedValueOnce(row).mockResolvedValueOnce(row);
    getSettingsMock.mockResolvedValueOnce({ ...COMPLETE_SETTINGS, [field]: null });
    await expect(purchaseInvoiceService.postPurchaseInvoice("pinv-1")).rejects.toThrow(label);
    expect(postVoucherMock).not.toHaveBeenCalled();
  });

  it.each([
    ["purchaseLedgerId", "Purchase Account"],
    ["inputCgstLedgerId", "Input CGST"],
    ["inputSgstLedgerId", "Input SGST"],
    ["inputIgstLedgerId", "Input IGST"],
    ["inputCessLedgerId", "Input Cess"],
  ])("rejects posting when %s points at the wrong ledger group", async (field, label) => {
    const row = invoiceRow();
    findByIdMock.mockResolvedValueOnce(row).mockResolvedValueOnce(row);
    const wrongGroupLedgerId = "30000000-0000-4000-8000-000000000099";
    getSettingsMock.mockResolvedValueOnce({ ...COMPLETE_SETTINGS, [field]: wrongGroupLedgerId });
    findLedgersForValidationMock.mockImplementationOnce(async (_client: unknown, ids: readonly string[]) =>
      ids.map((id) =>
        id === wrongGroupLedgerId ? ledgerInfo(wrongGroupLedgerId, OTHER_GROUP_ID) : LEDGERS_BY_ID[id]
      ).filter(Boolean)
    );
    await expect(purchaseInvoiceService.postPurchaseInvoice("pinv-1")).rejects.toThrow(label);
    expect(postVoucherMock).not.toHaveBeenCalled();
  });

  it("rejects posting when a mapped ledger is inactive", async () => {
    const row = invoiceRow();
    findByIdMock.mockResolvedValueOnce(row).mockResolvedValueOnce(row);
    findLedgersForValidationMock.mockImplementationOnce(async (_client: unknown, ids: readonly string[]) =>
      ids.map((id) => (id === PURCHASE_LEDGER_ID ? { ...LEDGERS_BY_ID[id], isActive: false } : LEDGERS_BY_ID[id])).filter(Boolean)
    );
    await expect(purchaseInvoiceService.postPurchaseInvoice("pinv-1")).rejects.toThrow("is inactive");
    expect(postVoucherMock).not.toHaveBeenCalled();
  });

  it("rejects posting when a mapped ledger belongs to a different company", async () => {
    const row = invoiceRow();
    findByIdMock.mockResolvedValueOnce(row).mockResolvedValueOnce(row);
    findLedgersForValidationMock.mockImplementationOnce(async (_client: unknown, ids: readonly string[]) =>
      ids
        .map((id) => (id === PURCHASE_LEDGER_ID ? { ...LEDGERS_BY_ID[id], companyId: OTHER_COMPANY_ID } : LEDGERS_BY_ID[id]))
        .filter(Boolean)
    );
    await expect(purchaseInvoiceService.postPurchaseInvoice("pinv-1")).rejects.toThrow("invalid");
    expect(postVoucherMock).not.toHaveBeenCalled();
  });

  it("rejects posting a non-DRAFT invoice", async () => {
    findByIdMock.mockResolvedValueOnce(invoiceRow({ status: "POSTED" }));
    await expect(purchaseInvoiceService.postPurchaseInvoice("pinv-1")).rejects.toThrow("can no longer be posted");
  });

  it("rejects when the invoice belongs to a different company", async () => {
    findByIdMock.mockResolvedValueOnce(invoiceRow({ companyId: OTHER_COMPANY_ID }));
    await expect(purchaseInvoiceService.postPurchaseInvoice("pinv-1")).rejects.toThrow("Purchase invoice not found.");
  });
});

describe("postPurchaseInvoice — tax-override audit trail and HSN gate", () => {
  it("stores computed values, uses overridden values in the posted voucher, and requires a non-empty reason", async () => {
    const row = invoiceRow({
      items: [
        {
          ...invoiceRow().items[0],
          isTaxOverridden: true,
          overriddenCgst: 5,
          overriddenSgst: 5,
          overrideReason: "Manual correction",
        },
      ],
    });
    findByIdMock.mockResolvedValueOnce(row).mockResolvedValueOnce(row);

    await purchaseInvoiceService.postPurchaseInvoice("pinv-1");

    const persistedLines = replaceItemsAndPostMock.mock.calls[0][5];
    expect(persistedLines[0]).toEqual(
      expect.objectContaining({ cgst: 18, sgst: 18, overriddenCgst: 5, overriddenSgst: 5, isTaxOverridden: true })
    );
    const entries = postVoucherMock.mock.calls[0][1].entries;
    expect(entries).toEqual(expect.arrayContaining([{ ledgerId: INPUT_CGST_LEDGER_ID, entryType: "DEBIT", amount: 5 }]));
  });

  it("requires approve permission when a tax override is present on any line", async () => {
    const row = invoiceRow({
      items: [{ ...invoiceRow().items[0], isTaxOverridden: true, overriddenCgst: 5, overriddenSgst: 5, overrideReason: "x" }],
    });
    findByIdMock.mockResolvedValueOnce(row).mockResolvedValueOnce(row);
    assertPermissionMock.mockImplementation(async (_user, _module, action) => {
      if (action === "approve") {
        throw new AppError("Insufficient permissions.");
      }
    });
    await expect(purchaseInvoiceService.postPurchaseInvoice("pinv-1")).rejects.toThrow("Insufficient permissions.");
  });

  it("hard-blocks posting a taxed line with no HSN code, unconditionally", async () => {
    const row = invoiceRow();
    findByIdMock.mockResolvedValueOnce(row).mockResolvedValueOnce(row);
    findProductsForLinesMock.mockResolvedValueOnce([{ ...PRODUCT, hsnCode: null }]);
    await expect(purchaseInvoiceService.postPurchaseInvoice("pinv-1")).rejects.toThrow("HSN/SAC code is required");
    expect(postVoucherMock).not.toHaveBeenCalled();
  });
});

describe("postPurchaseInvoice — Goods Receipt Note line-matching bijection", () => {
  function grn(overrides: Record<string, unknown> = {}) {
    return {
      id: GRN_ID,
      companyId: COMPANY_ID,
      supplierId: SUPPLIER_ID,
      purchaseOrderId: null,
      status: "RECEIVED",
      items: [{ productId: PRODUCT_ID, warehouseId: WAREHOUSE_ID, quantity: 2 }],
      ...overrides,
    };
  }

  it("posts successfully and marks the GRN invoiced when everything matches", async () => {
    const row = invoiceRow({ goodsReceiptNoteId: GRN_ID });
    findByIdMock.mockResolvedValueOnce(row).mockResolvedValueOnce(row);
    getGoodsReceiptNoteMock.mockResolvedValueOnce(grn());

    await purchaseInvoiceService.postPurchaseInvoice("pinv-1");

    expect(markInvoicedMock).toHaveBeenCalledWith(GRN_ID, FAKE_TX);
  });

  it("rejects when the GRN's supplier does not match", async () => {
    const row = invoiceRow({ goodsReceiptNoteId: GRN_ID });
    findByIdMock.mockResolvedValueOnce(row).mockResolvedValueOnce(row);
    getGoodsReceiptNoteMock.mockResolvedValueOnce(grn({ supplierId: "different-supplier" }));
    await expect(purchaseInvoiceService.postPurchaseInvoice("pinv-1")).rejects.toThrow("supplier does not match");
  });

  it("rejects when the GRN belongs to a different company", async () => {
    const row = invoiceRow({ goodsReceiptNoteId: GRN_ID });
    findByIdMock.mockResolvedValueOnce(row).mockResolvedValueOnce(row);
    getGoodsReceiptNoteMock.mockResolvedValueOnce(grn({ companyId: OTHER_COMPANY_ID }));
    await expect(purchaseInvoiceService.postPurchaseInvoice("pinv-1")).rejects.toThrow("Goods receipt note not found.");
  });

  it("rejects when the invoice's own purchaseOrderId disagrees with the GRN's", async () => {
    const row = invoiceRow({ goodsReceiptNoteId: GRN_ID, purchaseOrderId: "po-a" });
    findByIdMock.mockResolvedValueOnce(row).mockResolvedValueOnce(row);
    getGoodsReceiptNoteMock.mockResolvedValueOnce(grn({ purchaseOrderId: "po-b" }));
    await expect(purchaseInvoiceService.postPurchaseInvoice("pinv-1")).rejects.toThrow(
      "does not match the goods receipt note"
    );
  });

  it("rejects when a line's product/warehouse/quantity does not match the GRN's lines", async () => {
    const row = invoiceRow({ goodsReceiptNoteId: GRN_ID });
    findByIdMock.mockResolvedValueOnce(row).mockResolvedValueOnce(row);
    getGoodsReceiptNoteMock.mockResolvedValueOnce(
      grn({ items: [{ productId: PRODUCT_ID, warehouseId: WAREHOUSE_ID, quantity: 999 }] })
    );
    await expect(purchaseInvoiceService.postPurchaseInvoice("pinv-1")).rejects.toThrow(
      "must match one of the linked goods receipt note"
    );
  });

  it("rejects when the GRN is no longer RECEIVED", async () => {
    const row = invoiceRow({ goodsReceiptNoteId: GRN_ID });
    findByIdMock.mockResolvedValueOnce(row).mockResolvedValueOnce(row);
    getGoodsReceiptNoteMock.mockResolvedValueOnce(grn({ status: "INVOICED" }));
    await expect(purchaseInvoiceService.postPurchaseInvoice("pinv-1")).rejects.toThrow("not received");
  });

  it("resolves a duplicate-(productId, warehouseId, quantity)-lines GRN as a true bijection", async () => {
    const row = invoiceRow({
      goodsReceiptNoteId: GRN_ID,
      items: [
        invoiceRow().items[0],
        { ...invoiceRow().items[0], id: "item-2" },
      ],
    });
    findByIdMock.mockResolvedValueOnce(row).mockResolvedValueOnce(row);
    getGoodsReceiptNoteMock.mockResolvedValueOnce(
      grn({
        items: [
          { productId: PRODUCT_ID, warehouseId: WAREHOUSE_ID, quantity: 2 },
          { productId: PRODUCT_ID, warehouseId: WAREHOUSE_ID, quantity: 2 },
        ],
      })
    );

    await purchaseInvoiceService.postPurchaseInvoice("pinv-1");

    expect(markInvoicedMock).toHaveBeenCalledWith(GRN_ID, FAKE_TX);
  });

  it("rejects a GRN with duplicate lines when the invoice line count doesn't match", async () => {
    const row = invoiceRow({ goodsReceiptNoteId: GRN_ID });
    findByIdMock.mockResolvedValueOnce(row).mockResolvedValueOnce(row);
    getGoodsReceiptNoteMock.mockResolvedValueOnce(
      grn({
        items: [
          { productId: PRODUCT_ID, warehouseId: WAREHOUSE_ID, quantity: 2 },
          { productId: PRODUCT_ID, warehouseId: WAREHOUSE_ID, quantity: 2 },
        ],
      })
    );
    await expect(purchaseInvoiceService.postPurchaseInvoice("pinv-1")).rejects.toThrow(
      "must match one of the linked goods receipt note"
    );
  });
});

describe("cancelPurchaseInvoice", () => {
  it("reverses the voucher and stock (direction OUT) atomically, both on the same tx", async () => {
    const posted = invoiceRow({ status: "POSTED", voucherId: VOUCHER_ID, invoiceNumber: "PINV-0001" });
    findByIdMock.mockResolvedValueOnce(posted).mockResolvedValueOnce(posted);
    updateStatusMock.mockResolvedValueOnce(1);
    findByIdMock.mockResolvedValueOnce(invoiceRow({ status: "CANCELLED", voucherId: VOUCHER_ID }));

    await purchaseInvoiceService.cancelPurchaseInvoice("pinv-1");

    expect(cancelVoucherMock).toHaveBeenCalledWith(COMPANY_ID, VOUCHER_ID, FAKE_TX);
    expect(recordMovementsMock).toHaveBeenCalledWith(
      COMPANY_ID,
      [expect.objectContaining({ direction: "OUT", transactionType: "PURCHASE" })],
      FAKE_TX
    );
    expect(updateStatusMock).toHaveBeenCalledWith(FAKE_TX, "pinv-1", COMPANY_ID, ["POSTED"], "CANCELLED");
  });

  it("rejects cancelling a DRAFT invoice", async () => {
    findByIdMock.mockResolvedValueOnce(invoiceRow({ status: "DRAFT" }));
    await expect(purchaseInvoiceService.cancelPurchaseInvoice("pinv-1")).rejects.toThrow(
      "Only a posted purchase invoice can be cancelled."
    );
  });

  it("rejects when a concurrent cancellation already won the race", async () => {
    const posted = invoiceRow({ status: "POSTED", voucherId: VOUCHER_ID });
    findByIdMock.mockResolvedValueOnce(posted).mockResolvedValueOnce(posted);
    updateStatusMock.mockResolvedValueOnce(0);
    await expect(purchaseInvoiceService.cancelPurchaseInvoice("pinv-1")).rejects.toThrow(
      "Only a posted purchase invoice can be cancelled."
    );
  });

  it("rolls back the voucher reversal when the stock reversal fails (single-transaction atomicity)", async () => {
    const posted = invoiceRow({ status: "POSTED", voucherId: VOUCHER_ID });
    findByIdMock.mockResolvedValueOnce(posted).mockResolvedValueOnce(posted);
    recordMovementsMock.mockRejectedValueOnce(new AppError("Injected stock-reversal failure."));

    await expect(purchaseInvoiceService.cancelPurchaseInvoice("pinv-1")).rejects.toThrow(
      "Injected stock-reversal failure."
    );
    // updateStatus (the status flip) must never be reached — the mocked
    // $transaction re-throws synchronously, so nothing after the failed
    // recordMovements call executes, proving no partial cancellation.
    expect(updateStatusMock).not.toHaveBeenCalled();
  });

  it("gates on the approve permission", async () => {
    const posted = invoiceRow({ status: "POSTED", voucherId: VOUCHER_ID });
    findByIdMock.mockResolvedValueOnce(posted).mockResolvedValueOnce(posted);
    updateStatusMock.mockResolvedValueOnce(1);
    findByIdMock.mockResolvedValueOnce(invoiceRow({ status: "CANCELLED" }));
    await purchaseInvoiceService.cancelPurchaseInvoice("pinv-1");
    expect(assertPermissionMock).toHaveBeenCalledWith(CURRENT_USER, "purchase", "approve");
  });
});

describe("getPurchaseInvoice / listPurchaseInvoices — cross-company and scoping", () => {
  it("getPurchaseInvoice returns null for a cross-company invoice", async () => {
    findByIdMock.mockResolvedValueOnce(invoiceRow({ companyId: OTHER_COMPANY_ID }));
    await expect(purchaseInvoiceService.getPurchaseInvoice("pinv-1")).resolves.toBeNull();
  });

  it("listPurchaseInvoices returns [] with no active financial year", async () => {
    getCurrentFinancialYearMock.mockResolvedValueOnce(null);
    const result = await purchaseInvoiceService.listPurchaseInvoices();
    expect(result).toEqual([]);
    expect(findManyMock).not.toHaveBeenCalled();
  });
});

// 69-purchase-reports.md's Purchase Reports module calls these three instead
// of listPurchaseInvoices — mirrors sales-invoice-service.test.ts's own
// "report-scoped reads" describe block; the only difference from their
// purchase:view-gated siblings is which permission they check.
describe("report-scoped reads — listPurchaseInvoicesForReport / getItemWisePurchaseReport / getPartyWisePurchaseReport", () => {
  it("listPurchaseInvoicesForReport gates on reports:view, not purchase:view", async () => {
    await purchaseInvoiceService.listPurchaseInvoicesForReport();
    expect(assertPermissionMock).toHaveBeenCalledWith(expect.anything(), "reports", "view");
  });

  it("listPurchaseInvoicesForReport returns [] with no active financial year, without calling the repository", async () => {
    getCurrentFinancialYearMock.mockResolvedValueOnce(null);
    const result = await purchaseInvoiceService.listPurchaseInvoicesForReport();
    expect(result).toEqual([]);
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it("getItemWisePurchaseReport gates on reports:view and scopes to the caller's company + active financial year", async () => {
    aggregateItemWisePurchasesMock.mockResolvedValueOnce([]);
    const filters = { fromDate: new Date("2026-04-01"), toDate: new Date("2026-04-30") };
    await purchaseInvoiceService.getItemWisePurchaseReport(filters);
    expect(assertPermissionMock).toHaveBeenCalledWith(expect.anything(), "reports", "view");
    expect(aggregateItemWisePurchasesMock).toHaveBeenCalledWith(COMPANY_ID, FY_ID, filters);
  });

  it("getItemWisePurchaseReport returns [] with no active financial year, without calling the repository", async () => {
    getCurrentFinancialYearMock.mockResolvedValueOnce(null);
    const result = await purchaseInvoiceService.getItemWisePurchaseReport({ fromDate: new Date(), toDate: new Date() });
    expect(result).toEqual([]);
    expect(aggregateItemWisePurchasesMock).not.toHaveBeenCalled();
  });

  it("getPartyWisePurchaseReport gates on reports:view and scopes to the caller's company + active financial year", async () => {
    aggregatePartyWisePurchasesMock.mockResolvedValueOnce([]);
    const filters = { fromDate: new Date("2026-04-01"), toDate: new Date("2026-04-30") };
    await purchaseInvoiceService.getPartyWisePurchaseReport(filters);
    expect(assertPermissionMock).toHaveBeenCalledWith(expect.anything(), "reports", "view");
    expect(aggregatePartyWisePurchasesMock).toHaveBeenCalledWith(COMPANY_ID, FY_ID, filters);
  });

  it("getPartyWisePurchaseReport returns [] with no active financial year, without calling the repository", async () => {
    getCurrentFinancialYearMock.mockResolvedValueOnce(null);
    const result = await purchaseInvoiceService.getPartyWisePurchaseReport({ fromDate: new Date(), toDate: new Date() });
    expect(result).toEqual([]);
    expect(aggregatePartyWisePurchasesMock).not.toHaveBeenCalled();
  });
});

describe("getGoodsReceiptNotePrefill", () => {
  it("returns null for a non-RECEIVED GRN", async () => {
    getGoodsReceiptNoteMock.mockResolvedValueOnce({ id: GRN_ID, status: "DRAFT" });
    await expect(purchaseInvoiceService.getGoodsReceiptNotePrefill(GRN_ID)).resolves.toBeNull();
  });

  it("returns the GRN's lines when RECEIVED", async () => {
    getGoodsReceiptNoteMock.mockResolvedValueOnce({
      id: GRN_ID,
      grnNumber: "GRN-0001",
      supplierId: SUPPLIER_ID,
      purchaseOrderId: null,
      status: "RECEIVED",
      items: [
        {
          productId: PRODUCT_ID,
          warehouseId: WAREHOUSE_ID,
          quantity: 2,
          product: { name: "Product A", productCode: "A" },
          warehouse: { name: "Main Warehouse" },
        },
      ],
    });
    findProductsForLinesMock.mockResolvedValueOnce([PRODUCT]);

    const result = await purchaseInvoiceService.getGoodsReceiptNotePrefill(GRN_ID);
    expect(result).toEqual(expect.objectContaining({ goodsReceiptNoteId: GRN_ID, supplierId: SUPPLIER_ID }));
    expect(result?.lines[0]).toEqual(expect.objectContaining({ productId: PRODUCT_ID, quantity: 2 }));
  });
});
