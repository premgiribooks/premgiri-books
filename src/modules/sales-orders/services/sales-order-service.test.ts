import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mirrors quotation-service.test.ts's convention — mock the module-boundary
// repository, sibling services/engines, and the session/permission/Prisma
// boundaries; the GST Engine itself is left REAL so the engine-composition
// test is a genuine end-to-end check, not a mock echoing back its own input.
const {
  findManyMock,
  findByIdMock,
  findOpenForCustomerMock,
  createMock,
  replaceItemsAndUpdateMock,
  updateStatusMock,
  incrementDeliveredQuantitiesMock,
  findOrderableProductsMock,
  findProductsForLinesMock,
  findCustomerForOrderMock,
  findCompanyStateCodeMock,
  getCurrentCompanyUserMock,
  getCurrentFinancialYearMock,
  assertPermissionMock,
  ensureSequenceMock,
  generateNumberMock,
  previewNextNumberMock,
  listSelectableCustomersMock,
  getQuotationMock,
  resolvePriceMock,
  FAKE_TX,
} = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  findByIdMock: vi.fn(),
  findOpenForCustomerMock: vi.fn(),
  createMock: vi.fn(),
  replaceItemsAndUpdateMock: vi.fn(),
  updateStatusMock: vi.fn(),
  incrementDeliveredQuantitiesMock: vi.fn(),
  findOrderableProductsMock: vi.fn(),
  findProductsForLinesMock: vi.fn(),
  findCustomerForOrderMock: vi.fn(),
  findCompanyStateCodeMock: vi.fn(),
  getCurrentCompanyUserMock: vi.fn(),
  getCurrentFinancialYearMock: vi.fn(),
  assertPermissionMock: vi.fn(),
  ensureSequenceMock: vi.fn(),
  generateNumberMock: vi.fn(),
  previewNextNumberMock: vi.fn(),
  listSelectableCustomersMock: vi.fn(),
  getQuotationMock: vi.fn(),
  resolvePriceMock: vi.fn(),
  FAKE_TX: { marker: "fake-tx" },
}));

vi.mock("@/modules/sales-orders/repositories/sales-order-repository", () => ({
  salesOrderRepository: {
    findMany: findManyMock,
    findById: findByIdMock,
    findOpenForCustomer: findOpenForCustomerMock,
    create: createMock,
    replaceItemsAndUpdate: replaceItemsAndUpdateMock,
    updateStatus: updateStatusMock,
    incrementDeliveredQuantities: incrementDeliveredQuantitiesMock,
    findOrderableProducts: findOrderableProductsMock,
    findProductsForLines: findProductsForLinesMock,
    findCustomerForOrder: findCustomerForOrderMock,
    findCompanyStateCode: findCompanyStateCodeMock,
  },
}));

vi.mock("@/lib/current-user", () => ({
  getCurrentCompanyUser: getCurrentCompanyUserMock,
}));

vi.mock("@/lib/current-financial-year", () => ({
  getCurrentFinancialYear: getCurrentFinancialYearMock,
}));

vi.mock("@/lib/permissions", () => ({
  assertPermission: assertPermissionMock,
}));

vi.mock("@/engines/document-number/document-number-engine", () => ({
  documentNumberEngine: {
    ensureSequence: ensureSequenceMock,
    generateNumber: generateNumberMock,
    previewNextNumber: previewNextNumberMock,
  },
}));

vi.mock("@/engines/pricing/pricing-engine", () => ({
  pricingEngine: { resolvePrice: resolvePriceMock },
}));

vi.mock("@/modules/customers/services/customer-service", () => ({
  customerService: { listSelectableCustomers: listSelectableCustomersMock },
}));

vi.mock("@/modules/quotations/services/quotation-service", () => ({
  quotationService: { getQuotation: getQuotationMock },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: (fn: (tx: unknown) => unknown) => fn(FAKE_TX) },
}));

import { AppError } from "@/lib/app-error";
import { salesOrderService } from "@/modules/sales-orders/services/sales-order-service";
import type { SalesOrderLineInput } from "@/modules/sales-orders/validation/sales-order-schema";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_COMPANY_ID = "99999999-9999-4999-8999-999999999999";
const FY_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";
const CUSTOMER_ID = "44444444-4444-4444-8444-444444444444";
const PRODUCT_A_ID = "55555555-5555-4555-8555-555555555555";
const PRODUCT_B_ID = "66666666-6666-4666-8666-666666666666";
const QUOTATION_ID = "77777777-7777-4777-8777-777777777777";
const ITEM_1_ID = "88888888-8888-4888-8888-888888888888";
const ITEM_2_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

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

const ACTIVE_CUSTOMER = { id: CUSTOMER_ID, companyId: COMPANY_ID, isActive: true, priceListId: null };

// Product A: 18% GST, 0% cess. Product B: 5% GST, 1% cess.
const PRODUCT_A = {
  id: PRODUCT_A_ID,
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
const PRODUCT_B = {
  id: PRODUCT_B_ID,
  name: "Product B",
  productCode: "B",
  isActive: true,
  unitSymbol: "Nos",
  unitDecimalPlaces: 0,
  hsnCode: "5678",
  hasGstRate: true,
  ratePercent: 5,
  cessPercent: 1,
  sellingPrice: 1000,
  purchasePrice: 900,
};

function validLines(): SalesOrderLineInput[] {
  return [
    { productId: PRODUCT_A_ID, quantity: 2, rate: 100, discountPercent: undefined, discountAmount: undefined },
    { productId: PRODUCT_B_ID, quantity: 1, rate: 1000, discountPercent: 10, discountAmount: undefined },
  ];
}

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    customerId: CUSTOMER_ID,
    orderDate: "2026-09-10",
    expectedDeliveryDate: undefined,
    placeOfSupplyStateCode: "27",
    narration: undefined,
    lines: validLines(),
    ...overrides,
  };
}

function salesOrderRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "so-1",
    companyId: COMPANY_ID,
    financialYearId: FY_ID,
    orderNumber: "SO-0001",
    status: "DRAFT",
    quotationId: null,
    items: [],
    ...overrides,
  };
}

beforeEach(() => {
  findManyMock.mockReset();
  findByIdMock.mockReset();
  findOpenForCustomerMock.mockReset();
  createMock.mockReset();
  replaceItemsAndUpdateMock.mockReset();
  updateStatusMock.mockReset();
  incrementDeliveredQuantitiesMock.mockReset();
  findOrderableProductsMock.mockReset();
  findProductsForLinesMock.mockReset();
  findCustomerForOrderMock.mockReset();
  findCompanyStateCodeMock.mockReset();
  getCurrentCompanyUserMock.mockReset();
  getCurrentFinancialYearMock.mockReset();
  assertPermissionMock.mockReset();
  ensureSequenceMock.mockReset();
  generateNumberMock.mockReset();
  previewNextNumberMock.mockReset();
  listSelectableCustomersMock.mockReset();
  getQuotationMock.mockReset();
  resolvePriceMock.mockReset();

  getCurrentCompanyUserMock.mockResolvedValue(CURRENT_USER);
  getCurrentFinancialYearMock.mockResolvedValue(CURRENT_FY);
  assertPermissionMock.mockResolvedValue(undefined);
  findCustomerForOrderMock.mockResolvedValue(ACTIVE_CUSTOMER);
  findCompanyStateCodeMock.mockResolvedValue("27");
  findProductsForLinesMock.mockResolvedValue([PRODUCT_A, PRODUCT_B]);
  generateNumberMock.mockResolvedValue({ documentSequenceId: "seq-1", number: 1, formatted: "SO-0001" });
  createMock.mockResolvedValue(salesOrderRow());
});

describe("createSalesOrder — engine composition", () => {
  it("produces per-line and header totals matching a hand-computed mixed-rate, mixed-cess fixture (intra-state)", async () => {
    await salesOrderService.createSalesOrder(validInput());

    expect(ensureSequenceMock).toHaveBeenCalledWith(COMPANY_ID, FY_ID, "SALES_ORDER");
    expect(generateNumberMock).toHaveBeenCalledWith(FAKE_TX, {
      companyId: COMPANY_ID,
      financialYearId: FY_ID,
      documentType: "SALES_ORDER",
    });

    expect(createMock).toHaveBeenCalledWith(
      FAKE_TX,
      COMPANY_ID,
      FY_ID,
      expect.objectContaining({
        subtotal: 1200,
        totalDiscount: 100,
        taxableAmount: 1100,
        totalCgst: 40.5,
        totalSgst: 40.5,
        totalIgst: 0,
        totalCess: 9,
        grandTotal: 1190,
        quotationId: null,
      }),
      [
        expect.objectContaining({ productId: PRODUCT_A_ID, taxableAmount: 200, totalAmount: 236 }),
        expect.objectContaining({ productId: PRODUCT_B_ID, taxableAmount: 900, totalAmount: 954 }),
      ],
      { documentSequenceId: "seq-1", number: 1, formatted: "SO-0001" },
      USER_ID
    );
  });

  it("produces IGST instead of CGST/SGST for an inter-state supply", async () => {
    findCompanyStateCodeMock.mockResolvedValueOnce("07");

    await salesOrderService.createSalesOrder(validInput());

    expect(createMock).toHaveBeenCalledWith(
      FAKE_TX,
      COMPANY_ID,
      FY_ID,
      expect.objectContaining({ totalCgst: 0, totalSgst: 0, totalIgst: 81 }),
      expect.any(Array),
      expect.any(Object),
      USER_ID
    );
  });
});

describe("createSalesOrder — validation and scoping", () => {
  it("rejects when the customer does not exist or belongs to another company", async () => {
    findCustomerForOrderMock.mockResolvedValueOnce(null);
    await expect(salesOrderService.createSalesOrder(validInput())).rejects.toThrow("Customer not found.");
    expect(ensureSequenceMock).not.toHaveBeenCalled();
  });

  it("rejects when the company has no GST state code set", async () => {
    findCompanyStateCodeMock.mockResolvedValueOnce(null);
    await expect(salesOrderService.createSalesOrder(validInput())).rejects.toThrow("Set your company's GST state");
  });

  it("rejects a sales order whose lines are all zero-value", async () => {
    const zeroLine: SalesOrderLineInput = {
      productId: PRODUCT_A_ID,
      quantity: 1,
      rate: 100,
      discountPercent: 100,
      discountAmount: undefined,
    };
    await expect(
      salesOrderService.createSalesOrder(validInput({ lines: [zeroLine] }))
    ).rejects.toThrow("A sales order cannot consist entirely of zero-value lines.");
  });

  it("translates a document-number unique-constraint collision into a friendly message", async () => {
    createMock.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "7.8.0",
        meta: { target: ["orderNumber"] },
      })
    );
    await expect(salesOrderService.createSalesOrder(validInput())).rejects.toThrow(
      "A sales order with this number already exists for this financial year."
    );
  });

  it("every rejection is an AppError, safe to surface to the client", async () => {
    findCustomerForOrderMock.mockResolvedValueOnce(null);
    await expect(salesOrderService.createSalesOrder(validInput())).rejects.toBeInstanceOf(AppError);
  });
});

describe("createFromQuotation — re-resolution behavior", () => {
  function quotationDetail(overrides: Record<string, unknown> = {}) {
    return {
      id: QUOTATION_ID,
      companyId: COMPANY_ID,
      customerId: CUSTOMER_ID,
      placeOfSupplyStateCode: "27",
      status: "ACCEPTED",
      items: [
        { productId: PRODUCT_A_ID, quantity: 2, rate: 80, discountPercent: 0, discountAmount: 0 },
      ],
      ...overrides,
    };
  }

  it("re-resolves rate/GST fresh via the Pricing Engine instead of copying the quotation's stored rate", async () => {
    getQuotationMock.mockResolvedValueOnce(quotationDetail());
    resolvePriceMock.mockResolvedValueOnce({
      price: 120,
      source: "PRODUCT_DEFAULT",
      isBelowCost: false,
      purchaseCost: 50,
    });
    findProductsForLinesMock.mockResolvedValueOnce([PRODUCT_A]);

    await salesOrderService.createFromQuotation(QUOTATION_ID);

    expect(resolvePriceMock).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: COMPANY_ID, productId: PRODUCT_A_ID, quantity: 2, customerId: CUSTOMER_ID })
    );
    // The quotation's stored rate was 80; the freshly resolved price (120) is
    // what gets persisted — proving the quote's snapshot was never copied.
    expect(createMock).toHaveBeenCalledWith(
      FAKE_TX,
      COMPANY_ID,
      FY_ID,
      expect.objectContaining({ quotationId: QUOTATION_ID }),
      [expect.objectContaining({ productId: PRODUCT_A_ID, rate: 120 })],
      expect.any(Object),
      USER_ID
    );
  });

  it("falls back to the product's own selling price when the Pricing Engine resolves no price", async () => {
    getQuotationMock.mockResolvedValueOnce(quotationDetail());
    resolvePriceMock.mockResolvedValueOnce({ price: null, source: "NONE", isBelowCost: false, purchaseCost: null });
    findProductsForLinesMock.mockResolvedValueOnce([PRODUCT_A]);

    await salesOrderService.createFromQuotation(QUOTATION_ID);

    expect(createMock).toHaveBeenCalledWith(
      FAKE_TX,
      COMPANY_ID,
      FY_ID,
      expect.any(Object),
      [expect.objectContaining({ rate: PRODUCT_A.sellingPrice })],
      expect.any(Object),
      USER_ID
    );
  });

  it.each(["DRAFT", "REJECTED", "EXPIRED", "CANCELLED"])(
    "rejects converting a %s quotation",
    async (status) => {
      getQuotationMock.mockResolvedValueOnce(quotationDetail({ status }));
      await expect(salesOrderService.createFromQuotation(QUOTATION_ID)).rejects.toThrow(
        "Only a sent or accepted quotation can be converted to a sales order."
      );
      expect(ensureSequenceMock).not.toHaveBeenCalled();
    }
  );

  it("rejects when the quotation does not exist", async () => {
    getQuotationMock.mockResolvedValueOnce(null);
    await expect(salesOrderService.createFromQuotation(QUOTATION_ID)).rejects.toThrow("Quotation not found.");
  });
});

describe("status transition matrix", () => {
  it("confirmSalesOrder: DRAFT -> CONFIRMED succeeds", async () => {
    updateStatusMock.mockResolvedValueOnce(1);
    findByIdMock.mockResolvedValueOnce(salesOrderRow({ status: "CONFIRMED" }));
    const result = await salesOrderService.confirmSalesOrder("so-1");
    expect(updateStatusMock).toHaveBeenCalledWith(expect.anything(), "so-1", COMPANY_ID, ["DRAFT"], "CONFIRMED");
    expect(result.status).toBe("CONFIRMED");
  });

  it("confirmSalesOrder: rejects when the order is not currently DRAFT", async () => {
    updateStatusMock.mockResolvedValueOnce(0);
    await expect(salesOrderService.confirmSalesOrder("so-1")).rejects.toThrow(
      "This sales order can no longer be changed"
    );
  });

  it("closeSalesOrder: DELIVERED -> CLOSED succeeds", async () => {
    updateStatusMock.mockResolvedValueOnce(1);
    findByIdMock.mockResolvedValueOnce(salesOrderRow({ status: "CLOSED" }));
    await salesOrderService.closeSalesOrder("so-1");
    expect(updateStatusMock).toHaveBeenCalledWith(expect.anything(), "so-1", COMPANY_ID, ["DELIVERED"], "CLOSED");
  });

  it("closeSalesOrder: rejects a not-yet-DELIVERED order", async () => {
    updateStatusMock.mockResolvedValueOnce(0);
    await expect(salesOrderService.closeSalesOrder("so-1")).rejects.toThrow(
      "This sales order can no longer be changed"
    );
  });

  it("cancelSalesOrder: DRAFT -> CANCELLED requires only 'edit'", async () => {
    findByIdMock.mockResolvedValueOnce(salesOrderRow({ status: "DRAFT" }));
    updateStatusMock.mockResolvedValueOnce(1);
    findByIdMock.mockResolvedValueOnce(salesOrderRow({ status: "CANCELLED" }));
    await salesOrderService.cancelSalesOrder("so-1");
    expect(assertPermissionMock).toHaveBeenCalledWith(CURRENT_USER, "sales", "edit");
    expect(updateStatusMock).toHaveBeenCalledWith(expect.anything(), "so-1", COMPANY_ID, ["DRAFT", "CONFIRMED"], "CANCELLED");
  });

  it("cancelSalesOrder: CONFIRMED -> CANCELLED requires 'approve'", async () => {
    findByIdMock.mockResolvedValueOnce(salesOrderRow({ status: "CONFIRMED" }));
    updateStatusMock.mockResolvedValueOnce(1);
    findByIdMock.mockResolvedValueOnce(salesOrderRow({ status: "CANCELLED" }));
    await salesOrderService.cancelSalesOrder("so-1");
    expect(assertPermissionMock).toHaveBeenCalledWith(CURRENT_USER, "sales", "approve");
  });

  it("cancelSalesOrder: rejects once any delivery has moved the order past CONFIRMED", async () => {
    findByIdMock.mockResolvedValueOnce(salesOrderRow({ status: "PARTIALLY_DELIVERED" }));
    updateStatusMock.mockResolvedValueOnce(0);
    await expect(salesOrderService.cancelSalesOrder("so-1")).rejects.toThrow(
      "This sales order can no longer be changed"
    );
  });

  it("cancelSalesOrder: rejects when the order belongs to a different company", async () => {
    findByIdMock.mockResolvedValueOnce(salesOrderRow({ companyId: OTHER_COMPANY_ID }));
    await expect(salesOrderService.cancelSalesOrder("so-1")).rejects.toThrow("Sales order not found.");
  });
});

interface FixtureItem {
  id: string;
  quantity: number;
  deliveredQuantity: number;
  product: { name: string };
}

describe("applyDelivery — automatic status transitions", () => {
  function orderWithItems(status: string, itemOverrides: readonly Partial<FixtureItem>[] = []) {
    const baseItems: FixtureItem[] = [
      { id: ITEM_1_ID, quantity: 5, deliveredQuantity: 0, product: { name: "Product A" } },
      { id: ITEM_2_ID, quantity: 3, deliveredQuantity: 0, product: { name: "Product B" } },
    ];
    const items = baseItems.map((item, index) => ({ ...item, ...itemOverrides[index] }));
    return salesOrderRow({ status, items });
  }

  it("CONFIRMED -> PARTIALLY_DELIVERED when at least one line is partially delivered", async () => {
    findByIdMock.mockResolvedValueOnce(orderWithItems("CONFIRMED"));
    findByIdMock.mockResolvedValueOnce(orderWithItems("PARTIALLY_DELIVERED"));

    await salesOrderService.applyDelivery("so-1", [{ salesOrderItemId: ITEM_1_ID, quantity: 2 }]);

    expect(incrementDeliveredQuantitiesMock).toHaveBeenCalledWith(FAKE_TX, [
      { salesOrderItemId: ITEM_1_ID, quantity: 2 },
    ]);
    expect(updateStatusMock).toHaveBeenCalledWith(FAKE_TX, "so-1", COMPANY_ID, ["CONFIRMED"], "PARTIALLY_DELIVERED");
  });

  it("-> DELIVERED only when every line's deliveredQuantity reaches its quantity", async () => {
    // line 1 already fully delivered; this delivery finishes line 2.
    const partial = orderWithItems("PARTIALLY_DELIVERED", [{ deliveredQuantity: 5 }]);
    findByIdMock.mockResolvedValueOnce(partial);
    findByIdMock.mockResolvedValueOnce(orderWithItems("DELIVERED"));

    await salesOrderService.applyDelivery("so-1", [{ salesOrderItemId: ITEM_2_ID, quantity: 3 }]);

    expect(updateStatusMock).toHaveBeenCalledWith(
      FAKE_TX,
      "so-1",
      COMPANY_ID,
      ["PARTIALLY_DELIVERED"],
      "DELIVERED"
    );
  });

  it("rejects a delivered quantity that would exceed the ordered quantity", async () => {
    findByIdMock.mockResolvedValueOnce(orderWithItems("CONFIRMED"));
    await expect(
      salesOrderService.applyDelivery("so-1", [{ salesOrderItemId: ITEM_1_ID, quantity: 10 }])
    ).rejects.toThrow("cannot exceed the ordered quantity");
  });

  it("rejects applying delivery to a DRAFT order", async () => {
    findByIdMock.mockResolvedValueOnce(orderWithItems("DRAFT"));
    await expect(
      salesOrderService.applyDelivery("so-1", [{ salesOrderItemId: ITEM_1_ID, quantity: 1 }])
    ).rejects.toThrow("Delivery can only be applied to a confirmed sales order");
  });

  it("rejects (and rolls back) when a concurrent delivery already advanced the status before this one's guarded write", async () => {
    findByIdMock.mockResolvedValueOnce(orderWithItems("CONFIRMED"));
    // Simulates another transaction having already moved the order past
    // CONFIRMED between this transaction's read and its own guarded
    // updateStatus write — the guarded WHERE clause matches zero rows.
    updateStatusMock.mockResolvedValueOnce(0);

    await expect(
      salesOrderService.applyDelivery("so-1", [{ salesOrderItemId: ITEM_1_ID, quantity: 2 }])
    ).rejects.toThrow("This sales order was updated by another delivery while applying this one.");
  });

  it("participates in the caller's own transaction when one is passed", async () => {
    const CALLER_TX = { marker: "caller-tx" } as never;
    findByIdMock.mockResolvedValueOnce(orderWithItems("CONFIRMED"));
    findByIdMock.mockResolvedValueOnce(orderWithItems("PARTIALLY_DELIVERED"));

    await salesOrderService.applyDelivery(
      "so-1",
      [{ salesOrderItemId: ITEM_1_ID, quantity: 1 }],
      CALLER_TX
    );

    expect(incrementDeliveredQuantitiesMock).toHaveBeenCalledWith(CALLER_TX, expect.any(Array));
  });
});

describe("updateSalesOrder — non-DRAFT immutability", () => {
  it.each(["CONFIRMED", "PARTIALLY_DELIVERED", "DELIVERED", "CLOSED", "CANCELLED"])(
    "rejects updating a %s sales order",
    async (status) => {
      findByIdMock.mockResolvedValueOnce(salesOrderRow({ status }));
      await expect(salesOrderService.updateSalesOrder("so-1", validInput())).rejects.toThrow(
        "This sales order can no longer be changed"
      );
      expect(replaceItemsAndUpdateMock).not.toHaveBeenCalled();
    }
  );

  it("allows updating a DRAFT sales order", async () => {
    findByIdMock.mockResolvedValueOnce(salesOrderRow({ status: "DRAFT" }));
    replaceItemsAndUpdateMock.mockResolvedValueOnce(salesOrderRow({ status: "DRAFT" }));
    await salesOrderService.updateSalesOrder("so-1", validInput());
    expect(replaceItemsAndUpdateMock).toHaveBeenCalledWith(
      FAKE_TX,
      "so-1",
      COMPANY_ID,
      ["DRAFT"],
      expect.any(Object),
      expect.any(Array)
    );
  });

  it("rejects when the sales order belongs to a different company", async () => {
    findByIdMock.mockResolvedValueOnce(salesOrderRow({ companyId: OTHER_COMPANY_ID }));
    await expect(salesOrderService.updateSalesOrder("so-1", validInput())).rejects.toThrow(
      "Sales order not found."
    );
  });
});

describe("getSalesOrder / listSalesOrders — cross-company and scoping", () => {
  it("getSalesOrder returns null for a cross-company sales order", async () => {
    findByIdMock.mockResolvedValueOnce(salesOrderRow({ companyId: OTHER_COMPANY_ID }));
    await expect(salesOrderService.getSalesOrder("so-1")).resolves.toBeNull();
  });

  it("listSalesOrders returns [] with no active financial year", async () => {
    getCurrentFinancialYearMock.mockResolvedValueOnce(null);
    const result = await salesOrderService.listSalesOrders();
    expect(result).toEqual([]);
    expect(findManyMock).not.toHaveBeenCalled();
  });
});
