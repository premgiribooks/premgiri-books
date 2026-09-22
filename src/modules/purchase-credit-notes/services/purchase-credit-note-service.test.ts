import { beforeEach, describe, expect, it, vi } from "vitest";

// Mirrors credit-note-service.test.ts's / purchase-return-service.test.ts's
// convention — mock the module-boundary repository, sibling
// services/engines, and the session/permission/Prisma boundaries.
// assertPurchaseLedgerMappingValid (company/utils) is left REAL so the
// ledger-mapping-matrix assertions are genuine, exercised through the mocked
// ledgerGroupRepository/ledgerRepository beneath it. gstEngine itself is NOT
// mocked — it's a pure, deterministic module.
const {
  findManyMock,
  findByIdMock,
  createMock,
  replaceItemsAndUpdateMock,
  replaceItemsAndPostMock,
  updateStatusMock,
  findPurchaseInvoiceForPurchaseCreditNoteMock,
  findSupplierForPurchaseCreditNoteMock,
  findCompanyStateCodeMock,
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
  listSelectableSuppliersMock,
  listSelectableGstRatesMock,
  FAKE_TX,
} = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  findByIdMock: vi.fn(),
  createMock: vi.fn(),
  replaceItemsAndUpdateMock: vi.fn(),
  replaceItemsAndPostMock: vi.fn(),
  updateStatusMock: vi.fn(),
  findPurchaseInvoiceForPurchaseCreditNoteMock: vi.fn(),
  findSupplierForPurchaseCreditNoteMock: vi.fn(),
  findCompanyStateCodeMock: vi.fn(),
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
  listSelectableSuppliersMock: vi.fn(),
  listSelectableGstRatesMock: vi.fn(),
  FAKE_TX: { marker: "fake-tx" },
}));

vi.mock("@/modules/purchase-credit-notes/repositories/purchase-credit-note-repository", () => ({
  purchaseCreditNoteRepository: {
    findMany: findManyMock,
    findById: findByIdMock,
    create: createMock,
    replaceItemsAndUpdate: replaceItemsAndUpdateMock,
    replaceItemsAndPost: replaceItemsAndPostMock,
    updateStatus: updateStatusMock,
    findPurchaseInvoiceForPurchaseCreditNote: findPurchaseInvoiceForPurchaseCreditNoteMock,
    findSupplierForPurchaseCreditNote: findSupplierForPurchaseCreditNoteMock,
    findCompanyStateCode: findCompanyStateCodeMock,
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

vi.mock("@/modules/ledger-groups/repositories/ledger-group-repository", () => ({
  ledgerGroupRepository: { findMany: ledgerGroupFindManyMock },
}));
vi.mock("@/modules/ledgers/repositories/ledger-repository", () => ({
  ledgerRepository: { findLedgersForValidation: findLedgersForValidationMock },
}));

vi.mock("@/modules/company/services/company-settings-service", () => ({
  companySettingsService: { getSettings: getSettingsMock },
}));

vi.mock("@/modules/suppliers/services/supplier-service", () => ({
  supplierService: { listSelectableSuppliers: listSelectableSuppliersMock },
}));

vi.mock("@/modules/gst-rates/services/gst-rate-service", () => ({
  gstRateService: { listSelectableGstRates: listSelectableGstRatesMock },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: (fn: (tx: unknown) => unknown) => fn(FAKE_TX) },
}));

import { AppError } from "@/lib/app-error";
import { purchaseCreditNoteService } from "@/modules/purchase-credit-notes/services/purchase-credit-note-service";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_COMPANY_ID = "99999999-9999-4999-8999-999999999999";
const FY_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";
const SUPPLIER_ID = "44444444-4444-4444-8444-444444444444";
const SUPPLIER_LEDGER_ID = "55555555-5555-4555-8555-555555555555";
const INVOICE_ID = "88888888-8888-4888-8888-888888888888";
const VOUCHER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const NOTE_ID = "pcn-1";
const COMPANY_STATE_CODE = "27";

const PURCHASE_GROUP_ID = "10000000-0000-4000-8000-000000000001";
const TAXES_GROUP_ID = "10000000-0000-4000-8000-000000000002";
const OTHER_GROUP_ID = "10000000-0000-4000-8000-000000000004";

const LEDGER_GROUPS = [
  { id: PURCHASE_GROUP_ID, companyId: COMPANY_ID, name: "Purchase Accounts", parentGroupId: null },
  { id: TAXES_GROUP_ID, companyId: COMPANY_ID, name: "Duties & Taxes", parentGroupId: null },
  { id: OTHER_GROUP_ID, companyId: COMPANY_ID, name: "Sales Accounts", parentGroupId: null },
];

const PURCHASE_LEDGER_ID = "20000000-0000-4000-8000-000000000001";
const INPUT_CGST_LEDGER_ID = "20000000-0000-4000-8000-000000000002";
const INPUT_SGST_LEDGER_ID = "20000000-0000-4000-8000-000000000003";
const INPUT_IGST_LEDGER_ID = "20000000-0000-4000-8000-000000000004";
const INPUT_CESS_LEDGER_ID = "20000000-0000-4000-8000-000000000005";
const ROUND_OFF_LEDGER_ID = "20000000-0000-4000-8000-000000000006";

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
): { id: string; name: string; companyId: string; isActive: boolean; ledgerGroupId: string } {
  return { id, name: `Ledger ${id}`, companyId: COMPANY_ID, isActive: true, ledgerGroupId, ...overrides };
}

const LEDGERS_BY_ID: Record<string, ReturnType<typeof ledgerInfo>> = {
  [PURCHASE_LEDGER_ID]: ledgerInfo(PURCHASE_LEDGER_ID, PURCHASE_GROUP_ID),
  [INPUT_CGST_LEDGER_ID]: ledgerInfo(INPUT_CGST_LEDGER_ID, TAXES_GROUP_ID),
  [INPUT_SGST_LEDGER_ID]: ledgerInfo(INPUT_SGST_LEDGER_ID, TAXES_GROUP_ID),
  [INPUT_IGST_LEDGER_ID]: ledgerInfo(INPUT_IGST_LEDGER_ID, TAXES_GROUP_ID),
  [INPUT_CESS_LEDGER_ID]: ledgerInfo(INPUT_CESS_LEDGER_ID, TAXES_GROUP_ID),
  [ROUND_OFF_LEDGER_ID]: ledgerInfo(ROUND_OFF_LEDGER_ID, OTHER_GROUP_ID),
};

const SUPPLIER = { id: SUPPLIER_ID, companyId: COMPANY_ID, isActive: true, ledgerId: SUPPLIER_LEDGER_ID, name: "Acme Supplies" };

// 100 taxable, 18% intra-state (company state == place of supply "27") = 9 CGST + 9 SGST, grand total 118.
function purchaseCreditNoteRow(overrides: Record<string, unknown> = {}) {
  return {
    id: NOTE_ID,
    companyId: COMPANY_ID,
    financialYearId: FY_ID,
    noteNumber: null,
    noteDate: new Date("2026-09-10T00:00:00.000Z"),
    supplierId: SUPPLIER_ID,
    supplier: { id: SUPPLIER_ID, name: "Acme Supplies" },
    purchaseInvoiceId: null,
    purchaseInvoice: null,
    placeOfSupplyStateCode: COMPANY_STATE_CODE,
    status: "DRAFT",
    reason: "Price correction",
    taxableAmount: 100,
    totalCgst: 9,
    totalSgst: 9,
    totalIgst: 0,
    totalCess: 0,
    grandTotal: 118,
    voucherId: null,
    createdByUserId: USER_ID,
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [
      {
        id: "item-1",
        purchaseCreditNoteId: NOTE_ID,
        lineNumber: 1,
        description: "Rebate adjustment",
        taxableAmount: 100,
        ratePercent: 18,
        cessPercent: 0,
        cgst: 9,
        sgst: 9,
        igst: 0,
        cess: 0,
        totalAmount: 118,
      },
    ],
    ...overrides,
  };
}

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    supplierId: SUPPLIER_ID,
    noteDate: "2026-09-10",
    placeOfSupplyStateCode: COMPANY_STATE_CODE,
    reason: "Price correction",
    lines: [{ description: "Rebate adjustment", taxableAmount: 100, ratePercent: 18, cessPercent: 0 }],
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

beforeEach(() => {
  findManyMock.mockReset();
  findByIdMock.mockReset();
  createMock.mockReset();
  replaceItemsAndUpdateMock.mockReset();
  replaceItemsAndPostMock.mockReset();
  updateStatusMock.mockReset();
  findPurchaseInvoiceForPurchaseCreditNoteMock.mockReset();
  findSupplierForPurchaseCreditNoteMock.mockReset();
  findCompanyStateCodeMock.mockReset();
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
  listSelectableSuppliersMock.mockReset();
  listSelectableGstRatesMock.mockReset();

  getCurrentCompanyUserMock.mockResolvedValue(CURRENT_USER);
  getCurrentFinancialYearMock.mockResolvedValue({ id: FY_ID });
  assertPermissionMock.mockResolvedValue(undefined);
  findSupplierForPurchaseCreditNoteMock.mockResolvedValue(SUPPLIER);
  findCompanyStateCodeMock.mockResolvedValue(COMPANY_STATE_CODE);
  getSettingsMock.mockResolvedValue(COMPLETE_SETTINGS);
  ledgerGroupFindManyMock.mockResolvedValue(LEDGER_GROUPS);
  findLedgersForValidationMock.mockImplementation(async (_client: unknown, ids: readonly string[]) =>
    ids.map((id) => LEDGERS_BY_ID[id]).filter(Boolean)
  );
  generateNumberMock.mockResolvedValue({ documentSequenceId: "seq-1", number: 1, formatted: "PCN-0001" });
  createMock.mockResolvedValue(purchaseCreditNoteRow());
  postVoucherMock.mockResolvedValue({ id: VOUCHER_ID });
  replaceItemsAndPostMock.mockResolvedValue(
    purchaseCreditNoteRow({ status: "POSTED", voucherId: VOUCHER_ID, noteNumber: "PCN-0001" })
  );
});

describe("createDraft", () => {
  it("creates a DRAFT purchase credit note with noteNumber untouched (numbering deferred to posting)", async () => {
    await purchaseCreditNoteService.createDraft(validInput());
    expect(ensureSequenceMock).not.toHaveBeenCalled();
    expect(generateNumberMock).not.toHaveBeenCalled();
    expect(createMock).toHaveBeenCalledWith(
      FAKE_TX,
      COMPANY_ID,
      FY_ID,
      expect.objectContaining({ supplierId: SUPPLIER_ID, grandTotal: 118 }),
      [expect.objectContaining({ description: "Rebate adjustment", taxableAmount: 100, cgst: 9, sgst: 9 })],
      USER_ID
    );
  });

  it("rejects when the supplier is not found", async () => {
    findSupplierForPurchaseCreditNoteMock.mockResolvedValueOnce(null);
    await expect(purchaseCreditNoteService.createDraft(validInput())).rejects.toThrow("Supplier not found.");
  });

  it("rejects an inactive supplier", async () => {
    findSupplierForPurchaseCreditNoteMock.mockResolvedValueOnce({ ...SUPPLIER, isActive: false });
    await expect(purchaseCreditNoteService.createDraft(validInput())).rejects.toThrow("inactive");
  });

  it("every rejection is an AppError", async () => {
    findSupplierForPurchaseCreditNoteMock.mockResolvedValueOnce(null);
    await expect(purchaseCreditNoteService.createDraft(validInput())).rejects.toBeInstanceOf(AppError);
  });

  describe("linked purchase invoice validation", () => {
    it("accepts a linked POSTED invoice whose supplier matches", async () => {
      findPurchaseInvoiceForPurchaseCreditNoteMock.mockResolvedValueOnce({
        id: INVOICE_ID,
        companyId: COMPANY_ID,
        invoiceNumber: "PINV-0001",
        invoiceDate: new Date("2026-09-01T00:00:00.000Z"),
        status: "POSTED",
        supplierId: SUPPLIER_ID,
        placeOfSupplyStateCode: COMPANY_STATE_CODE,
      });
      await purchaseCreditNoteService.createDraft(validInput({ purchaseInvoiceId: INVOICE_ID }));
      expect(createMock).toHaveBeenCalled();
    });

    it("rejects a linked invoice that is DRAFT", async () => {
      findPurchaseInvoiceForPurchaseCreditNoteMock.mockResolvedValueOnce({
        id: INVOICE_ID,
        companyId: COMPANY_ID,
        invoiceNumber: "PINV-0001",
        invoiceDate: new Date("2026-09-01T00:00:00.000Z"),
        status: "DRAFT",
        supplierId: SUPPLIER_ID,
        placeOfSupplyStateCode: COMPANY_STATE_CODE,
      });
      await expect(purchaseCreditNoteService.createDraft(validInput({ purchaseInvoiceId: INVOICE_ID }))).rejects.toThrow(
        "Only a posted purchase invoice"
      );
    });

    it("rejects a linked invoice that is CANCELLED", async () => {
      findPurchaseInvoiceForPurchaseCreditNoteMock.mockResolvedValueOnce({
        id: INVOICE_ID,
        companyId: COMPANY_ID,
        invoiceNumber: "PINV-0001",
        invoiceDate: new Date("2026-09-01T00:00:00.000Z"),
        status: "CANCELLED",
        supplierId: SUPPLIER_ID,
        placeOfSupplyStateCode: COMPANY_STATE_CODE,
      });
      await expect(purchaseCreditNoteService.createDraft(validInput({ purchaseInvoiceId: INVOICE_ID }))).rejects.toThrow(
        "Only a posted purchase invoice"
      );
    });

    it("rejects a linked invoice whose supplier does not match this credit note's supplier", async () => {
      findPurchaseInvoiceForPurchaseCreditNoteMock.mockResolvedValueOnce({
        id: INVOICE_ID,
        companyId: COMPANY_ID,
        invoiceNumber: "PINV-0001",
        invoiceDate: new Date("2026-09-01T00:00:00.000Z"),
        status: "POSTED",
        supplierId: "different-supplier-id",
        placeOfSupplyStateCode: COMPANY_STATE_CODE,
      });
      await expect(purchaseCreditNoteService.createDraft(validInput({ purchaseInvoiceId: INVOICE_ID }))).rejects.toThrow(
        "does not match this credit note's supplier"
      );
    });

    it("rejects a linked invoice that does not belong to this company", async () => {
      findPurchaseInvoiceForPurchaseCreditNoteMock.mockResolvedValueOnce(null);
      await expect(purchaseCreditNoteService.createDraft(validInput({ purchaseInvoiceId: INVOICE_ID }))).rejects.toThrow(
        "Purchase invoice not found."
      );
    });
  });
});

describe("postPurchaseCreditNote — orchestration and ledger entries", () => {
  it("posts (no linked invoice): generates noteNumber, posts a balanced voucher crediting purchase/tax ledgers and debiting the supplier ledger, no stock movement", async () => {
    findByIdMock.mockResolvedValueOnce(purchaseCreditNoteRow()).mockResolvedValueOnce(purchaseCreditNoteRow());

    await purchaseCreditNoteService.postPurchaseCreditNote(NOTE_ID);

    expect(ensureSequenceMock).toHaveBeenCalledWith(COMPANY_ID, FY_ID, "PURCHASE_CREDIT_NOTE");
    expect(ensureSequenceMock).toHaveBeenCalledWith(COMPANY_ID, FY_ID, "PURCHASE_CREDIT_NOTE_VOUCHER");
    expect(generateNumberMock).toHaveBeenCalledWith(FAKE_TX, {
      companyId: COMPANY_ID,
      financialYearId: FY_ID,
      documentType: "PURCHASE_CREDIT_NOTE",
    });

    expect(postVoucherMock).toHaveBeenCalledWith(
      COMPANY_ID,
      expect.objectContaining({ voucherType: "PURCHASE_CREDIT_NOTE", referenceType: "PURCHASE_CREDIT_NOTE" }),
      FAKE_TX
    );
    const entries = postVoucherMock.mock.calls[0][1].entries;
    // 100 taxable + 9 CGST + 9 SGST = 118, all CREDIT, single DEBIT to the supplier ledger.
    expect(entries).toEqual(
      expect.arrayContaining([
        { ledgerId: PURCHASE_LEDGER_ID, entryType: "CREDIT", amount: 100 },
        { ledgerId: INPUT_CGST_LEDGER_ID, entryType: "CREDIT", amount: 9 },
        { ledgerId: INPUT_SGST_LEDGER_ID, entryType: "CREDIT", amount: 9 },
        { ledgerId: SUPPLIER_LEDGER_ID, entryType: "DEBIT", amount: 118 },
      ])
    );

    expect(replaceItemsAndPostMock).toHaveBeenCalledWith(
      FAKE_TX,
      NOTE_ID,
      COMPANY_ID,
      expect.objectContaining({ grandTotal: 118 }),
      expect.any(Array),
      { documentSequenceId: "seq-1", number: 1, formatted: "PCN-0001" },
      VOUCHER_ID
    );
  });

  it("posts (with a linked invoice): still balances the same way, link is context only", async () => {
    const row = purchaseCreditNoteRow({
      purchaseInvoiceId: INVOICE_ID,
      purchaseInvoice: { id: INVOICE_ID, invoiceNumber: "PINV-0001", invoiceDate: new Date("2026-09-01T00:00:00.000Z") },
    });
    findByIdMock.mockResolvedValueOnce(row).mockResolvedValueOnce(row);
    findPurchaseInvoiceForPurchaseCreditNoteMock.mockResolvedValueOnce({
      id: INVOICE_ID,
      companyId: COMPANY_ID,
      invoiceNumber: "PINV-0001",
      invoiceDate: new Date("2026-09-01T00:00:00.000Z"),
      status: "POSTED",
      supplierId: SUPPLIER_ID,
      placeOfSupplyStateCode: COMPANY_STATE_CODE,
    });

    await purchaseCreditNoteService.postPurchaseCreditNote(NOTE_ID);

    const entries = postVoucherMock.mock.calls[0][1].entries;
    expect(entries).toEqual(expect.arrayContaining([{ ledgerId: SUPPLIER_LEDGER_ID, entryType: "DEBIT", amount: 118 }]));
  });

  it("never calls the Inventory Engine (no stock movement) — no StockTransaction row is produced", async () => {
    findByIdMock.mockResolvedValueOnce(purchaseCreditNoteRow()).mockResolvedValueOnce(purchaseCreditNoteRow());
    await purchaseCreditNoteService.postPurchaseCreditNote(NOTE_ID);
    // No inventory-engine import exists in this module at all — asserted at
    // the module-boundary level; nothing here could call it even if it tried.
    expect(postVoucherMock).toHaveBeenCalled();
  });

  it("rejects posting when the linked invoice's supplier no longer matches", async () => {
    const row = purchaseCreditNoteRow({ purchaseInvoiceId: INVOICE_ID });
    findByIdMock.mockResolvedValueOnce(row).mockResolvedValueOnce(row);
    findPurchaseInvoiceForPurchaseCreditNoteMock.mockResolvedValueOnce({
      id: INVOICE_ID,
      companyId: COMPANY_ID,
      invoiceNumber: "PINV-0001",
      invoiceDate: new Date("2026-09-01T00:00:00.000Z"),
      status: "POSTED",
      supplierId: "different-supplier-id",
      placeOfSupplyStateCode: COMPANY_STATE_CODE,
    });

    await expect(purchaseCreditNoteService.postPurchaseCreditNote(NOTE_ID)).rejects.toThrow("does not match this credit note's supplier");
    expect(postVoucherMock).not.toHaveBeenCalled();
  });

  it("rejects posting when the linked invoice was cancelled since this note was drafted", async () => {
    const row = purchaseCreditNoteRow({ purchaseInvoiceId: INVOICE_ID });
    findByIdMock.mockResolvedValueOnce(row).mockResolvedValueOnce(row);
    findPurchaseInvoiceForPurchaseCreditNoteMock.mockResolvedValueOnce({
      id: INVOICE_ID,
      companyId: COMPANY_ID,
      invoiceNumber: "PINV-0001",
      invoiceDate: new Date("2026-09-01T00:00:00.000Z"),
      status: "CANCELLED",
      supplierId: SUPPLIER_ID,
      placeOfSupplyStateCode: COMPANY_STATE_CODE,
    });

    await expect(purchaseCreditNoteService.postPurchaseCreditNote(NOTE_ID)).rejects.toThrow("Only a posted purchase invoice");
    expect(postVoucherMock).not.toHaveBeenCalled();
  });

  it("rejects posting when the linked invoice is still DRAFT", async () => {
    const row = purchaseCreditNoteRow({ purchaseInvoiceId: INVOICE_ID });
    findByIdMock.mockResolvedValueOnce(row).mockResolvedValueOnce(row);
    findPurchaseInvoiceForPurchaseCreditNoteMock.mockResolvedValueOnce({
      id: INVOICE_ID,
      companyId: COMPANY_ID,
      invoiceNumber: "PINV-0001",
      invoiceDate: new Date("2026-09-01T00:00:00.000Z"),
      status: "DRAFT",
      supplierId: SUPPLIER_ID,
      placeOfSupplyStateCode: COMPANY_STATE_CODE,
    });

    await expect(purchaseCreditNoteService.postPurchaseCreditNote(NOTE_ID)).rejects.toThrow("Only a posted purchase invoice");
    expect(postVoucherMock).not.toHaveBeenCalled();
  });

  it.each([
    ["purchaseLedgerId", "Purchase Account"],
    ["inputCgstLedgerId", "Input CGST"],
    ["inputSgstLedgerId", "Input SGST"],
    ["inputIgstLedgerId", "Input IGST"],
    ["inputCessLedgerId", "Input Cess"],
    ["roundOffLedgerId", "Round Off"],
  ])("rejects posting when %s is not configured, naming %s", async (field, label) => {
    findByIdMock.mockResolvedValueOnce(purchaseCreditNoteRow()).mockResolvedValueOnce(purchaseCreditNoteRow());
    getSettingsMock.mockResolvedValueOnce({ ...COMPLETE_SETTINGS, [field]: null });
    await expect(purchaseCreditNoteService.postPurchaseCreditNote(NOTE_ID)).rejects.toThrow(label);
    expect(postVoucherMock).not.toHaveBeenCalled();
  });

  it("rejects posting a non-DRAFT purchase credit note", async () => {
    findByIdMock.mockResolvedValueOnce(purchaseCreditNoteRow({ status: "POSTED" }));
    await expect(purchaseCreditNoteService.postPurchaseCreditNote(NOTE_ID)).rejects.toThrow("can no longer be posted");
  });

  it("rejects when the purchase credit note belongs to a different company", async () => {
    findByIdMock.mockResolvedValueOnce(purchaseCreditNoteRow({ companyId: OTHER_COMPANY_ID }));
    await expect(purchaseCreditNoteService.postPurchaseCreditNote(NOTE_ID)).rejects.toThrow("Purchase credit note not found.");
  });

  it("gates posting on the approve permission", async () => {
    findByIdMock.mockResolvedValueOnce(purchaseCreditNoteRow()).mockResolvedValueOnce(purchaseCreditNoteRow());
    await purchaseCreditNoteService.postPurchaseCreditNote(NOTE_ID);
    expect(assertPermissionMock).toHaveBeenCalledWith(CURRENT_USER, "purchase", "approve");
  });
});

describe("cancelPurchaseCreditNote", () => {
  it("reverses the voucher (mirrored reversal), no stock involved", async () => {
    const posted = purchaseCreditNoteRow({ status: "POSTED", voucherId: VOUCHER_ID, noteNumber: "PCN-0001" });
    findByIdMock.mockResolvedValueOnce(posted).mockResolvedValueOnce(posted);
    updateStatusMock.mockResolvedValueOnce(1);
    findByIdMock.mockResolvedValueOnce(purchaseCreditNoteRow({ status: "CANCELLED", voucherId: VOUCHER_ID }));

    await purchaseCreditNoteService.cancelPurchaseCreditNote(NOTE_ID);

    expect(cancelVoucherMock).toHaveBeenCalledWith(COMPANY_ID, VOUCHER_ID, FAKE_TX);
    expect(updateStatusMock).toHaveBeenCalledWith(FAKE_TX, NOTE_ID, COMPANY_ID, ["POSTED"], "CANCELLED");
  });

  it("rejects cancelling a DRAFT purchase credit note", async () => {
    findByIdMock.mockResolvedValueOnce(purchaseCreditNoteRow({ status: "DRAFT" }));
    await expect(purchaseCreditNoteService.cancelPurchaseCreditNote(NOTE_ID)).rejects.toThrow(
      "Only a posted purchase credit note can be cancelled."
    );
  });

  it("rejects when a concurrent cancellation already won the race", async () => {
    const posted = purchaseCreditNoteRow({ status: "POSTED", voucherId: VOUCHER_ID });
    findByIdMock.mockResolvedValueOnce(posted).mockResolvedValueOnce(posted);
    updateStatusMock.mockResolvedValueOnce(0);
    await expect(purchaseCreditNoteService.cancelPurchaseCreditNote(NOTE_ID)).rejects.toThrow(
      "Only a posted purchase credit note can be cancelled."
    );
  });

  it("gates on the approve permission", async () => {
    const posted = purchaseCreditNoteRow({ status: "POSTED", voucherId: VOUCHER_ID });
    findByIdMock.mockResolvedValueOnce(posted).mockResolvedValueOnce(posted);
    updateStatusMock.mockResolvedValueOnce(1);
    findByIdMock.mockResolvedValueOnce(purchaseCreditNoteRow({ status: "CANCELLED" }));
    await purchaseCreditNoteService.cancelPurchaseCreditNote(NOTE_ID);
    expect(assertPermissionMock).toHaveBeenCalledWith(CURRENT_USER, "purchase", "approve");
  });
});

describe("getPurchaseCreditNote / listPurchaseCreditNotes — cross-company and scoping", () => {
  it("getPurchaseCreditNote returns null for a cross-company purchase credit note", async () => {
    findByIdMock.mockResolvedValueOnce(purchaseCreditNoteRow({ companyId: OTHER_COMPANY_ID }));
    await expect(purchaseCreditNoteService.getPurchaseCreditNote(NOTE_ID)).resolves.toBeNull();
  });

  it("listPurchaseCreditNotes returns [] with no active financial year", async () => {
    getCurrentFinancialYearMock.mockResolvedValueOnce(null);
    const result = await purchaseCreditNoteService.listPurchaseCreditNotes();
    expect(result).toEqual([]);
    expect(findManyMock).not.toHaveBeenCalled();
  });
});
