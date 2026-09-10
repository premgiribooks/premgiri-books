import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import { vi } from "vitest";

// Mirrors sales-order-service.test.ts's convention — mock the module-boundary
// repository, sibling services/engines, and the session/permission/Prisma
// boundaries; the GST Engine itself is left REAL so the engine-composition
// test is a genuine end-to-end check, not a mock echoing back its own input.
const {
  findManyMock,
  findByIdMock,
  findOpenForSupplierMock,
  createMock,
  replaceItemsAndUpdateMock,
  updateStatusMock,
  incrementReceivedQuantitiesMock,
  findOrderableProductsMock,
  findProductsForLinesMock,
  findSupplierForOrderMock,
  findCompanyStateCodeMock,
  getCurrentCompanyUserMock,
  getCurrentFinancialYearMock,
  assertPermissionMock,
  ensureSequenceMock,
  generateNumberMock,
  previewNextNumberMock,
  listSelectableSuppliersMock,
  FAKE_TX,
} = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  findByIdMock: vi.fn(),
  findOpenForSupplierMock: vi.fn(),
  createMock: vi.fn(),
  replaceItemsAndUpdateMock: vi.fn(),
  updateStatusMock: vi.fn(),
  incrementReceivedQuantitiesMock: vi.fn(),
  findOrderableProductsMock: vi.fn(),
  findProductsForLinesMock: vi.fn(),
  findSupplierForOrderMock: vi.fn(),
  findCompanyStateCodeMock: vi.fn(),
  getCurrentCompanyUserMock: vi.fn(),
  getCurrentFinancialYearMock: vi.fn(),
  assertPermissionMock: vi.fn(),
  ensureSequenceMock: vi.fn(),
  generateNumberMock: vi.fn(),
  previewNextNumberMock: vi.fn(),
  listSelectableSuppliersMock: vi.fn(),
  FAKE_TX: { marker: "fake-tx" },
}));

vi.mock("@/modules/purchase-orders/repositories/purchase-order-repository", () => ({
  purchaseOrderRepository: {
    findMany: findManyMock,
    findById: findByIdMock,
    findOpenForSupplier: findOpenForSupplierMock,
    create: createMock,
    replaceItemsAndUpdate: replaceItemsAndUpdateMock,
    updateStatus: updateStatusMock,
    incrementReceivedQuantities: incrementReceivedQuantitiesMock,
    findOrderableProducts: findOrderableProductsMock,
    findProductsForLines: findProductsForLinesMock,
    findSupplierForOrder: findSupplierForOrderMock,
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

vi.mock("@/modules/suppliers/services/supplier-service", () => ({
  supplierService: { listSelectableSuppliers: listSelectableSuppliersMock },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: (fn: (tx: unknown) => unknown) => fn(FAKE_TX) },
}));

import { AppError } from "@/lib/app-error";
import { purchaseOrderService } from "@/modules/purchase-orders/services/purchase-order-service";
import type { PurchaseOrderLineInput } from "@/modules/purchase-orders/validation/purchase-order-schema";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_COMPANY_ID = "99999999-9999-4999-8999-999999999999";
const FY_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";
const SUPPLIER_ID = "44444444-4444-4444-8444-444444444444";
const PRODUCT_A_ID = "55555555-5555-4555-8555-555555555555";
const PRODUCT_B_ID = "66666666-6666-4666-8666-666666666666";
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

const ACTIVE_SUPPLIER = { id: SUPPLIER_ID, companyId: COMPANY_ID, isActive: true };

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
  purchasePrice: 900,
};

function validLines(): PurchaseOrderLineInput[] {
  return [
    { productId: PRODUCT_A_ID, quantity: 2, rate: 100, discountPercent: undefined, discountAmount: undefined },
    { productId: PRODUCT_B_ID, quantity: 1, rate: 1000, discountPercent: 10, discountAmount: undefined },
  ];
}

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    supplierId: SUPPLIER_ID,
    orderDate: "2026-09-10",
    expectedDeliveryDate: undefined,
    placeOfSupplyStateCode: "27",
    narration: undefined,
    lines: validLines(),
    ...overrides,
  };
}

function purchaseOrderRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "po-1",
    companyId: COMPANY_ID,
    financialYearId: FY_ID,
    orderNumber: "PO-0001",
    status: "DRAFT",
    items: [],
    ...overrides,
  };
}

beforeEach(() => {
  findManyMock.mockReset();
  findByIdMock.mockReset();
  findOpenForSupplierMock.mockReset();
  createMock.mockReset();
  replaceItemsAndUpdateMock.mockReset();
  updateStatusMock.mockReset();
  incrementReceivedQuantitiesMock.mockReset();
  findOrderableProductsMock.mockReset();
  findProductsForLinesMock.mockReset();
  findSupplierForOrderMock.mockReset();
  findCompanyStateCodeMock.mockReset();
  getCurrentCompanyUserMock.mockReset();
  getCurrentFinancialYearMock.mockReset();
  assertPermissionMock.mockReset();
  ensureSequenceMock.mockReset();
  generateNumberMock.mockReset();
  previewNextNumberMock.mockReset();
  listSelectableSuppliersMock.mockReset();

  getCurrentCompanyUserMock.mockResolvedValue(CURRENT_USER);
  getCurrentFinancialYearMock.mockResolvedValue(CURRENT_FY);
  assertPermissionMock.mockResolvedValue(undefined);
  findSupplierForOrderMock.mockResolvedValue(ACTIVE_SUPPLIER);
  findCompanyStateCodeMock.mockResolvedValue("27");
  findProductsForLinesMock.mockResolvedValue([PRODUCT_A, PRODUCT_B]);
  generateNumberMock.mockResolvedValue({ documentSequenceId: "seq-1", number: 1, formatted: "PO-0001" });
  createMock.mockResolvedValue(purchaseOrderRow());
});

describe("createPurchaseOrder — engine composition", () => {
  it("produces per-line and header totals matching a hand-computed mixed-rate, mixed-cess fixture (intra-state)", async () => {
    await purchaseOrderService.createPurchaseOrder(validInput());

    expect(ensureSequenceMock).toHaveBeenCalledWith(COMPANY_ID, FY_ID, "PURCHASE_ORDER");
    expect(generateNumberMock).toHaveBeenCalledWith(FAKE_TX, {
      companyId: COMPANY_ID,
      financialYearId: FY_ID,
      documentType: "PURCHASE_ORDER",
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
      }),
      [
        expect.objectContaining({ productId: PRODUCT_A_ID, taxableAmount: 200, totalAmount: 236 }),
        expect.objectContaining({ productId: PRODUCT_B_ID, taxableAmount: 900, totalAmount: 954 }),
      ],
      { documentSequenceId: "seq-1", number: 1, formatted: "PO-0001" },
      USER_ID
    );
  });

  it("produces IGST instead of CGST/SGST for an inter-state supply", async () => {
    findCompanyStateCodeMock.mockResolvedValueOnce("07");

    await purchaseOrderService.createPurchaseOrder(validInput());

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

describe("createPurchaseOrder — validation and scoping", () => {
  it("rejects when the supplier does not exist or belongs to another company", async () => {
    findSupplierForOrderMock.mockResolvedValueOnce(null);
    await expect(purchaseOrderService.createPurchaseOrder(validInput())).rejects.toThrow("Supplier not found.");
    expect(ensureSequenceMock).not.toHaveBeenCalled();
  });

  it("rejects when the supplier is inactive", async () => {
    findSupplierForOrderMock.mockResolvedValueOnce({ ...ACTIVE_SUPPLIER, isActive: false });
    await expect(purchaseOrderService.createPurchaseOrder(validInput())).rejects.toThrow(
      "Selected supplier is inactive."
    );
  });

  it("rejects when the company has no GST state code set", async () => {
    findCompanyStateCodeMock.mockResolvedValueOnce(null);
    await expect(purchaseOrderService.createPurchaseOrder(validInput())).rejects.toThrow(
      "Set your company's GST state"
    );
  });

  it("rejects a purchase order whose lines are all zero-value", async () => {
    const zeroLine: PurchaseOrderLineInput = {
      productId: PRODUCT_A_ID,
      quantity: 1,
      rate: 100,
      discountPercent: 100,
      discountAmount: undefined,
    };
    await expect(
      purchaseOrderService.createPurchaseOrder(validInput({ lines: [zeroLine] }))
    ).rejects.toThrow("A purchase order cannot consist entirely of zero-value lines.");
  });

  it("accepts a rate below the product's own purchasePrice — no below-cost concept applies to a purchase", async () => {
    // PRODUCT_A.purchasePrice is 50; a negotiated rate of 10 is well under
    // it and must still be accepted without any below-cost rejection or
    // warning (code-standards.md's Pricing Rules: that check is a
    // selling-side rule only).
    const belowCostLine: PurchaseOrderLineInput = {
      productId: PRODUCT_A_ID,
      quantity: 1,
      rate: 10,
      discountPercent: undefined,
      discountAmount: undefined,
    };
    findProductsForLinesMock.mockResolvedValueOnce([PRODUCT_A]);
    await purchaseOrderService.createPurchaseOrder(validInput({ lines: [belowCostLine] }));
    expect(createMock).toHaveBeenCalledWith(
      FAKE_TX,
      COMPANY_ID,
      FY_ID,
      expect.any(Object),
      [expect.objectContaining({ productId: PRODUCT_A_ID, rate: 10 })],
      expect.any(Object),
      USER_ID
    );
  });

  it("translates a document-number unique-constraint collision into a friendly message", async () => {
    createMock.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "7.8.0",
        meta: { target: ["orderNumber"] },
      })
    );
    await expect(purchaseOrderService.createPurchaseOrder(validInput())).rejects.toThrow(
      "A purchase order with this number already exists for this financial year."
    );
  });

  it("every rejection is an AppError, safe to surface to the client", async () => {
    findSupplierForOrderMock.mockResolvedValueOnce(null);
    await expect(purchaseOrderService.createPurchaseOrder(validInput())).rejects.toBeInstanceOf(AppError);
  });
});

describe("status transition matrix", () => {
  it("confirmPurchaseOrder: DRAFT -> CONFIRMED succeeds", async () => {
    updateStatusMock.mockResolvedValueOnce(1);
    findByIdMock.mockResolvedValueOnce(purchaseOrderRow({ status: "CONFIRMED" }));
    const result = await purchaseOrderService.confirmPurchaseOrder("po-1");
    expect(updateStatusMock).toHaveBeenCalledWith(expect.anything(), "po-1", COMPANY_ID, ["DRAFT"], "CONFIRMED");
    expect(result.status).toBe("CONFIRMED");
  });

  it("confirmPurchaseOrder: rejects when the order is not currently DRAFT", async () => {
    updateStatusMock.mockResolvedValueOnce(0);
    await expect(purchaseOrderService.confirmPurchaseOrder("po-1")).rejects.toThrow(
      "This purchase order can no longer be changed"
    );
  });

  it("closePurchaseOrder: RECEIVED -> CLOSED succeeds", async () => {
    updateStatusMock.mockResolvedValueOnce(1);
    findByIdMock.mockResolvedValueOnce(purchaseOrderRow({ status: "CLOSED" }));
    await purchaseOrderService.closePurchaseOrder("po-1");
    expect(updateStatusMock).toHaveBeenCalledWith(expect.anything(), "po-1", COMPANY_ID, ["RECEIVED"], "CLOSED");
  });

  it("closePurchaseOrder: rejects a not-yet-RECEIVED order", async () => {
    updateStatusMock.mockResolvedValueOnce(0);
    await expect(purchaseOrderService.closePurchaseOrder("po-1")).rejects.toThrow(
      "This purchase order can no longer be changed"
    );
  });

  it("cancelPurchaseOrder: DRAFT -> CANCELLED requires only 'edit'", async () => {
    findByIdMock.mockResolvedValueOnce(purchaseOrderRow({ status: "DRAFT" }));
    updateStatusMock.mockResolvedValueOnce(1);
    findByIdMock.mockResolvedValueOnce(purchaseOrderRow({ status: "CANCELLED" }));
    await purchaseOrderService.cancelPurchaseOrder("po-1");
    expect(assertPermissionMock).toHaveBeenCalledWith(CURRENT_USER, "purchase", "edit");
    expect(updateStatusMock).toHaveBeenCalledWith(
      expect.anything(),
      "po-1",
      COMPANY_ID,
      ["DRAFT", "CONFIRMED"],
      "CANCELLED"
    );
  });

  it("cancelPurchaseOrder: CONFIRMED -> CANCELLED requires 'approve'", async () => {
    findByIdMock.mockResolvedValueOnce(purchaseOrderRow({ status: "CONFIRMED" }));
    updateStatusMock.mockResolvedValueOnce(1);
    findByIdMock.mockResolvedValueOnce(purchaseOrderRow({ status: "CANCELLED" }));
    await purchaseOrderService.cancelPurchaseOrder("po-1");
    expect(assertPermissionMock).toHaveBeenCalledWith(CURRENT_USER, "purchase", "approve");
  });

  it("cancelPurchaseOrder: rejects once any receipt has moved the order past CONFIRMED", async () => {
    findByIdMock.mockResolvedValueOnce(purchaseOrderRow({ status: "PARTIALLY_RECEIVED" }));
    updateStatusMock.mockResolvedValueOnce(0);
    await expect(purchaseOrderService.cancelPurchaseOrder("po-1")).rejects.toThrow(
      "This purchase order can no longer be changed"
    );
  });

  it("cancelPurchaseOrder: rejects when the order belongs to a different company", async () => {
    findByIdMock.mockResolvedValueOnce(purchaseOrderRow({ companyId: OTHER_COMPANY_ID }));
    await expect(purchaseOrderService.cancelPurchaseOrder("po-1")).rejects.toThrow("Purchase order not found.");
  });
});

interface FixtureItem {
  id: string;
  quantity: number;
  receivedQuantity: number;
  product: { name: string };
}

describe("applyReceipt — automatic status transitions", () => {
  function orderWithItems(status: string, itemOverrides: readonly Partial<FixtureItem>[] = []) {
    const baseItems: FixtureItem[] = [
      { id: ITEM_1_ID, quantity: 5, receivedQuantity: 0, product: { name: "Product A" } },
      { id: ITEM_2_ID, quantity: 3, receivedQuantity: 0, product: { name: "Product B" } },
    ];
    const items = baseItems.map((item, index) => ({ ...item, ...itemOverrides[index] }));
    return purchaseOrderRow({ status, items });
  }

  it("CONFIRMED -> PARTIALLY_RECEIVED when at least one line is partially received", async () => {
    findByIdMock.mockResolvedValueOnce(orderWithItems("CONFIRMED"));
    findByIdMock.mockResolvedValueOnce(orderWithItems("PARTIALLY_RECEIVED"));

    await purchaseOrderService.applyReceipt("po-1", [{ purchaseOrderItemId: ITEM_1_ID, quantity: 2 }]);

    expect(incrementReceivedQuantitiesMock).toHaveBeenCalledWith(FAKE_TX, [
      { purchaseOrderItemId: ITEM_1_ID, quantity: 2 },
    ]);
    expect(updateStatusMock).toHaveBeenCalledWith(FAKE_TX, "po-1", COMPANY_ID, ["CONFIRMED"], "PARTIALLY_RECEIVED");
  });

  it("-> RECEIVED only when every line's receivedQuantity reaches its quantity", async () => {
    // line 1 already fully received; this receipt finishes line 2.
    const partial = orderWithItems("PARTIALLY_RECEIVED", [{ receivedQuantity: 5 }]);
    findByIdMock.mockResolvedValueOnce(partial);
    findByIdMock.mockResolvedValueOnce(orderWithItems("RECEIVED"));

    await purchaseOrderService.applyReceipt("po-1", [{ purchaseOrderItemId: ITEM_2_ID, quantity: 3 }]);

    expect(updateStatusMock).toHaveBeenCalledWith(
      FAKE_TX,
      "po-1",
      COMPANY_ID,
      ["PARTIALLY_RECEIVED"],
      "RECEIVED"
    );
  });

  it("rejects a received quantity that would exceed the ordered quantity", async () => {
    findByIdMock.mockResolvedValueOnce(orderWithItems("CONFIRMED"));
    await expect(
      purchaseOrderService.applyReceipt("po-1", [{ purchaseOrderItemId: ITEM_1_ID, quantity: 10 }])
    ).rejects.toThrow("cannot exceed the ordered quantity");
  });

  it("rejects applying a receipt to a DRAFT order", async () => {
    findByIdMock.mockResolvedValueOnce(orderWithItems("DRAFT"));
    await expect(
      purchaseOrderService.applyReceipt("po-1", [{ purchaseOrderItemId: ITEM_1_ID, quantity: 1 }])
    ).rejects.toThrow("A receipt can only be applied to a confirmed purchase order");
  });

  it("rejects (and rolls back) when a concurrent receipt already advanced the status before this one's guarded write", async () => {
    findByIdMock.mockResolvedValueOnce(orderWithItems("CONFIRMED"));
    // Simulates another transaction having already moved the order past
    // CONFIRMED between this transaction's read and its own guarded
    // updateStatus write — the guarded WHERE clause matches zero rows.
    updateStatusMock.mockResolvedValueOnce(0);

    await expect(
      purchaseOrderService.applyReceipt("po-1", [{ purchaseOrderItemId: ITEM_1_ID, quantity: 2 }])
    ).rejects.toThrow("This purchase order was updated by another receipt while applying this one.");
  });

  it("participates in the caller's own transaction when one is passed", async () => {
    const CALLER_TX = { marker: "caller-tx" } as never;
    findByIdMock.mockResolvedValueOnce(orderWithItems("CONFIRMED"));
    findByIdMock.mockResolvedValueOnce(orderWithItems("PARTIALLY_RECEIVED"));

    await purchaseOrderService.applyReceipt(
      "po-1",
      [{ purchaseOrderItemId: ITEM_1_ID, quantity: 1 }],
      CALLER_TX
    );

    expect(incrementReceivedQuantitiesMock).toHaveBeenCalledWith(CALLER_TX, expect.any(Array));
  });
});

describe("updatePurchaseOrder — non-DRAFT immutability", () => {
  it.each(["CONFIRMED", "PARTIALLY_RECEIVED", "RECEIVED", "CLOSED", "CANCELLED"])(
    "rejects updating a %s purchase order",
    async (status) => {
      findByIdMock.mockResolvedValueOnce(purchaseOrderRow({ status }));
      await expect(purchaseOrderService.updatePurchaseOrder("po-1", validInput())).rejects.toThrow(
        "This purchase order can no longer be changed"
      );
      expect(replaceItemsAndUpdateMock).not.toHaveBeenCalled();
    }
  );

  it("allows updating a DRAFT purchase order", async () => {
    findByIdMock.mockResolvedValueOnce(purchaseOrderRow({ status: "DRAFT" }));
    replaceItemsAndUpdateMock.mockResolvedValueOnce(purchaseOrderRow({ status: "DRAFT" }));
    await purchaseOrderService.updatePurchaseOrder("po-1", validInput());
    expect(replaceItemsAndUpdateMock).toHaveBeenCalledWith(
      FAKE_TX,
      "po-1",
      COMPANY_ID,
      ["DRAFT"],
      expect.any(Object),
      expect.any(Array)
    );
  });

  it("rejects when the purchase order belongs to a different company", async () => {
    findByIdMock.mockResolvedValueOnce(purchaseOrderRow({ companyId: OTHER_COMPANY_ID }));
    await expect(purchaseOrderService.updatePurchaseOrder("po-1", validInput())).rejects.toThrow(
      "Purchase order not found."
    );
  });
});

describe("getPurchaseOrder / listPurchaseOrders — cross-company and scoping", () => {
  it("getPurchaseOrder returns null for a cross-company purchase order", async () => {
    findByIdMock.mockResolvedValueOnce(purchaseOrderRow({ companyId: OTHER_COMPANY_ID }));
    await expect(purchaseOrderService.getPurchaseOrder("po-1")).resolves.toBeNull();
  });

  it("listPurchaseOrders returns [] with no active financial year", async () => {
    getCurrentFinancialYearMock.mockResolvedValueOnce(null);
    const result = await purchaseOrderService.listPurchaseOrders();
    expect(result).toEqual([]);
    expect(findManyMock).not.toHaveBeenCalled();
  });
});
