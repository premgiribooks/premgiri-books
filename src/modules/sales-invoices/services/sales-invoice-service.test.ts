import { beforeEach, describe, expect, it, vi } from "vitest";

// Mirrors sales-order-service.test.ts's / delivery-challan-service.test.ts's
// convention — mock the module-boundary repository, sibling services/
// engines, and the session/permission/Prisma boundaries. The GST Engine
// itself is left REAL so the engine-composition assertions are genuine.
const {
  findManyMock,
  findByIdMock,
  createMock,
  replaceItemsAndUpdateMock,
  replaceItemsAndPostMock,
  updateStatusMock,
  findCustomerForInvoiceMock,
  findProductsForLinesMock,
  findWarehousesForLinesMock,
  findInvoiceableProductsMock,
  findSelectableWarehousesMock,
  findCompanyStateCodeMock,
  aggregateItemWiseSalesMock,
  aggregatePartyWiseSalesMock,
  getCurrentCompanyUserMock,
  getCurrentFinancialYearMock,
  assertPermissionMock,
  ensureSequenceMock,
  generateNumberMock,
  previewNextNumberMock,
  listSelectableCustomersMock,
  listSelectableLedgerGroupsForSaleMock,
  createCustomerFromSaleMock,
  listSelectableLedgersMock,
  getSettingsMock,
  getDeliveryChallanMock,
  markInvoicedMock,
  getSalesOrderMock,
  postVoucherMock,
  cancelVoucherMock,
  recordMovementsMock,
  resolvePriceMock,
  FAKE_TX,
} = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  findByIdMock: vi.fn(),
  createMock: vi.fn(),
  replaceItemsAndUpdateMock: vi.fn(),
  replaceItemsAndPostMock: vi.fn(),
  updateStatusMock: vi.fn(),
  findCustomerForInvoiceMock: vi.fn(),
  findProductsForLinesMock: vi.fn(),
  findWarehousesForLinesMock: vi.fn(),
  findInvoiceableProductsMock: vi.fn(),
  findSelectableWarehousesMock: vi.fn(),
  findCompanyStateCodeMock: vi.fn(),
  aggregateItemWiseSalesMock: vi.fn(),
  aggregatePartyWiseSalesMock: vi.fn(),
  getCurrentCompanyUserMock: vi.fn(),
  getCurrentFinancialYearMock: vi.fn(),
  assertPermissionMock: vi.fn(),
  ensureSequenceMock: vi.fn(),
  generateNumberMock: vi.fn(),
  previewNextNumberMock: vi.fn(),
  listSelectableCustomersMock: vi.fn(),
  listSelectableLedgerGroupsForSaleMock: vi.fn(),
  createCustomerFromSaleMock: vi.fn(),
  listSelectableLedgersMock: vi.fn(),
  getSettingsMock: vi.fn(),
  getDeliveryChallanMock: vi.fn(),
  markInvoicedMock: vi.fn(),
  getSalesOrderMock: vi.fn(),
  postVoucherMock: vi.fn(),
  cancelVoucherMock: vi.fn(),
  recordMovementsMock: vi.fn(),
  resolvePriceMock: vi.fn(),
  FAKE_TX: { marker: "fake-tx" },
}));

vi.mock("@/modules/sales-invoices/repositories/sales-invoice-repository", () => ({
  salesInvoiceRepository: {
    findMany: findManyMock,
    findById: findByIdMock,
    create: createMock,
    replaceItemsAndUpdate: replaceItemsAndUpdateMock,
    replaceItemsAndPost: replaceItemsAndPostMock,
    updateStatus: updateStatusMock,
    findCustomerForInvoice: findCustomerForInvoiceMock,
    findProductsForLines: findProductsForLinesMock,
    findWarehousesForLines: findWarehousesForLinesMock,
    findInvoiceableProducts: findInvoiceableProductsMock,
    findSelectableWarehouses: findSelectableWarehousesMock,
    findCompanyStateCode: findCompanyStateCodeMock,
    aggregateItemWiseSales: aggregateItemWiseSalesMock,
    aggregatePartyWiseSales: aggregatePartyWiseSalesMock,
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

vi.mock("@/engines/pricing/pricing-engine", () => ({ pricingEngine: { resolvePrice: resolvePriceMock } }));
vi.mock("@/engines/voucher/voucher-engine", () => ({
  voucherEngine: { postVoucher: postVoucherMock, cancelVoucher: cancelVoucherMock },
}));
vi.mock("@/engines/inventory/inventory-engine", () => ({
  inventoryEngine: { recordMovements: recordMovementsMock },
}));

vi.mock("@/modules/customers/services/customer-service", () => ({
  customerService: {
    listSelectableCustomers: listSelectableCustomersMock,
    listSelectableLedgerGroupsForSale: listSelectableLedgerGroupsForSaleMock,
    createCustomerFromSale: createCustomerFromSaleMock,
  },
}));
vi.mock("@/modules/sales-orders/services/sales-order-service", () => ({
  salesOrderService: { getSalesOrder: getSalesOrderMock },
}));

vi.mock("@/modules/delivery-challans/services/delivery-challan-service", () => ({
  deliveryChallanService: { getDeliveryChallan: getDeliveryChallanMock, markInvoiced: markInvoicedMock },
}));
vi.mock("@/modules/ledgers/services/ledger-service", () => ({
  ledgerService: { listSelectableLedgers: listSelectableLedgersMock },
}));
vi.mock("@/modules/company/services/company-settings-service", () => ({
  companySettingsService: { getSettings: getSettingsMock },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: (fn: (tx: unknown) => unknown) => fn(FAKE_TX) },
}));

import { AppError } from "@/lib/app-error";
import { salesInvoiceService } from "@/modules/sales-invoices/services/sales-invoice-service";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_COMPANY_ID = "99999999-9999-4999-8999-999999999999";
const FY_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";
const CUSTOMER_ID = "44444444-4444-4444-8444-444444444444";
const PRODUCT_ID = "55555555-5555-4555-8555-555555555555";
const WAREHOUSE_ID = "66666666-6666-4666-8666-666666666666";
const LEDGER_ID = "77777777-7777-4777-8777-777777777777";
const CUSTOMER_LEDGER_ID = "88888888-8888-4888-8888-888888888888";
const NEW_LEDGER_GROUP_ID = "99999999-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const NEW_CUSTOMER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const NEW_CUSTOMER_LEDGER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const DELIVERY_CHALLAN_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const VOUCHER_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

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

const ACTIVE_CUSTOMER = { id: CUSTOMER_ID, companyId: COMPANY_ID, isActive: true, ledgerId: CUSTOMER_LEDGER_ID, creditLimit: null };

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
  sellingPrice: 100,
  purchasePrice: 50,
};

const WAREHOUSE = { id: WAREHOUSE_ID, name: "Main Warehouse", code: "WH1", isActive: true };

const COMPLETE_SETTINGS = {
  salesLedgerId: "s1111111-1111-4111-8111-111111111111",
  outputCgstLedgerId: "c1111111-1111-4111-8111-111111111111",
  outputSgstLedgerId: "g1111111-1111-4111-8111-111111111111",
  outputIgstLedgerId: "i1111111-1111-4111-8111-111111111111",
  outputCessLedgerId: "e1111111-1111-4111-8111-111111111111",
  roundOffLedgerId: "r1111111-1111-4111-8111-111111111111",
};

function validLines() {
  return [{ productId: PRODUCT_ID, warehouseId: WAREHOUSE_ID, quantity: 2, rate: 100 }];
}

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    customerMode: "PERMANENT" as const,
    customerId: CUSTOMER_ID,
    invoiceDate: "2026-09-10",
    placeOfSupplyStateCode: "27",
    lines: validLines(),
    payments: [],
    ...overrides,
  };
}

function invoiceRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "inv-1",
    companyId: COMPANY_ID,
    financialYearId: FY_ID,
    invoiceNumber: "INV-0001",
    status: "DRAFT",
    customerMode: "PERMANENT",
    customerId: CUSTOMER_ID,
    quickCustomerName: null,
    quickCustomerMobile: null,
    quickCustomerGstin: null,
    quickCustomerAddress: null,
    placeOfSupplyStateCode: "27",
    invoiceDate: new Date("2026-09-10T00:00:00.000Z"),
    narration: null,
    salesOrderId: null,
    deliveryChallanId: null,
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
  findCustomerForInvoiceMock.mockReset();
  findProductsForLinesMock.mockReset();
  findWarehousesForLinesMock.mockReset();
  findInvoiceableProductsMock.mockReset();
  findSelectableWarehousesMock.mockReset();
  findCompanyStateCodeMock.mockReset();
  aggregateItemWiseSalesMock.mockReset();
  aggregatePartyWiseSalesMock.mockReset();
  getCurrentCompanyUserMock.mockReset();
  getCurrentFinancialYearMock.mockReset();
  assertPermissionMock.mockReset();
  ensureSequenceMock.mockReset();
  generateNumberMock.mockReset();
  previewNextNumberMock.mockReset();
  listSelectableCustomersMock.mockReset();
  listSelectableLedgerGroupsForSaleMock.mockReset();
  createCustomerFromSaleMock.mockReset();
  listSelectableLedgersMock.mockReset();
  getSettingsMock.mockReset();
  getDeliveryChallanMock.mockReset();
  markInvoicedMock.mockReset();
  getSalesOrderMock.mockReset();
  postVoucherMock.mockReset();
  cancelVoucherMock.mockReset();
  recordMovementsMock.mockReset();
  resolvePriceMock.mockReset();

  getCurrentCompanyUserMock.mockResolvedValue(CURRENT_USER);
  getCurrentFinancialYearMock.mockResolvedValue(CURRENT_FY);
  assertPermissionMock.mockResolvedValue(undefined);
  findCustomerForInvoiceMock.mockResolvedValue(ACTIVE_CUSTOMER);
  findCompanyStateCodeMock.mockResolvedValue("27");
  findProductsForLinesMock.mockResolvedValue([PRODUCT]);
  findWarehousesForLinesMock.mockResolvedValue([WAREHOUSE]);
  generateNumberMock.mockResolvedValue({ documentSequenceId: "seq-1", number: 1, formatted: "INV-0001" });
  createMock.mockResolvedValue(invoiceRow());
  getSettingsMock.mockResolvedValue(COMPLETE_SETTINGS);
  // Lenient default — only exercised when a test sets a truthy salesOrderId;
  // most fixtures don't link one, so this just needs to resolve non-null.
  getSalesOrderMock.mockResolvedValue({ id: "so-default", companyId: COMPANY_ID });
  postVoucherMock.mockResolvedValue({ id: VOUCHER_ID });
  recordMovementsMock.mockResolvedValue([]);
  replaceItemsAndPostMock.mockResolvedValue(invoiceRow({ status: "POSTED", voucherId: VOUCHER_ID }));
});

describe("createDraft", () => {
  it("creates a DRAFT invoice with no payments", async () => {
    await salesInvoiceService.createDraft(validInput());
    expect(ensureSequenceMock).toHaveBeenCalledWith(COMPANY_ID, FY_ID, "SALES_INVOICE");
    expect(createMock).toHaveBeenCalledWith(
      FAKE_TX,
      COMPANY_ID,
      FY_ID,
      expect.objectContaining({ customerMode: "PERMANENT", customerId: CUSTOMER_ID }),
      [expect.objectContaining({ productId: PRODUCT_ID })],
      [],
      { documentSequenceId: "seq-1", number: 1, formatted: "INV-0001" },
      USER_ID
    );
  });

  it("rejects an overpayment against the freshly computed grand total", async () => {
    await expect(
      salesInvoiceService.createDraft(validInput({ payments: [{ ledgerId: LEDGER_ID, amount: 100000 }] }))
    ).rejects.toThrow("cannot exceed the invoice's grand total");
  });

  it("WALK_IN with less than full payment is rejected", async () => {
    await expect(
      salesInvoiceService.createDraft(
        validInput({ customerMode: "WALK_IN", customerId: undefined, payments: [{ ledgerId: LEDGER_ID, amount: 1 }] })
      )
    ).rejects.toThrow("Walk-in sales require full payment.");
  });

  it("rejects when the PERMANENT customer does not exist", async () => {
    findCustomerForInvoiceMock.mockResolvedValueOnce(null);
    await expect(salesInvoiceService.createDraft(validInput())).rejects.toThrow("Customer not found.");
  });

  it("every rejection is an AppError", async () => {
    findCustomerForInvoiceMock.mockResolvedValueOnce(null);
    await expect(salesInvoiceService.createDraft(validInput())).rejects.toBeInstanceOf(AppError);
  });
});

describe("postSalesInvoice — orchestration order and ledger entries", () => {
  it("posts a PERMANENT credit invoice: stock OUT, then balanced voucher, correct entries", async () => {
    findByIdMock.mockResolvedValueOnce(invoiceRow());
    findByIdMock.mockResolvedValueOnce(invoiceRow());

    await salesInvoiceService.postSalesInvoice("inv-1");

    expect(recordMovementsMock).toHaveBeenCalledWith(
      COMPANY_ID,
      [expect.objectContaining({ productId: PRODUCT_ID, direction: "OUT", transactionType: "SALES" })],
      FAKE_TX
    );
    expect(postVoucherMock).toHaveBeenCalledWith(
      COMPANY_ID,
      expect.objectContaining({ voucherType: "SALES", referenceType: "SALES_INVOICE" }),
      FAKE_TX
    );

    const entries = postVoucherMock.mock.calls[0][1].entries;
    // 2 x 100 = 200 taxable, 18% GST intra-state = 18 CGST + 18 SGST, grand total 236, no payments -> full remainder to customer ledger.
    expect(entries).toEqual(
      expect.arrayContaining([
        { ledgerId: COMPLETE_SETTINGS.salesLedgerId, entryType: "CREDIT", amount: 200 },
        { ledgerId: COMPLETE_SETTINGS.outputCgstLedgerId, entryType: "CREDIT", amount: 18 },
        { ledgerId: COMPLETE_SETTINGS.outputSgstLedgerId, entryType: "CREDIT", amount: 18 },
        { ledgerId: CUSTOMER_LEDGER_ID, entryType: "DEBIT", amount: 236 },
      ])
    );

    expect(replaceItemsAndPostMock).toHaveBeenCalledWith(
      FAKE_TX,
      "inv-1",
      COMPANY_ID,
      expect.objectContaining({ grandTotal: 236 }),
      expect.any(Array),
      expect.any(Array),
      VOUCHER_ID
    );
  });

  it("produces IGST instead of CGST/SGST for an inter-state supply", async () => {
    const row = invoiceRow({ placeOfSupplyStateCode: "07" });
    findByIdMock.mockResolvedValueOnce(row).mockResolvedValueOnce(row);

    await salesInvoiceService.postSalesInvoice("inv-1");

    const entries = postVoucherMock.mock.calls[0][1].entries;
    expect(entries).toEqual(
      expect.arrayContaining([{ ledgerId: COMPLETE_SETTINGS.outputIgstLedgerId, entryType: "CREDIT", amount: 36 }])
    );
    expect(entries.some((e: { ledgerId: string }) => e.ledgerId === COMPLETE_SETTINGS.outputCgstLedgerId)).toBe(false);
  });

  it("posts no customer-ledger entry when payments cover the grand total exactly", async () => {
    const row = invoiceRow({ payments: [{ ledgerId: LEDGER_ID, amount: 236 }] });
    findByIdMock.mockResolvedValueOnce(row).mockResolvedValueOnce(row);

    await salesInvoiceService.postSalesInvoice("inv-1");

    const entries = postVoucherMock.mock.calls[0][1].entries;
    expect(entries.some((e: { ledgerId: string }) => e.ledgerId === CUSTOMER_LEDGER_ID)).toBe(false);
    expect(entries).toEqual(expect.arrayContaining([{ ledgerId: LEDGER_ID, entryType: "DEBIT", amount: 236 }]));
  });

  it("rejects an overpayment for a PERMANENT invoice, validated against the freshly recomputed total", async () => {
    const row = invoiceRow({ payments: [{ ledgerId: LEDGER_ID, amount: 500 }] });
    findByIdMock.mockResolvedValueOnce(row).mockResolvedValueOnce(row);
    await expect(salesInvoiceService.postSalesInvoice("inv-1")).rejects.toThrow(
      "Total payments cannot exceed the invoice's grand total."
    );
    expect(postVoucherMock).not.toHaveBeenCalled();
  });

  it("rejects an underpaid WALK_IN invoice at posting", async () => {
    const row = invoiceRow({ customerMode: "WALK_IN", customerId: null, payments: [{ ledgerId: LEDGER_ID, amount: 1 }] });
    findByIdMock.mockResolvedValueOnce(row).mockResolvedValueOnce(row);
    await expect(salesInvoiceService.postSalesInvoice("inv-1")).rejects.toThrow("Walk-in sales require full payment.");
  });

  it("posts a fully-paid WALK_IN invoice with no customer-ledger entry", async () => {
    const row = invoiceRow({ customerMode: "WALK_IN", customerId: null, payments: [{ ledgerId: LEDGER_ID, amount: 236 }] });
    findByIdMock.mockResolvedValueOnce(row).mockResolvedValueOnce(row);
    await salesInvoiceService.postSalesInvoice("inv-1");
    const entries = postVoucherMock.mock.calls[0][1].entries;
    expect(entries.some((e: { entryType: string; ledgerId: string }) => e.entryType === "DEBIT" && e.ledgerId !== LEDGER_ID)).toBe(
      false
    );
  });

  it.each([
    ["salesLedgerId", "Sales Account"],
    ["outputCgstLedgerId", "Output CGST"],
    ["outputSgstLedgerId", "Output SGST"],
    ["outputIgstLedgerId", "Output IGST"],
    ["outputCessLedgerId", "Output Cess"],
    ["roundOffLedgerId", "Round Off"],
  ])("rejects posting when %s is not configured, naming %s", async (field, label) => {
    const row = invoiceRow();
    findByIdMock.mockResolvedValueOnce(row).mockResolvedValueOnce(row);
    getSettingsMock.mockResolvedValueOnce({ ...COMPLETE_SETTINGS, [field]: null });
    await expect(salesInvoiceService.postSalesInvoice("inv-1")).rejects.toThrow(label);
    expect(postVoucherMock).not.toHaveBeenCalled();
  });

  it("rejects posting a non-DRAFT invoice", async () => {
    findByIdMock.mockResolvedValueOnce(invoiceRow({ status: "POSTED" }));
    await expect(salesInvoiceService.postSalesInvoice("inv-1")).rejects.toThrow("can no longer be posted");
  });

  it("rejects when the invoice belongs to a different company", async () => {
    findByIdMock.mockResolvedValueOnce(invoiceRow({ companyId: OTHER_COMPANY_ID }));
    await expect(salesInvoiceService.postSalesInvoice("inv-1")).rejects.toThrow("Sales invoice not found.");
  });
});

describe("postSalesInvoice — below-cost and HSN gates", () => {
  it("blocks posting a below-cost line without approve permission", async () => {
    const row = invoiceRow({ items: [{ ...invoiceRow().items[0], rate: 10 }] });
    findByIdMock.mockResolvedValueOnce(row).mockResolvedValueOnce(row);
    assertPermissionMock.mockImplementation(async (_user, _module, action) => {
      if (action === "approve") {
        throw new AppError("Insufficient permissions.");
      }
    });
    await expect(salesInvoiceService.postSalesInvoice("inv-1")).rejects.toThrow("Insufficient permissions.");
  });

  it("allows posting a below-cost line with approve permission", async () => {
    const row = invoiceRow({ items: [{ ...invoiceRow().items[0], rate: 10 }] });
    findByIdMock.mockResolvedValueOnce(row).mockResolvedValueOnce(row);
    await salesInvoiceService.postSalesInvoice("inv-1");
    expect(assertPermissionMock).toHaveBeenCalledWith(CURRENT_USER, "sales", "approve");
    expect(postVoucherMock).toHaveBeenCalled();
  });

  it("hard-blocks posting a taxed line with no HSN code, unconditionally", async () => {
    const row = invoiceRow();
    findByIdMock.mockResolvedValueOnce(row).mockResolvedValueOnce(row);
    findProductsForLinesMock.mockResolvedValueOnce([{ ...PRODUCT, hsnCode: null }]);
    await expect(salesInvoiceService.postSalesInvoice("inv-1")).rejects.toThrow("HSN/SAC code is required");
    expect(postVoucherMock).not.toHaveBeenCalled();
  });
});

describe("postSalesInvoice — tax override audit trail", () => {
  it("stores computed values, uses overridden values in the posted voucher", async () => {
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

    await salesInvoiceService.postSalesInvoice("inv-1");

    const persistedLines = replaceItemsAndPostMock.mock.calls[0][4];
    expect(persistedLines[0]).toEqual(
      expect.objectContaining({ cgst: 18, sgst: 18, overriddenCgst: 5, overriddenSgst: 5, isTaxOverridden: true })
    );
    const entries = postVoucherMock.mock.calls[0][1].entries;
    expect(entries).toEqual(expect.arrayContaining([{ ledgerId: COMPLETE_SETTINGS.outputCgstLedgerId, entryType: "CREDIT", amount: 5 }]));
  });
});

describe("postSalesInvoice — Quick Customer conversion", () => {
  function quickInvoiceRow(overrides: Record<string, unknown> = {}) {
    return invoiceRow({
      customerMode: "QUICK",
      customerId: null,
      quickCustomerName: "Jane Doe",
      quickCustomerMobile: "9999999999",
      ...overrides,
    });
  }

  beforeEach(() => {
    listSelectableLedgerGroupsForSaleMock.mockResolvedValue([{ id: NEW_LEDGER_GROUP_ID }]);
    createCustomerFromSaleMock.mockResolvedValue({ id: NEW_CUSTOMER_ID, ledger: { id: NEW_CUSTOMER_LEDGER_ID } });
  });

  it("auto-converts when posting would leave an unpaid balance", async () => {
    const row = quickInvoiceRow();
    findByIdMock.mockResolvedValueOnce(row).mockResolvedValueOnce(row);

    await salesInvoiceService.postSalesInvoice("inv-1");

    expect(createCustomerFromSaleMock).toHaveBeenCalledWith(
      expect.objectContaining({ displayName: "Jane Doe", ledgerGroupId: NEW_LEDGER_GROUP_ID }),
      FAKE_TX
    );
    const entries = postVoucherMock.mock.calls[0][1].entries;
    expect(entries).toEqual(expect.arrayContaining([{ ledgerId: NEW_CUSTOMER_LEDGER_ID, entryType: "DEBIT", amount: 236 }]));
    expect(replaceItemsAndPostMock).toHaveBeenCalledWith(
      FAKE_TX,
      "inv-1",
      COMPANY_ID,
      expect.objectContaining({ customerMode: "PERMANENT", customerId: NEW_CUSTOMER_ID }),
      expect.any(Array),
      expect.any(Array),
      VOUCHER_ID
    );
  });

  it("does NOT convert when the QUICK invoice is fully paid", async () => {
    const row = quickInvoiceRow({ payments: [{ ledgerId: LEDGER_ID, amount: 236 }] });
    findByIdMock.mockResolvedValueOnce(row).mockResolvedValueOnce(row);

    await salesInvoiceService.postSalesInvoice("inv-1");

    expect(createCustomerFromSaleMock).not.toHaveBeenCalled();
  });

  it("skips re-conversion when customerId is already set (retry-safe)", async () => {
    const row = quickInvoiceRow({ customerId: CUSTOMER_ID, customerMode: "QUICK" });
    findByIdMock.mockResolvedValueOnce(row).mockResolvedValueOnce(row);

    await salesInvoiceService.postSalesInvoice("inv-1");

    expect(createCustomerFromSaleMock).not.toHaveBeenCalled();
    expect(findCustomerForInvoiceMock).toHaveBeenCalledWith(FAKE_TX, COMPANY_ID, CUSTOMER_ID);
  });

  it("rejects when multiple Sundry Debtors groups exist (punts to manual conversion)", async () => {
    listSelectableLedgerGroupsForSaleMock.mockResolvedValueOnce([{ id: "g1" }, { id: "g2" }]);
    const row = quickInvoiceRow();
    findByIdMock.mockResolvedValueOnce(row).mockResolvedValueOnce(row);
    await expect(salesInvoiceService.postSalesInvoice("inv-1")).rejects.toThrow("convert this Quick Customer manually");
  });
});

describe("postSalesInvoice — Delivery Challan consistency", () => {
  function challan(overrides: Record<string, unknown> = {}) {
    return {
      id: DELIVERY_CHALLAN_ID,
      companyId: COMPANY_ID,
      customerId: CUSTOMER_ID,
      salesOrderId: null,
      status: "DISPATCHED",
      items: [{ productId: PRODUCT_ID, quantity: 2 }],
      ...overrides,
    };
  }

  it("posts successfully and marks the challan invoiced when everything matches", async () => {
    const row = invoiceRow({ deliveryChallanId: DELIVERY_CHALLAN_ID });
    findByIdMock.mockResolvedValueOnce(row).mockResolvedValueOnce(row);
    getDeliveryChallanMock.mockResolvedValueOnce(challan());

    await salesInvoiceService.postSalesInvoice("inv-1");

    expect(markInvoicedMock).toHaveBeenCalledWith(DELIVERY_CHALLAN_ID, FAKE_TX);
  });

  it("rejects when the challan's customer does not match", async () => {
    const row = invoiceRow({ deliveryChallanId: DELIVERY_CHALLAN_ID });
    findByIdMock.mockResolvedValueOnce(row).mockResolvedValueOnce(row);
    getDeliveryChallanMock.mockResolvedValueOnce(challan({ customerId: "different-customer" }));
    await expect(salesInvoiceService.postSalesInvoice("inv-1")).rejects.toThrow("customer does not match");
  });

  it("rejects when the challan belongs to a different company", async () => {
    const row = invoiceRow({ deliveryChallanId: DELIVERY_CHALLAN_ID });
    findByIdMock.mockResolvedValueOnce(row).mockResolvedValueOnce(row);
    getDeliveryChallanMock.mockResolvedValueOnce(challan({ companyId: OTHER_COMPANY_ID }));
    await expect(salesInvoiceService.postSalesInvoice("inv-1")).rejects.toThrow("Delivery challan not found.");
  });

  it("rejects when the invoice's own salesOrderId disagrees with the challan's", async () => {
    const row = invoiceRow({ deliveryChallanId: DELIVERY_CHALLAN_ID, salesOrderId: "so-a" });
    findByIdMock.mockResolvedValueOnce(row).mockResolvedValueOnce(row);
    getDeliveryChallanMock.mockResolvedValueOnce(challan({ salesOrderId: "so-b" }));
    await expect(salesInvoiceService.postSalesInvoice("inv-1")).rejects.toThrow("does not match the delivery challan");
  });

  it("rejects when a line's product/quantity does not match the challan's lines", async () => {
    const row = invoiceRow({ deliveryChallanId: DELIVERY_CHALLAN_ID });
    findByIdMock.mockResolvedValueOnce(row).mockResolvedValueOnce(row);
    getDeliveryChallanMock.mockResolvedValueOnce(challan({ items: [{ productId: PRODUCT_ID, quantity: 999 }] }));
    await expect(salesInvoiceService.postSalesInvoice("inv-1")).rejects.toThrow("must match one of the linked delivery challan");
  });

  it("rejects when the challan is no longer DISPATCHED", async () => {
    const row = invoiceRow({ deliveryChallanId: DELIVERY_CHALLAN_ID });
    findByIdMock.mockResolvedValueOnce(row).mockResolvedValueOnce(row);
    getDeliveryChallanMock.mockResolvedValueOnce(challan({ status: "INVOICED" }));
    await expect(salesInvoiceService.postSalesInvoice("inv-1")).rejects.toThrow("not dispatched");
  });
});

describe("cancelSalesInvoice", () => {
  it("reverses the voucher and stock (direction IN) atomically, both on the same tx", async () => {
    const posted = invoiceRow({ status: "POSTED", voucherId: VOUCHER_ID });
    findByIdMock.mockResolvedValueOnce(posted).mockResolvedValueOnce(posted);
    updateStatusMock.mockResolvedValueOnce(1);
    findByIdMock.mockResolvedValueOnce(invoiceRow({ status: "CANCELLED", voucherId: VOUCHER_ID }));

    await salesInvoiceService.cancelSalesInvoice("inv-1");

    expect(cancelVoucherMock).toHaveBeenCalledWith(COMPANY_ID, VOUCHER_ID, FAKE_TX);
    expect(recordMovementsMock).toHaveBeenCalledWith(
      COMPANY_ID,
      [expect.objectContaining({ direction: "IN", transactionType: "SALES" })],
      FAKE_TX
    );
    expect(updateStatusMock).toHaveBeenCalledWith(FAKE_TX, "inv-1", COMPANY_ID, ["POSTED"], "CANCELLED");
  });

  it("rejects cancelling a DRAFT invoice", async () => {
    findByIdMock.mockResolvedValueOnce(invoiceRow({ status: "DRAFT" }));
    await expect(salesInvoiceService.cancelSalesInvoice("inv-1")).rejects.toThrow(
      "Only a posted sales invoice can be cancelled."
    );
  });

  it("rejects when a concurrent cancellation already won the race", async () => {
    const posted = invoiceRow({ status: "POSTED", voucherId: VOUCHER_ID });
    findByIdMock.mockResolvedValueOnce(posted).mockResolvedValueOnce(posted);
    updateStatusMock.mockResolvedValueOnce(0);
    await expect(salesInvoiceService.cancelSalesInvoice("inv-1")).rejects.toThrow(
      "Only a posted sales invoice can be cancelled."
    );
  });

  it("gates on the approve permission, not just edit", async () => {
    const posted = invoiceRow({ status: "POSTED", voucherId: VOUCHER_ID });
    findByIdMock.mockResolvedValueOnce(posted).mockResolvedValueOnce(posted);
    updateStatusMock.mockResolvedValueOnce(1);
    findByIdMock.mockResolvedValueOnce(invoiceRow({ status: "CANCELLED" }));
    await salesInvoiceService.cancelSalesInvoice("inv-1");
    expect(assertPermissionMock).toHaveBeenCalledWith(CURRENT_USER, "sales", "approve");
  });
});

describe("getSalesInvoice / listSalesInvoices — cross-company and scoping", () => {
  it("getSalesInvoice returns null for a cross-company invoice", async () => {
    findByIdMock.mockResolvedValueOnce(invoiceRow({ companyId: OTHER_COMPANY_ID }));
    await expect(salesInvoiceService.getSalesInvoice("inv-1")).resolves.toBeNull();
  });

  it("listSalesInvoices returns [] with no active financial year", async () => {
    getCurrentFinancialYearMock.mockResolvedValueOnce(null);
    const result = await salesInvoiceService.listSalesInvoices();
    expect(result).toEqual([]);
    expect(findManyMock).not.toHaveBeenCalled();
  });
});

// 68-sales-reports.md's Sales Reports module calls these three instead of
// listSalesInvoices — the only difference from their sales:view-gated
// siblings is which permission they check (see each method's own comment
// in sales-invoice-service.ts for why).
describe("report-scoped reads — listSalesInvoicesForReport / getItemWiseSalesReport / getPartyWiseSalesReport", () => {
  it("listSalesInvoicesForReport gates on reports:view, not sales:view", async () => {
    await salesInvoiceService.listSalesInvoicesForReport();
    expect(assertPermissionMock).toHaveBeenCalledWith(expect.anything(), "reports", "view");
  });

  it("listSalesInvoicesForReport returns [] with no active financial year, without calling the repository", async () => {
    getCurrentFinancialYearMock.mockResolvedValueOnce(null);
    const result = await salesInvoiceService.listSalesInvoicesForReport();
    expect(result).toEqual([]);
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it("getItemWiseSalesReport gates on reports:view and scopes to the caller's company + active financial year", async () => {
    aggregateItemWiseSalesMock.mockResolvedValueOnce([]);
    const filters = { fromDate: new Date("2026-04-01"), toDate: new Date("2026-04-30") };
    await salesInvoiceService.getItemWiseSalesReport(filters);
    expect(assertPermissionMock).toHaveBeenCalledWith(expect.anything(), "reports", "view");
    expect(aggregateItemWiseSalesMock).toHaveBeenCalledWith(COMPANY_ID, FY_ID, filters);
  });

  it("getItemWiseSalesReport returns [] with no active financial year, without calling the repository", async () => {
    getCurrentFinancialYearMock.mockResolvedValueOnce(null);
    const result = await salesInvoiceService.getItemWiseSalesReport({ fromDate: new Date(), toDate: new Date() });
    expect(result).toEqual([]);
    expect(aggregateItemWiseSalesMock).not.toHaveBeenCalled();
  });

  it("getPartyWiseSalesReport gates on reports:view and scopes to the caller's company + active financial year", async () => {
    aggregatePartyWiseSalesMock.mockResolvedValueOnce([]);
    const filters = { fromDate: new Date("2026-04-01"), toDate: new Date("2026-04-30") };
    await salesInvoiceService.getPartyWiseSalesReport(filters);
    expect(assertPermissionMock).toHaveBeenCalledWith(expect.anything(), "reports", "view");
    expect(aggregatePartyWiseSalesMock).toHaveBeenCalledWith(COMPANY_ID, FY_ID, filters);
  });

  it("getPartyWiseSalesReport returns [] with no active financial year, without calling the repository", async () => {
    getCurrentFinancialYearMock.mockResolvedValueOnce(null);
    const result = await salesInvoiceService.getPartyWiseSalesReport({ fromDate: new Date(), toDate: new Date() });
    expect(result).toEqual([]);
    expect(aggregatePartyWiseSalesMock).not.toHaveBeenCalled();
  });
});

describe("getDeliveryChallanPrefill", () => {
  it("returns null for a non-DISPATCHED challan", async () => {
    getDeliveryChallanMock.mockResolvedValueOnce({ id: DELIVERY_CHALLAN_ID, status: "DRAFT" });
    await expect(salesInvoiceService.getDeliveryChallanPrefill(DELIVERY_CHALLAN_ID)).resolves.toBeNull();
  });

  it("returns the challan's lines when DISPATCHED", async () => {
    getDeliveryChallanMock.mockResolvedValueOnce({
      id: DELIVERY_CHALLAN_ID,
      challanNumber: "DC-0001",
      customerId: CUSTOMER_ID,
      salesOrderId: null,
      status: "DISPATCHED",
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

    const result = await salesInvoiceService.getDeliveryChallanPrefill(DELIVERY_CHALLAN_ID);
    expect(result).toEqual(
      expect.objectContaining({ deliveryChallanId: DELIVERY_CHALLAN_ID, customerId: CUSTOMER_ID })
    );
    expect(result?.lines[0]).toEqual(expect.objectContaining({ productId: PRODUCT_ID, quantity: 2 }));
  });
});
