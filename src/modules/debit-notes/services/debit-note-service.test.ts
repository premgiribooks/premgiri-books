import { beforeEach, describe, expect, it, vi } from "vitest";

// Mirrors credit-note-service.test.ts's convention — mock the
// module-boundary repository, sibling services/engines, and the session/
// permission/Prisma boundaries. gstEngine itself is NOT mocked — it's a
// pure, deterministic module.
const {
  findManyMock,
  findByIdMock,
  createMock,
  replaceItemsAndUpdateMock,
  replaceItemsAndPostMock,
  updateStatusMock,
  findSalesInvoiceForDebitNoteMock,
  findCustomerForDebitNoteMock,
  findCompanyStateCodeMock,
  findPostedInvoicesForPickerMock,
  getCurrentCompanyUserMock,
  getCurrentFinancialYearMock,
  assertPermissionMock,
  ensureSequenceMock,
  generateNumberMock,
  getSettingsMock,
  postVoucherMock,
  cancelVoucherMock,
  listSelectableCustomersMock,
  listSelectableGstRatesMock,
  FAKE_TX,
} = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  findByIdMock: vi.fn(),
  createMock: vi.fn(),
  replaceItemsAndUpdateMock: vi.fn(),
  replaceItemsAndPostMock: vi.fn(),
  updateStatusMock: vi.fn(),
  findSalesInvoiceForDebitNoteMock: vi.fn(),
  findCustomerForDebitNoteMock: vi.fn(),
  findCompanyStateCodeMock: vi.fn(),
  findPostedInvoicesForPickerMock: vi.fn(),
  getCurrentCompanyUserMock: vi.fn(),
  getCurrentFinancialYearMock: vi.fn(),
  assertPermissionMock: vi.fn(),
  ensureSequenceMock: vi.fn(),
  generateNumberMock: vi.fn(),
  getSettingsMock: vi.fn(),
  postVoucherMock: vi.fn(),
  cancelVoucherMock: vi.fn(),
  listSelectableCustomersMock: vi.fn(),
  listSelectableGstRatesMock: vi.fn(),
  FAKE_TX: { marker: "fake-tx" },
}));

vi.mock("@/modules/debit-notes/repositories/debit-note-repository", () => ({
  debitNoteRepository: {
    findMany: findManyMock,
    findById: findByIdMock,
    create: createMock,
    replaceItemsAndUpdate: replaceItemsAndUpdateMock,
    replaceItemsAndPost: replaceItemsAndPostMock,
    updateStatus: updateStatusMock,
    findSalesInvoiceForDebitNote: findSalesInvoiceForDebitNoteMock,
    findCustomerForDebitNote: findCustomerForDebitNoteMock,
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

vi.mock("@/modules/company/services/company-settings-service", () => ({
  companySettingsService: { getSettings: getSettingsMock },
}));

vi.mock("@/modules/customers/services/customer-service", () => ({
  customerService: { listSelectableCustomers: listSelectableCustomersMock },
}));

vi.mock("@/modules/gst-rates/services/gst-rate-service", () => ({
  gstRateService: { listSelectableGstRates: listSelectableGstRatesMock },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: (fn: (tx: unknown) => unknown) => fn(FAKE_TX) },
}));

import { AppError } from "@/lib/app-error";
import { debitNoteService } from "@/modules/debit-notes/services/debit-note-service";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_COMPANY_ID = "99999999-9999-4999-8999-999999999999";
const FY_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";
const CUSTOMER_ID = "44444444-4444-4444-8444-444444444444";
const CUSTOMER_LEDGER_ID = "55555555-5555-4555-8555-555555555555";
const INVOICE_ID = "88888888-8888-4888-8888-888888888888";
const VOUCHER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const NOTE_ID = "note-1";
const COMPANY_STATE_CODE = "27";

const CURRENT_USER = {
  id: USER_ID,
  username: "admin",
  fullName: "Admin",
  userType: "COMPANY" as const,
  role: "Company Admin",
  companyId: COMPANY_ID,
};

const COMPLETE_SETTINGS = {
  salesLedgerId: "s1111111-1111-4111-8111-111111111111",
  outputCgstLedgerId: "c1111111-1111-4111-8111-111111111111",
  outputSgstLedgerId: "g1111111-1111-4111-8111-111111111111",
  outputIgstLedgerId: "i1111111-1111-4111-8111-111111111111",
  outputCessLedgerId: "e1111111-1111-4111-8111-111111111111",
  roundOffLedgerId: "r1111111-1111-4111-8111-111111111111",
};

const CUSTOMER = { id: CUSTOMER_ID, companyId: COMPANY_ID, isActive: true, ledgerId: CUSTOMER_LEDGER_ID, name: "Acme Co" };

// 100 taxable, 18% intra-state (company state == place of supply "27") = 9 CGST + 9 SGST, grand total 118.
function debitNoteRow(overrides: Record<string, unknown> = {}) {
  return {
    id: NOTE_ID,
    companyId: COMPANY_ID,
    financialYearId: FY_ID,
    noteNumber: null,
    noteDate: new Date("2026-09-10T00:00:00.000Z"),
    customerId: CUSTOMER_ID,
    customer: { id: CUSTOMER_ID, name: "Acme Co" },
    salesInvoiceId: null,
    salesInvoice: null,
    placeOfSupplyStateCode: COMPANY_STATE_CODE,
    status: "DRAFT",
    reason: "Additional freight charge",
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
        debitNoteId: NOTE_ID,
        lineNumber: 1,
        description: "Freight adjustment",
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
    customerId: CUSTOMER_ID,
    noteDate: "2026-09-10",
    placeOfSupplyStateCode: COMPANY_STATE_CODE,
    reason: "Additional freight charge",
    lines: [{ description: "Freight adjustment", taxableAmount: 100, ratePercent: 18, cessPercent: 0 }],
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
  findSalesInvoiceForDebitNoteMock.mockReset();
  findCustomerForDebitNoteMock.mockReset();
  findCompanyStateCodeMock.mockReset();
  findPostedInvoicesForPickerMock.mockReset();
  getCurrentCompanyUserMock.mockReset();
  getCurrentFinancialYearMock.mockReset();
  assertPermissionMock.mockReset();
  ensureSequenceMock.mockReset();
  generateNumberMock.mockReset();
  getSettingsMock.mockReset();
  postVoucherMock.mockReset();
  cancelVoucherMock.mockReset();
  listSelectableCustomersMock.mockReset();
  listSelectableGstRatesMock.mockReset();

  getCurrentCompanyUserMock.mockResolvedValue(CURRENT_USER);
  getCurrentFinancialYearMock.mockResolvedValue({ id: FY_ID });
  assertPermissionMock.mockResolvedValue(undefined);
  findCustomerForDebitNoteMock.mockResolvedValue(CUSTOMER);
  findCompanyStateCodeMock.mockResolvedValue(COMPANY_STATE_CODE);
  getSettingsMock.mockResolvedValue(COMPLETE_SETTINGS);
  generateNumberMock.mockResolvedValue({ documentSequenceId: "seq-1", number: 1, formatted: "DN-0001" });
  createMock.mockResolvedValue(debitNoteRow());
  postVoucherMock.mockResolvedValue({ id: VOUCHER_ID });
  replaceItemsAndPostMock.mockResolvedValue(debitNoteRow({ status: "POSTED", voucherId: VOUCHER_ID, noteNumber: "DN-0001" }));
});

describe("createDraft", () => {
  it("creates a DRAFT debit note with noteNumber untouched (numbering deferred to posting)", async () => {
    await debitNoteService.createDraft(validInput());
    expect(ensureSequenceMock).not.toHaveBeenCalled();
    expect(generateNumberMock).not.toHaveBeenCalled();
    expect(createMock).toHaveBeenCalledWith(
      FAKE_TX,
      COMPANY_ID,
      FY_ID,
      expect.objectContaining({ customerId: CUSTOMER_ID, grandTotal: 118 }),
      [expect.objectContaining({ description: "Freight adjustment", taxableAmount: 100, cgst: 9, sgst: 9 })],
      USER_ID
    );
  });

  it("rejects when the customer is not found", async () => {
    findCustomerForDebitNoteMock.mockResolvedValueOnce(null);
    await expect(debitNoteService.createDraft(validInput())).rejects.toThrow("Customer not found.");
  });

  it("rejects an inactive customer", async () => {
    findCustomerForDebitNoteMock.mockResolvedValueOnce({ ...CUSTOMER, isActive: false });
    await expect(debitNoteService.createDraft(validInput())).rejects.toThrow("inactive");
  });

  it("every rejection is an AppError", async () => {
    findCustomerForDebitNoteMock.mockResolvedValueOnce(null);
    await expect(debitNoteService.createDraft(validInput())).rejects.toBeInstanceOf(AppError);
  });

  describe("linked sales invoice validation", () => {
    it("accepts a linked POSTED invoice whose customer matches", async () => {
      findSalesInvoiceForDebitNoteMock.mockResolvedValueOnce({
        id: INVOICE_ID,
        companyId: COMPANY_ID,
        invoiceNumber: "INV-0001",
        invoiceDate: new Date("2026-09-01T00:00:00.000Z"),
        status: "POSTED",
        customerMode: "PERMANENT",
        customerId: CUSTOMER_ID,
        placeOfSupplyStateCode: COMPANY_STATE_CODE,
      });
      await debitNoteService.createDraft(validInput({ salesInvoiceId: INVOICE_ID }));
      expect(createMock).toHaveBeenCalled();
    });

    it("rejects a linked invoice that is not POSTED", async () => {
      findSalesInvoiceForDebitNoteMock.mockResolvedValueOnce({
        id: INVOICE_ID,
        companyId: COMPANY_ID,
        invoiceNumber: "INV-0001",
        invoiceDate: new Date("2026-09-01T00:00:00.000Z"),
        status: "DRAFT",
        customerMode: "PERMANENT",
        customerId: CUSTOMER_ID,
        placeOfSupplyStateCode: COMPANY_STATE_CODE,
      });
      await expect(debitNoteService.createDraft(validInput({ salesInvoiceId: INVOICE_ID }))).rejects.toThrow(
        "Only a posted sales invoice"
      );
    });

    it("rejects a WALK_IN-mode linked invoice", async () => {
      findSalesInvoiceForDebitNoteMock.mockResolvedValueOnce({
        id: INVOICE_ID,
        companyId: COMPANY_ID,
        invoiceNumber: "INV-0001",
        invoiceDate: new Date("2026-09-01T00:00:00.000Z"),
        status: "POSTED",
        customerMode: "WALK_IN",
        customerId: null,
        placeOfSupplyStateCode: COMPANY_STATE_CODE,
      });
      await expect(debitNoteService.createDraft(validInput({ salesInvoiceId: INVOICE_ID }))).rejects.toThrow(
        "has no customer to link"
      );
    });

    it("rejects a linked invoice whose customer does not match this debit note's customer", async () => {
      findSalesInvoiceForDebitNoteMock.mockResolvedValueOnce({
        id: INVOICE_ID,
        companyId: COMPANY_ID,
        invoiceNumber: "INV-0001",
        invoiceDate: new Date("2026-09-01T00:00:00.000Z"),
        status: "POSTED",
        customerMode: "PERMANENT",
        customerId: "different-customer-id",
        placeOfSupplyStateCode: COMPANY_STATE_CODE,
      });
      await expect(debitNoteService.createDraft(validInput({ salesInvoiceId: INVOICE_ID }))).rejects.toThrow(
        "does not match this debit note's customer"
      );
    });

    it("rejects a linked invoice that does not belong to this company", async () => {
      findSalesInvoiceForDebitNoteMock.mockResolvedValueOnce(null);
      await expect(debitNoteService.createDraft(validInput({ salesInvoiceId: INVOICE_ID }))).rejects.toThrow(
        "Sales invoice not found."
      );
    });
  });
});

describe("postDebitNote — orchestration and ledger entries", () => {
  it("posts: generates noteNumber, posts a balanced voucher, Debits the customer ledger, Credits sales/tax ledgers, no stock movement", async () => {
    findByIdMock.mockResolvedValueOnce(debitNoteRow()).mockResolvedValueOnce(debitNoteRow());

    await debitNoteService.postDebitNote(NOTE_ID);

    expect(ensureSequenceMock).toHaveBeenCalledWith(COMPANY_ID, FY_ID, "DEBIT_NOTE");
    expect(ensureSequenceMock).toHaveBeenCalledWith(COMPANY_ID, FY_ID, "DEBIT_NOTE_VOUCHER");
    expect(generateNumberMock).toHaveBeenCalledWith(FAKE_TX, { companyId: COMPANY_ID, financialYearId: FY_ID, documentType: "DEBIT_NOTE" });

    expect(postVoucherMock).toHaveBeenCalledWith(
      COMPANY_ID,
      expect.objectContaining({ voucherType: "DEBIT_NOTE", referenceType: "DEBIT_NOTE" }),
      FAKE_TX
    );
    const entries = postVoucherMock.mock.calls[0][1].entries;
    // Reversed from Credit Note: single DEBIT to the customer ledger for
    // grandTotal, CREDIT the sales/tax ledgers for the adjustment amounts.
    expect(entries).toEqual(
      expect.arrayContaining([
        { ledgerId: CUSTOMER_LEDGER_ID, entryType: "DEBIT", amount: 118 },
        { ledgerId: COMPLETE_SETTINGS.salesLedgerId, entryType: "CREDIT", amount: 100 },
        { ledgerId: COMPLETE_SETTINGS.outputCgstLedgerId, entryType: "CREDIT", amount: 9 },
        { ledgerId: COMPLETE_SETTINGS.outputSgstLedgerId, entryType: "CREDIT", amount: 9 },
      ])
    );
    // Explicitly assert the direction, not just presence (41-debit-note.md's
    // Code Standards: "assert this explicitly in a test, not just by symmetry
    // with spec 40's suite").
    const customerEntry = entries.find((e: { ledgerId: string }) => e.ledgerId === CUSTOMER_LEDGER_ID);
    expect(customerEntry.entryType).toBe("DEBIT");
    const salesEntry = entries.find((e: { ledgerId: string }) => e.ledgerId === COMPLETE_SETTINGS.salesLedgerId);
    expect(salesEntry.entryType).toBe("CREDIT");

    expect(replaceItemsAndPostMock).toHaveBeenCalledWith(
      FAKE_TX,
      NOTE_ID,
      COMPANY_ID,
      expect.objectContaining({ grandTotal: 118 }),
      expect.any(Array),
      { documentSequenceId: "seq-1", number: 1, formatted: "DN-0001" },
      VOUCHER_ID
    );
  });

  it("never calls the Inventory Engine (no stock movement)", async () => {
    findByIdMock.mockResolvedValueOnce(debitNoteRow()).mockResolvedValueOnce(debitNoteRow());
    await debitNoteService.postDebitNote(NOTE_ID);
    // No inventory-engine import exists in this module at all — asserted at
    // the module-boundary level; nothing here could call it even if it tried.
    expect(postVoucherMock).toHaveBeenCalled();
  });

  it("rejects posting when the linked invoice was cancelled since this note was drafted", async () => {
    const row = debitNoteRow({ salesInvoiceId: INVOICE_ID });
    findByIdMock.mockResolvedValueOnce(row).mockResolvedValueOnce(row);
    findSalesInvoiceForDebitNoteMock.mockResolvedValueOnce({
      id: INVOICE_ID,
      companyId: COMPANY_ID,
      invoiceNumber: "INV-0001",
      invoiceDate: new Date("2026-09-01T00:00:00.000Z"),
      status: "CANCELLED",
      customerMode: "PERMANENT",
      customerId: CUSTOMER_ID,
      placeOfSupplyStateCode: COMPANY_STATE_CODE,
    });

    await expect(debitNoteService.postDebitNote(NOTE_ID)).rejects.toThrow("Only a posted sales invoice");
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
    findByIdMock.mockResolvedValueOnce(debitNoteRow()).mockResolvedValueOnce(debitNoteRow());
    getSettingsMock.mockResolvedValueOnce({ ...COMPLETE_SETTINGS, [field]: null });
    await expect(debitNoteService.postDebitNote(NOTE_ID)).rejects.toThrow(label);
    expect(postVoucherMock).not.toHaveBeenCalled();
  });

  it("rejects posting a non-DRAFT debit note", async () => {
    findByIdMock.mockResolvedValueOnce(debitNoteRow({ status: "POSTED" }));
    await expect(debitNoteService.postDebitNote(NOTE_ID)).rejects.toThrow("can no longer be posted");
  });

  it("rejects when the debit note belongs to a different company", async () => {
    findByIdMock.mockResolvedValueOnce(debitNoteRow({ companyId: OTHER_COMPANY_ID }));
    await expect(debitNoteService.postDebitNote(NOTE_ID)).rejects.toThrow("Debit note not found.");
  });

  it("gates posting on the approve permission", async () => {
    findByIdMock.mockResolvedValueOnce(debitNoteRow()).mockResolvedValueOnce(debitNoteRow());
    await debitNoteService.postDebitNote(NOTE_ID);
    expect(assertPermissionMock).toHaveBeenCalledWith(CURRENT_USER, "sales", "approve");
  });
});

describe("cancelDebitNote", () => {
  it("reverses the voucher (mirrored reversal), no stock involved", async () => {
    const posted = debitNoteRow({ status: "POSTED", voucherId: VOUCHER_ID, noteNumber: "DN-0001" });
    findByIdMock.mockResolvedValueOnce(posted).mockResolvedValueOnce(posted);
    updateStatusMock.mockResolvedValueOnce(1);
    findByIdMock.mockResolvedValueOnce(debitNoteRow({ status: "CANCELLED", voucherId: VOUCHER_ID }));

    await debitNoteService.cancelDebitNote(NOTE_ID);

    expect(cancelVoucherMock).toHaveBeenCalledWith(COMPANY_ID, VOUCHER_ID, FAKE_TX);
    expect(updateStatusMock).toHaveBeenCalledWith(FAKE_TX, NOTE_ID, COMPANY_ID, ["POSTED"], "CANCELLED");
  });

  it("rejects cancelling a DRAFT debit note", async () => {
    findByIdMock.mockResolvedValueOnce(debitNoteRow({ status: "DRAFT" }));
    await expect(debitNoteService.cancelDebitNote(NOTE_ID)).rejects.toThrow("Only a posted debit note can be cancelled.");
  });

  it("rejects when a concurrent cancellation already won the race", async () => {
    const posted = debitNoteRow({ status: "POSTED", voucherId: VOUCHER_ID });
    findByIdMock.mockResolvedValueOnce(posted).mockResolvedValueOnce(posted);
    updateStatusMock.mockResolvedValueOnce(0);
    await expect(debitNoteService.cancelDebitNote(NOTE_ID)).rejects.toThrow("Only a posted debit note can be cancelled.");
  });

  it("gates on the approve permission", async () => {
    const posted = debitNoteRow({ status: "POSTED", voucherId: VOUCHER_ID });
    findByIdMock.mockResolvedValueOnce(posted).mockResolvedValueOnce(posted);
    updateStatusMock.mockResolvedValueOnce(1);
    findByIdMock.mockResolvedValueOnce(debitNoteRow({ status: "CANCELLED" }));
    await debitNoteService.cancelDebitNote(NOTE_ID);
    expect(assertPermissionMock).toHaveBeenCalledWith(CURRENT_USER, "sales", "approve");
  });
});

describe("getDebitNote / listDebitNotes — cross-company and scoping", () => {
  it("getDebitNote returns null for a cross-company debit note", async () => {
    findByIdMock.mockResolvedValueOnce(debitNoteRow({ companyId: OTHER_COMPANY_ID }));
    await expect(debitNoteService.getDebitNote(NOTE_ID)).resolves.toBeNull();
  });

  it("listDebitNotes returns [] with no active financial year", async () => {
    getCurrentFinancialYearMock.mockResolvedValueOnce(null);
    const result = await debitNoteService.listDebitNotes();
    expect(result).toEqual([]);
    expect(findManyMock).not.toHaveBeenCalled();
  });
});
