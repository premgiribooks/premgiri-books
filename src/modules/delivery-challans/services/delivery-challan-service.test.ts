import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mirrors sales-order-service.test.ts's convention — mock the
// module-boundary repository, sibling services/engines, and the
// session/permission/Prisma boundaries.
const {
  findManyMock,
  findByIdMock,
  findDispatchedNotInvoicedMock,
  createMock,
  replaceItemsAndUpdateMock,
  updateStatusMock,
  findCustomerForChallanMock,
  findProductsForLinesMock,
  findDispatchableProductsMock,
  getCurrentCompanyUserMock,
  getCurrentFinancialYearMock,
  assertPermissionMock,
  ensureSequenceMock,
  generateNumberMock,
  previewNextNumberMock,
  listSelectableCustomersMock,
  getSalesOrderMock,
  applyDeliveryMock,
  FAKE_TX,
} = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  findByIdMock: vi.fn(),
  findDispatchedNotInvoicedMock: vi.fn(),
  createMock: vi.fn(),
  replaceItemsAndUpdateMock: vi.fn(),
  updateStatusMock: vi.fn(),
  findCustomerForChallanMock: vi.fn(),
  findProductsForLinesMock: vi.fn(),
  findDispatchableProductsMock: vi.fn(),
  getCurrentCompanyUserMock: vi.fn(),
  getCurrentFinancialYearMock: vi.fn(),
  assertPermissionMock: vi.fn(),
  ensureSequenceMock: vi.fn(),
  generateNumberMock: vi.fn(),
  previewNextNumberMock: vi.fn(),
  listSelectableCustomersMock: vi.fn(),
  getSalesOrderMock: vi.fn(),
  applyDeliveryMock: vi.fn(),
  FAKE_TX: { marker: "fake-tx" },
}));

vi.mock("@/modules/delivery-challans/repositories/delivery-challan-repository", () => ({
  deliveryChallanRepository: {
    findMany: findManyMock,
    findById: findByIdMock,
    findDispatchedNotInvoiced: findDispatchedNotInvoicedMock,
    create: createMock,
    replaceItemsAndUpdate: replaceItemsAndUpdateMock,
    updateStatus: updateStatusMock,
    findCustomerForChallan: findCustomerForChallanMock,
    findProductsForLines: findProductsForLinesMock,
    findDispatchableProducts: findDispatchableProductsMock,
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

vi.mock("@/modules/customers/services/customer-service", () => ({
  customerService: { listSelectableCustomers: listSelectableCustomersMock },
}));

vi.mock("@/modules/sales-orders/services/sales-order-service", () => ({
  salesOrderService: { getSalesOrder: getSalesOrderMock, applyDelivery: applyDeliveryMock },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: (fn: (tx: unknown) => unknown) => fn(FAKE_TX) },
}));

import { AppError } from "@/lib/app-error";
import { deliveryChallanService } from "@/modules/delivery-challans/services/delivery-challan-service";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_COMPANY_ID = "99999999-9999-4999-8999-999999999999";
const FY_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";
const CUSTOMER_ID = "44444444-4444-4444-8444-444444444444";
const PRODUCT_ID = "55555555-5555-4555-8555-555555555555";
const SALES_ORDER_ID = "77777777-7777-4777-8777-777777777777";
const ITEM_ID = "88888888-8888-4888-8888-888888888888";

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

const ACTIVE_CUSTOMER = { id: CUSTOMER_ID, companyId: COMPANY_ID, isActive: true };

const PRODUCT = {
  id: PRODUCT_ID,
  name: "Product A",
  productCode: "A",
  isActive: true,
  unitSymbol: "Nos",
  unitDecimalPlaces: 0,
};

function validLines() {
  return [{ productId: PRODUCT_ID, quantity: 5 }];
}

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    customerId: CUSTOMER_ID,
    challanDate: "2026-09-10",
    narration: undefined,
    lines: validLines(),
    ...overrides,
  };
}

function challanRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "dc-1",
    companyId: COMPANY_ID,
    financialYearId: FY_ID,
    challanNumber: "DC-0001",
    status: "DRAFT",
    salesOrderId: null,
    items: [],
    ...overrides,
  };
}

function salesOrderDetail(overrides: Record<string, unknown> = {}) {
  return {
    id: SALES_ORDER_ID,
    companyId: COMPANY_ID,
    customerId: CUSTOMER_ID,
    orderNumber: "SO-0001",
    status: "CONFIRMED",
    items: [
      {
        id: ITEM_ID,
        productId: PRODUCT_ID,
        quantity: 10,
        deliveredQuantity: 2,
        product: { id: PRODUCT_ID, name: "Product A", productCode: "A", isActive: true },
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  findManyMock.mockReset();
  findByIdMock.mockReset();
  findDispatchedNotInvoicedMock.mockReset();
  createMock.mockReset();
  replaceItemsAndUpdateMock.mockReset();
  updateStatusMock.mockReset();
  findCustomerForChallanMock.mockReset();
  findProductsForLinesMock.mockReset();
  findDispatchableProductsMock.mockReset();
  getCurrentCompanyUserMock.mockReset();
  getCurrentFinancialYearMock.mockReset();
  assertPermissionMock.mockReset();
  ensureSequenceMock.mockReset();
  generateNumberMock.mockReset();
  previewNextNumberMock.mockReset();
  listSelectableCustomersMock.mockReset();
  getSalesOrderMock.mockReset();
  applyDeliveryMock.mockReset();

  getCurrentCompanyUserMock.mockResolvedValue(CURRENT_USER);
  getCurrentFinancialYearMock.mockResolvedValue(CURRENT_FY);
  assertPermissionMock.mockResolvedValue(undefined);
  findCustomerForChallanMock.mockResolvedValue(ACTIVE_CUSTOMER);
  findProductsForLinesMock.mockResolvedValue([PRODUCT]);
  generateNumberMock.mockResolvedValue({ documentSequenceId: "seq-1", number: 1, formatted: "DC-0001" });
  createMock.mockResolvedValue(challanRow());
});

describe("createDeliveryChallan — manual (no linked sales order)", () => {
  it("creates a DRAFT challan and generates a number", async () => {
    await deliveryChallanService.createDeliveryChallan(validInput());

    expect(ensureSequenceMock).toHaveBeenCalledWith(COMPANY_ID, FY_ID, "DELIVERY_CHALLAN");
    expect(generateNumberMock).toHaveBeenCalledWith(FAKE_TX, {
      companyId: COMPANY_ID,
      financialYearId: FY_ID,
      documentType: "DELIVERY_CHALLAN",
    });
    expect(createMock).toHaveBeenCalledWith(
      FAKE_TX,
      COMPANY_ID,
      FY_ID,
      expect.objectContaining({ customerId: CUSTOMER_ID, salesOrderId: null }),
      [
        expect.objectContaining({
          productId: PRODUCT_ID,
          quantity: 5,
          salesOrderItemId: null,
        }),
      ],
      { documentSequenceId: "seq-1", number: 1, formatted: "DC-0001" },
      USER_ID
    );
  });

  it("rejects when the customer does not exist or belongs to another company", async () => {
    findCustomerForChallanMock.mockResolvedValueOnce(null);
    await expect(deliveryChallanService.createDeliveryChallan(validInput())).rejects.toThrow("Customer not found.");
  });

  it("translates a document-number unique-constraint collision into a friendly message", async () => {
    createMock.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "7.8.0",
        meta: { target: ["challanNumber"] },
      })
    );
    await expect(deliveryChallanService.createDeliveryChallan(validInput())).rejects.toThrow(
      "A delivery challan with this number already exists for this financial year."
    );
  });

  it("every rejection is an AppError, safe to surface to the client", async () => {
    findCustomerForChallanMock.mockResolvedValueOnce(null);
    await expect(deliveryChallanService.createDeliveryChallan(validInput())).rejects.toBeInstanceOf(AppError);
  });
});

describe("createDeliveryChallan — linked to a sales order", () => {
  function linkedInput(quantity: number, salesOrderItemId = ITEM_ID) {
    return validInput({
      salesOrderId: SALES_ORDER_ID,
      lines: [{ productId: PRODUCT_ID, quantity, salesOrderItemId }],
    });
  }

  it("accepts a line whose quantity is within the order line's remaining quantity", async () => {
    getSalesOrderMock.mockResolvedValueOnce(salesOrderDetail());
    await deliveryChallanService.createDeliveryChallan(linkedInput(5));
    expect(createMock).toHaveBeenCalledWith(
      FAKE_TX,
      COMPANY_ID,
      FY_ID,
      expect.objectContaining({ salesOrderId: SALES_ORDER_ID }),
      [expect.objectContaining({ salesOrderItemId: ITEM_ID })],
      expect.any(Object),
      USER_ID
    );
  });

  it("rejects a line exceeding the order line's remaining quantity (10 - 2 = 8 remaining)", async () => {
    getSalesOrderMock.mockResolvedValueOnce(salesOrderDetail());
    await expect(deliveryChallanService.createDeliveryChallan(linkedInput(9))).rejects.toThrow(
      "exceed the remaining quantity"
    );
  });

  it("rejects a line whose salesOrderItemId does not belong to the linked order", async () => {
    getSalesOrderMock.mockResolvedValueOnce(salesOrderDetail());
    const OTHER_ITEM_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    await expect(deliveryChallanService.createDeliveryChallan(linkedInput(1, OTHER_ITEM_ID))).rejects.toThrow(
      "does not belong to the linked sales order"
    );
  });

  it("rejects when the linked sales order is not open (e.g. still DRAFT)", async () => {
    getSalesOrderMock.mockResolvedValueOnce(salesOrderDetail({ status: "DRAFT" }));
    await expect(deliveryChallanService.createDeliveryChallan(linkedInput(1))).rejects.toThrow(
      "Only a confirmed or partially delivered sales order"
    );
  });

  it("rejects when the linked sales order belongs to a different customer", async () => {
    getSalesOrderMock.mockResolvedValueOnce(salesOrderDetail({ customerId: "different-customer" }));
    await expect(deliveryChallanService.createDeliveryChallan(linkedInput(1))).rejects.toThrow(
      "does not belong to the selected customer"
    );
  });

  it("rejects when the linked sales order does not exist", async () => {
    getSalesOrderMock.mockResolvedValueOnce(null);
    await expect(deliveryChallanService.createDeliveryChallan(linkedInput(1))).rejects.toThrow(
      "Sales order not found."
    );
  });
});

describe("dispatchDeliveryChallan", () => {
  function draftWithLine(overrides: Record<string, unknown> = {}) {
    return challanRow({
      status: "DRAFT",
      items: [
        {
          id: "item-1",
          productId: PRODUCT_ID,
          quantity: 5,
          salesOrderItemId: null,
          product: { id: PRODUCT_ID, name: "Product A" },
        },
      ],
      ...overrides,
    });
  }

  it("dispatches a manual (unlinked) challan without calling applyDelivery — no StockTransaction/Inventory Engine involvement", async () => {
    findByIdMock.mockResolvedValueOnce(draftWithLine());
    updateStatusMock.mockResolvedValueOnce(1);
    findByIdMock.mockResolvedValueOnce(draftWithLine({ status: "DISPATCHED" }));

    const result = await deliveryChallanService.dispatchDeliveryChallan("dc-1");

    expect(applyDeliveryMock).not.toHaveBeenCalled();
    expect(updateStatusMock).toHaveBeenCalledWith(FAKE_TX, "dc-1", COMPANY_ID, ["DRAFT"], "DISPATCHED");
    expect(result.status).toBe("DISPATCHED");
  });

  it("dispatches a linked challan by calling applyDelivery atomically with the same transaction client", async () => {
    findByIdMock.mockResolvedValueOnce(
      draftWithLine({
        salesOrderId: SALES_ORDER_ID,
        items: [
          {
            id: "item-1",
            productId: PRODUCT_ID,
            quantity: 5,
            salesOrderItemId: ITEM_ID,
            product: { id: PRODUCT_ID, name: "Product A" },
          },
        ],
      })
    );
    applyDeliveryMock.mockResolvedValueOnce(undefined);
    updateStatusMock.mockResolvedValueOnce(1);
    findByIdMock.mockResolvedValueOnce(draftWithLine({ status: "DISPATCHED" }));

    await deliveryChallanService.dispatchDeliveryChallan("dc-1");

    expect(applyDeliveryMock).toHaveBeenCalledWith(
      SALES_ORDER_ID,
      [{ salesOrderItemId: ITEM_ID, quantity: 5 }],
      FAKE_TX
    );
  });

  it("rolls back (rejects, never flips status) when applyDelivery's race guard rejects a concurrent over-delivery", async () => {
    findByIdMock.mockResolvedValueOnce(
      draftWithLine({
        salesOrderId: SALES_ORDER_ID,
        items: [
          {
            id: "item-1",
            productId: PRODUCT_ID,
            quantity: 5,
            salesOrderItemId: ITEM_ID,
            product: { id: PRODUCT_ID, name: "Product A" },
          },
        ],
      })
    );
    applyDeliveryMock.mockRejectedValueOnce(
      new AppError("Delivered quantity for Product A cannot exceed the ordered quantity.")
    );

    await expect(deliveryChallanService.dispatchDeliveryChallan("dc-1")).rejects.toThrow(
      "cannot exceed the ordered quantity"
    );
    expect(updateStatusMock).not.toHaveBeenCalled();
  });

  it("rejects dispatching a non-DRAFT challan", async () => {
    findByIdMock.mockResolvedValueOnce(draftWithLine({ status: "DISPATCHED" }));
    await expect(deliveryChallanService.dispatchDeliveryChallan("dc-1")).rejects.toThrow("can no longer be changed");
  });

  it("rejects dispatching a line whose product has since gone inactive", async () => {
    findByIdMock.mockResolvedValueOnce(draftWithLine());
    findProductsForLinesMock.mockResolvedValueOnce([{ ...PRODUCT, isActive: false }]);
    await expect(deliveryChallanService.dispatchDeliveryChallan("dc-1")).rejects.toThrow(
      "is inactive and cannot be dispatched"
    );
  });

  it("rejects when the challan belongs to a different company", async () => {
    findByIdMock.mockResolvedValueOnce(draftWithLine({ companyId: OTHER_COMPANY_ID }));
    await expect(deliveryChallanService.dispatchDeliveryChallan("dc-1")).rejects.toThrow(
      "Delivery challan not found."
    );
  });
});

describe("cancelDeliveryChallan", () => {
  it("DRAFT -> CANCELLED succeeds", async () => {
    updateStatusMock.mockResolvedValueOnce(1);
    findByIdMock.mockResolvedValueOnce(challanRow({ status: "CANCELLED" }));
    const result = await deliveryChallanService.cancelDeliveryChallan("dc-1");
    expect(updateStatusMock).toHaveBeenCalledWith(expect.anything(), "dc-1", COMPANY_ID, ["DRAFT"], "CANCELLED");
    expect(result.status).toBe("CANCELLED");
  });

  it("rejects cancelling a non-DRAFT challan (a DISPATCHED challan cannot be un-dispatched)", async () => {
    updateStatusMock.mockResolvedValueOnce(0);
    await expect(deliveryChallanService.cancelDeliveryChallan("dc-1")).rejects.toThrow("can no longer be changed");
  });
});

describe("markInvoiced — idempotency", () => {
  it("DISPATCHED -> INVOICED succeeds", async () => {
    findByIdMock.mockResolvedValueOnce(challanRow({ status: "DISPATCHED" }));
    updateStatusMock.mockResolvedValueOnce(1);
    await deliveryChallanService.markInvoiced("dc-1");
    expect(updateStatusMock).toHaveBeenCalledWith(expect.anything(), "dc-1", COMPANY_ID, ["DISPATCHED"], "INVOICED");
  });

  it("is a no-op when already INVOICED — defensive against a retried/duplicate call", async () => {
    findByIdMock.mockResolvedValueOnce(challanRow({ status: "INVOICED" }));
    await deliveryChallanService.markInvoiced("dc-1");
    expect(updateStatusMock).not.toHaveBeenCalled();
  });

  it("rejects marking a DRAFT challan invoiced", async () => {
    findByIdMock.mockResolvedValueOnce(challanRow({ status: "DRAFT" }));
    updateStatusMock.mockResolvedValueOnce(0);
    findByIdMock.mockResolvedValueOnce(challanRow({ status: "DRAFT" }));
    await expect(deliveryChallanService.markInvoiced("dc-1")).rejects.toThrow("can no longer be changed");
  });

  it("is also a no-op when the guarded write loses a genuinely concurrent race (both callers see INVOICED)", async () => {
    // Simulates two truly simultaneous markInvoiced calls: this call's
    // sequential pre-check still sees DISPATCHED, but by the time its own
    // guarded updateStatus runs, the other call already committed INVOICED —
    // the guarded write matches zero rows, and the post-failure re-check
    // below is what makes this call idempotent too, instead of rejecting.
    findByIdMock.mockResolvedValueOnce(challanRow({ status: "DISPATCHED" }));
    updateStatusMock.mockResolvedValueOnce(0);
    findByIdMock.mockResolvedValueOnce(challanRow({ status: "INVOICED" }));
    await expect(deliveryChallanService.markInvoiced("dc-1")).resolves.toBeUndefined();
  });

  it("participates in the caller's own transaction when one is passed", async () => {
    const CALLER_TX = { marker: "caller-tx" } as never;
    findByIdMock.mockResolvedValueOnce(challanRow({ status: "DISPATCHED" }));
    updateStatusMock.mockResolvedValueOnce(1);
    await deliveryChallanService.markInvoiced("dc-1", CALLER_TX);
    expect(findByIdMock).toHaveBeenCalledWith("dc-1", CALLER_TX);
    expect(updateStatusMock).toHaveBeenCalledWith(CALLER_TX, "dc-1", COMPANY_ID, ["DISPATCHED"], "INVOICED");
  });

  it("rejects when the challan belongs to a different company", async () => {
    findByIdMock.mockResolvedValueOnce(challanRow({ companyId: OTHER_COMPANY_ID }));
    await expect(deliveryChallanService.markInvoiced("dc-1")).rejects.toThrow("Delivery challan not found.");
  });
});

describe("getDeliveryChallan / listDeliveryChallans — cross-company and scoping", () => {
  it("getDeliveryChallan returns null for a cross-company challan", async () => {
    findByIdMock.mockResolvedValueOnce(challanRow({ companyId: OTHER_COMPANY_ID }));
    await expect(deliveryChallanService.getDeliveryChallan("dc-1")).resolves.toBeNull();
  });

  it("listDeliveryChallans returns [] with no active financial year", async () => {
    getCurrentFinancialYearMock.mockResolvedValueOnce(null);
    const result = await deliveryChallanService.listDeliveryChallans();
    expect(result).toEqual([]);
    expect(findManyMock).not.toHaveBeenCalled();
  });
});

describe("getSalesOrderPrefill", () => {
  it("returns the order's remaining (undelivered) lines", async () => {
    getSalesOrderMock.mockResolvedValueOnce(salesOrderDetail());
    findProductsForLinesMock.mockResolvedValueOnce([PRODUCT]);

    const result = await deliveryChallanService.getSalesOrderPrefill(SALES_ORDER_ID);

    expect(result).toEqual(
      expect.objectContaining({
        salesOrderId: SALES_ORDER_ID,
        customerId: CUSTOMER_ID,
        lines: [expect.objectContaining({ salesOrderItemId: ITEM_ID, remainingQuantity: 8 })],
      })
    );
  });

  it("returns null for a non-open sales order", async () => {
    getSalesOrderMock.mockResolvedValueOnce(salesOrderDetail({ status: "DRAFT" }));
    await expect(deliveryChallanService.getSalesOrderPrefill(SALES_ORDER_ID)).resolves.toBeNull();
  });

  it("returns null when the sales order does not exist", async () => {
    getSalesOrderMock.mockResolvedValueOnce(null);
    await expect(deliveryChallanService.getSalesOrderPrefill(SALES_ORDER_ID)).resolves.toBeNull();
  });
});
