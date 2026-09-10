import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mirrors delivery-challan-service.test.ts's convention — mock the
// module-boundary repository, sibling services/engines, and the
// session/permission/Prisma boundaries.
const {
  findManyMock,
  findByIdMock,
  findReceivedNotInvoicedMock,
  createMock,
  replaceItemsAndUpdateMock,
  updateStatusMock,
  findSupplierForGrnMock,
  findProductsForLinesMock,
  findWarehousesForLinesMock,
  findReceivableProductsMock,
  findSelectableWarehousesMock,
  getCurrentCompanyUserMock,
  getCurrentFinancialYearMock,
  assertPermissionMock,
  ensureSequenceMock,
  generateNumberMock,
  previewNextNumberMock,
  listSelectableSuppliersMock,
  getPurchaseOrderMock,
  applyReceiptMock,
  FAKE_TX,
} = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  findByIdMock: vi.fn(),
  findReceivedNotInvoicedMock: vi.fn(),
  createMock: vi.fn(),
  replaceItemsAndUpdateMock: vi.fn(),
  updateStatusMock: vi.fn(),
  findSupplierForGrnMock: vi.fn(),
  findProductsForLinesMock: vi.fn(),
  findWarehousesForLinesMock: vi.fn(),
  findReceivableProductsMock: vi.fn(),
  findSelectableWarehousesMock: vi.fn(),
  getCurrentCompanyUserMock: vi.fn(),
  getCurrentFinancialYearMock: vi.fn(),
  assertPermissionMock: vi.fn(),
  ensureSequenceMock: vi.fn(),
  generateNumberMock: vi.fn(),
  previewNextNumberMock: vi.fn(),
  listSelectableSuppliersMock: vi.fn(),
  getPurchaseOrderMock: vi.fn(),
  applyReceiptMock: vi.fn(),
  FAKE_TX: { marker: "fake-tx" },
}));

vi.mock("@/modules/goods-receipt-notes/repositories/goods-receipt-note-repository", () => ({
  goodsReceiptNoteRepository: {
    findMany: findManyMock,
    findById: findByIdMock,
    findReceivedNotInvoiced: findReceivedNotInvoicedMock,
    create: createMock,
    replaceItemsAndUpdate: replaceItemsAndUpdateMock,
    updateStatus: updateStatusMock,
    findSupplierForGrn: findSupplierForGrnMock,
    findProductsForLines: findProductsForLinesMock,
    findWarehousesForLines: findWarehousesForLinesMock,
    findReceivableProducts: findReceivableProductsMock,
    findSelectableWarehouses: findSelectableWarehousesMock,
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

vi.mock("@/modules/purchase-orders/services/purchase-order-service", () => ({
  purchaseOrderService: { getPurchaseOrder: getPurchaseOrderMock, applyReceipt: applyReceiptMock },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: (fn: (tx: unknown) => unknown) => fn(FAKE_TX) },
}));

import { AppError } from "@/lib/app-error";
import { goodsReceiptNoteService } from "@/modules/goods-receipt-notes/services/goods-receipt-note-service";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_COMPANY_ID = "99999999-9999-4999-8999-999999999999";
const FY_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";
const SUPPLIER_ID = "44444444-4444-4444-8444-444444444444";
const PRODUCT_ID = "55555555-5555-4555-8555-555555555555";
const WAREHOUSE_ID = "66666666-6666-4666-8666-666666666666";
const PURCHASE_ORDER_ID = "77777777-7777-4777-8777-777777777777";
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

const ACTIVE_SUPPLIER = { id: SUPPLIER_ID, companyId: COMPANY_ID, isActive: true };

const PRODUCT = {
  id: PRODUCT_ID,
  name: "Product A",
  productCode: "A",
  isActive: true,
  unitSymbol: "Nos",
  unitDecimalPlaces: 0,
};

const WAREHOUSE = { id: WAREHOUSE_ID, name: "Main Warehouse", code: "WH1", isActive: true };

function validLines() {
  return [{ productId: PRODUCT_ID, warehouseId: WAREHOUSE_ID, quantity: 5, rejectedQuantity: 0 }];
}

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    supplierId: SUPPLIER_ID,
    grnDate: "2026-09-10",
    narration: undefined,
    lines: validLines(),
    ...overrides,
  };
}

function grnRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "grn-1",
    companyId: COMPANY_ID,
    financialYearId: FY_ID,
    grnNumber: "GRN-0001",
    status: "DRAFT",
    purchaseOrderId: null,
    items: [],
    ...overrides,
  };
}

function purchaseOrderDetail(overrides: Record<string, unknown> = {}) {
  return {
    id: PURCHASE_ORDER_ID,
    companyId: COMPANY_ID,
    supplierId: SUPPLIER_ID,
    orderNumber: "PO-0001",
    status: "CONFIRMED",
    items: [
      {
        id: ITEM_ID,
        productId: PRODUCT_ID,
        quantity: 10,
        receivedQuantity: 2,
        product: { id: PRODUCT_ID, name: "Product A", productCode: "A", isActive: true },
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  findManyMock.mockReset();
  findByIdMock.mockReset();
  findReceivedNotInvoicedMock.mockReset();
  createMock.mockReset();
  replaceItemsAndUpdateMock.mockReset();
  updateStatusMock.mockReset();
  findSupplierForGrnMock.mockReset();
  findProductsForLinesMock.mockReset();
  findWarehousesForLinesMock.mockReset();
  findReceivableProductsMock.mockReset();
  findSelectableWarehousesMock.mockReset();
  getCurrentCompanyUserMock.mockReset();
  getCurrentFinancialYearMock.mockReset();
  assertPermissionMock.mockReset();
  ensureSequenceMock.mockReset();
  generateNumberMock.mockReset();
  previewNextNumberMock.mockReset();
  listSelectableSuppliersMock.mockReset();
  getPurchaseOrderMock.mockReset();
  applyReceiptMock.mockReset();

  getCurrentCompanyUserMock.mockResolvedValue(CURRENT_USER);
  getCurrentFinancialYearMock.mockResolvedValue(CURRENT_FY);
  assertPermissionMock.mockResolvedValue(undefined);
  findSupplierForGrnMock.mockResolvedValue(ACTIVE_SUPPLIER);
  findProductsForLinesMock.mockResolvedValue([PRODUCT]);
  findWarehousesForLinesMock.mockResolvedValue([WAREHOUSE]);
  generateNumberMock.mockResolvedValue({ documentSequenceId: "seq-1", number: 1, formatted: "GRN-0001" });
  createMock.mockResolvedValue(grnRow());
});

describe("createGoodsReceiptNote — manual (no linked purchase order)", () => {
  it("creates a DRAFT GRN and generates a number", async () => {
    await goodsReceiptNoteService.createGoodsReceiptNote(validInput());

    expect(ensureSequenceMock).toHaveBeenCalledWith(COMPANY_ID, FY_ID, "GOODS_RECEIPT_NOTE");
    expect(generateNumberMock).toHaveBeenCalledWith(FAKE_TX, {
      companyId: COMPANY_ID,
      financialYearId: FY_ID,
      documentType: "GOODS_RECEIPT_NOTE",
    });
    expect(createMock).toHaveBeenCalledWith(
      FAKE_TX,
      COMPANY_ID,
      FY_ID,
      expect.objectContaining({ supplierId: SUPPLIER_ID, purchaseOrderId: null }),
      [
        expect.objectContaining({
          productId: PRODUCT_ID,
          warehouseId: WAREHOUSE_ID,
          quantity: 5,
          rejectedQuantity: 0,
          purchaseOrderItemId: null,
        }),
      ],
      { documentSequenceId: "seq-1", number: 1, formatted: "GRN-0001" },
      USER_ID
    );
  });

  it("rejects when the supplier does not exist or belongs to another company", async () => {
    findSupplierForGrnMock.mockResolvedValueOnce(null);
    await expect(goodsReceiptNoteService.createGoodsReceiptNote(validInput())).rejects.toThrow("Supplier not found.");
  });

  it("translates a document-number unique-constraint collision into a friendly message", async () => {
    createMock.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "7.8.0",
        meta: { target: ["grnNumber"] },
      })
    );
    await expect(goodsReceiptNoteService.createGoodsReceiptNote(validInput())).rejects.toThrow(
      "A goods receipt note with this number already exists for this financial year."
    );
  });

  it("every rejection is an AppError, safe to surface to the client", async () => {
    findSupplierForGrnMock.mockResolvedValueOnce(null);
    await expect(goodsReceiptNoteService.createGoodsReceiptNote(validInput())).rejects.toBeInstanceOf(AppError);
  });
});

describe("createGoodsReceiptNote — linked to a purchase order", () => {
  function linkedInput(quantity: number, rejectedQuantity = 0, purchaseOrderItemId = ITEM_ID) {
    return validInput({
      purchaseOrderId: PURCHASE_ORDER_ID,
      lines: [{ productId: PRODUCT_ID, warehouseId: WAREHOUSE_ID, quantity, rejectedQuantity, purchaseOrderItemId }],
    });
  }

  it("accepts a line whose combined quantity is within the order line's remaining quantity", async () => {
    getPurchaseOrderMock.mockResolvedValueOnce(purchaseOrderDetail());
    await goodsReceiptNoteService.createGoodsReceiptNote(linkedInput(5));
    expect(createMock).toHaveBeenCalledWith(
      FAKE_TX,
      COMPANY_ID,
      FY_ID,
      expect.objectContaining({ purchaseOrderId: PURCHASE_ORDER_ID }),
      [expect.objectContaining({ purchaseOrderItemId: ITEM_ID })],
      expect.any(Object),
      USER_ID
    );
  });

  it("rejects a line whose combined quantity+rejectedQuantity exceeds remaining (10 - 2 = 8 remaining)", async () => {
    getPurchaseOrderMock.mockResolvedValueOnce(purchaseOrderDetail());
    await expect(goodsReceiptNoteService.createGoodsReceiptNote(linkedInput(5, 4))).rejects.toThrow(
      "exceed the remaining quantity"
    );
  });

  it("accepts a line whose combined quantity+rejectedQuantity exactly matches the remaining quantity", async () => {
    getPurchaseOrderMock.mockResolvedValueOnce(purchaseOrderDetail());
    await expect(goodsReceiptNoteService.createGoodsReceiptNote(linkedInput(5, 3))).resolves.toBeDefined();
  });

  it("rejects a line whose purchaseOrderItemId does not belong to the linked order", async () => {
    getPurchaseOrderMock.mockResolvedValueOnce(purchaseOrderDetail());
    const OTHER_ITEM_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    await expect(goodsReceiptNoteService.createGoodsReceiptNote(linkedInput(1, 0, OTHER_ITEM_ID))).rejects.toThrow(
      "does not belong to the linked purchase order"
    );
  });

  it("rejects when the linked purchase order is not open (e.g. still DRAFT)", async () => {
    getPurchaseOrderMock.mockResolvedValueOnce(purchaseOrderDetail({ status: "DRAFT" }));
    await expect(goodsReceiptNoteService.createGoodsReceiptNote(linkedInput(1))).rejects.toThrow(
      "Only a confirmed or partially received purchase order"
    );
  });

  it("rejects when the linked purchase order belongs to a different supplier", async () => {
    getPurchaseOrderMock.mockResolvedValueOnce(purchaseOrderDetail({ supplierId: "different-supplier" }));
    await expect(goodsReceiptNoteService.createGoodsReceiptNote(linkedInput(1))).rejects.toThrow(
      "does not belong to the selected supplier"
    );
  });

  it("rejects when the linked purchase order does not exist", async () => {
    getPurchaseOrderMock.mockResolvedValueOnce(null);
    await expect(goodsReceiptNoteService.createGoodsReceiptNote(linkedInput(1))).rejects.toThrow(
      "Purchase order not found."
    );
  });
});

describe("receiveGoodsReceiptNote", () => {
  function draftWithLine(overrides: Record<string, unknown> = {}) {
    return grnRow({
      status: "DRAFT",
      items: [
        {
          id: "item-1",
          productId: PRODUCT_ID,
          warehouseId: WAREHOUSE_ID,
          quantity: 5,
          rejectedQuantity: 1,
          purchaseOrderItemId: null,
          product: { id: PRODUCT_ID, name: "Product A" },
          warehouse: { id: WAREHOUSE_ID, name: "Main Warehouse" },
        },
      ],
      ...overrides,
    });
  }

  it("receives a manual (unlinked) GRN without calling applyReceipt — no StockTransaction/Inventory Engine involvement", async () => {
    findByIdMock.mockResolvedValueOnce(draftWithLine());
    updateStatusMock.mockResolvedValueOnce(1);
    findByIdMock.mockResolvedValueOnce(draftWithLine({ status: "RECEIVED" }));

    const result = await goodsReceiptNoteService.receiveGoodsReceiptNote("grn-1");

    expect(applyReceiptMock).not.toHaveBeenCalled();
    expect(updateStatusMock).toHaveBeenCalledWith(FAKE_TX, "grn-1", COMPANY_ID, ["DRAFT"], "RECEIVED");
    expect(result.status).toBe("RECEIVED");
  });

  it("receives a linked GRN by calling applyReceipt with the combined quantity+rejectedQuantity, atomically with the same transaction client", async () => {
    findByIdMock.mockResolvedValueOnce(
      draftWithLine({
        purchaseOrderId: PURCHASE_ORDER_ID,
        items: [
          {
            id: "item-1",
            productId: PRODUCT_ID,
            warehouseId: WAREHOUSE_ID,
            quantity: 5,
            rejectedQuantity: 1,
            purchaseOrderItemId: ITEM_ID,
            product: { id: PRODUCT_ID, name: "Product A" },
            warehouse: { id: WAREHOUSE_ID, name: "Main Warehouse" },
          },
        ],
      })
    );
    applyReceiptMock.mockResolvedValueOnce(undefined);
    updateStatusMock.mockResolvedValueOnce(1);
    findByIdMock.mockResolvedValueOnce(draftWithLine({ status: "RECEIVED" }));

    await goodsReceiptNoteService.receiveGoodsReceiptNote("grn-1");

    expect(applyReceiptMock).toHaveBeenCalledWith(
      PURCHASE_ORDER_ID,
      [{ purchaseOrderItemId: ITEM_ID, quantity: 6 }],
      FAKE_TX
    );
  });

  it("rolls back (rejects, never flips status) when applyReceipt's race guard rejects a concurrent over-receipt", async () => {
    findByIdMock.mockResolvedValueOnce(
      draftWithLine({
        purchaseOrderId: PURCHASE_ORDER_ID,
        items: [
          {
            id: "item-1",
            productId: PRODUCT_ID,
            warehouseId: WAREHOUSE_ID,
            quantity: 5,
            rejectedQuantity: 0,
            purchaseOrderItemId: ITEM_ID,
            product: { id: PRODUCT_ID, name: "Product A" },
            warehouse: { id: WAREHOUSE_ID, name: "Main Warehouse" },
          },
        ],
      })
    );
    applyReceiptMock.mockRejectedValueOnce(
      new AppError("Received quantity for Product A cannot exceed the ordered quantity.")
    );

    await expect(goodsReceiptNoteService.receiveGoodsReceiptNote("grn-1")).rejects.toThrow(
      "cannot exceed the ordered quantity"
    );
    expect(updateStatusMock).not.toHaveBeenCalled();
  });

  it("rejects receiving a non-DRAFT GRN", async () => {
    findByIdMock.mockResolvedValueOnce(draftWithLine({ status: "RECEIVED" }));
    await expect(goodsReceiptNoteService.receiveGoodsReceiptNote("grn-1")).rejects.toThrow("can no longer be changed");
  });

  it("rejects receiving a line whose product has since gone inactive", async () => {
    findByIdMock.mockResolvedValueOnce(draftWithLine());
    findProductsForLinesMock.mockResolvedValueOnce([{ ...PRODUCT, isActive: false }]);
    await expect(goodsReceiptNoteService.receiveGoodsReceiptNote("grn-1")).rejects.toThrow(
      "is inactive and cannot be received"
    );
  });

  it("rejects receiving a line whose warehouse has since gone inactive", async () => {
    findByIdMock.mockResolvedValueOnce(draftWithLine());
    findWarehousesForLinesMock.mockResolvedValueOnce([{ ...WAREHOUSE, isActive: false }]);
    await expect(goodsReceiptNoteService.receiveGoodsReceiptNote("grn-1")).rejects.toThrow(
      "is inactive and cannot receive stock"
    );
  });

  it("rejects when the GRN belongs to a different company", async () => {
    findByIdMock.mockResolvedValueOnce(draftWithLine({ companyId: OTHER_COMPANY_ID }));
    await expect(goodsReceiptNoteService.receiveGoodsReceiptNote("grn-1")).rejects.toThrow(
      "Goods receipt note not found."
    );
  });
});

describe("cancelGoodsReceiptNote", () => {
  it("DRAFT -> CANCELLED succeeds", async () => {
    updateStatusMock.mockResolvedValueOnce(1);
    findByIdMock.mockResolvedValueOnce(grnRow({ status: "CANCELLED" }));
    const result = await goodsReceiptNoteService.cancelGoodsReceiptNote("grn-1");
    expect(updateStatusMock).toHaveBeenCalledWith(expect.anything(), "grn-1", COMPANY_ID, ["DRAFT"], "CANCELLED");
    expect(result.status).toBe("CANCELLED");
  });

  it("rejects cancelling a non-DRAFT GRN (a RECEIVED GRN cannot be un-received)", async () => {
    updateStatusMock.mockResolvedValueOnce(0);
    await expect(goodsReceiptNoteService.cancelGoodsReceiptNote("grn-1")).rejects.toThrow("can no longer be changed");
  });
});

describe("markInvoiced — idempotency", () => {
  it("RECEIVED -> INVOICED succeeds", async () => {
    findByIdMock.mockResolvedValueOnce(grnRow({ status: "RECEIVED" }));
    updateStatusMock.mockResolvedValueOnce(1);
    await goodsReceiptNoteService.markInvoiced("grn-1");
    expect(updateStatusMock).toHaveBeenCalledWith(expect.anything(), "grn-1", COMPANY_ID, ["RECEIVED"], "INVOICED");
  });

  it("is a no-op when already INVOICED — defensive against a retried/duplicate call", async () => {
    findByIdMock.mockResolvedValueOnce(grnRow({ status: "INVOICED" }));
    await goodsReceiptNoteService.markInvoiced("grn-1");
    expect(updateStatusMock).not.toHaveBeenCalled();
  });

  it("rejects marking a DRAFT GRN invoiced", async () => {
    findByIdMock.mockResolvedValueOnce(grnRow({ status: "DRAFT" }));
    updateStatusMock.mockResolvedValueOnce(0);
    findByIdMock.mockResolvedValueOnce(grnRow({ status: "DRAFT" }));
    await expect(goodsReceiptNoteService.markInvoiced("grn-1")).rejects.toThrow("can no longer be changed");
  });

  it("is also a no-op when the guarded write loses a genuinely concurrent race (both callers see INVOICED)", async () => {
    findByIdMock.mockResolvedValueOnce(grnRow({ status: "RECEIVED" }));
    updateStatusMock.mockResolvedValueOnce(0);
    findByIdMock.mockResolvedValueOnce(grnRow({ status: "INVOICED" }));
    await expect(goodsReceiptNoteService.markInvoiced("grn-1")).resolves.toBeUndefined();
  });

  it("participates in the caller's own transaction when one is passed", async () => {
    const CALLER_TX = { marker: "caller-tx" } as never;
    findByIdMock.mockResolvedValueOnce(grnRow({ status: "RECEIVED" }));
    updateStatusMock.mockResolvedValueOnce(1);
    await goodsReceiptNoteService.markInvoiced("grn-1", CALLER_TX);
    expect(findByIdMock).toHaveBeenCalledWith("grn-1", CALLER_TX);
    expect(updateStatusMock).toHaveBeenCalledWith(CALLER_TX, "grn-1", COMPANY_ID, ["RECEIVED"], "INVOICED");
  });

  it("rejects when the GRN belongs to a different company", async () => {
    findByIdMock.mockResolvedValueOnce(grnRow({ companyId: OTHER_COMPANY_ID }));
    await expect(goodsReceiptNoteService.markInvoiced("grn-1")).rejects.toThrow("Goods receipt note not found.");
  });
});

describe("getGoodsReceiptNote / listGoodsReceiptNotes — cross-company and scoping", () => {
  it("getGoodsReceiptNote returns null for a cross-company GRN", async () => {
    findByIdMock.mockResolvedValueOnce(grnRow({ companyId: OTHER_COMPANY_ID }));
    await expect(goodsReceiptNoteService.getGoodsReceiptNote("grn-1")).resolves.toBeNull();
  });

  it("listGoodsReceiptNotes returns [] with no active financial year", async () => {
    getCurrentFinancialYearMock.mockResolvedValueOnce(null);
    const result = await goodsReceiptNoteService.listGoodsReceiptNotes();
    expect(result).toEqual([]);
    expect(findManyMock).not.toHaveBeenCalled();
  });
});

describe("getPurchaseOrderPrefill", () => {
  it("returns the order's remaining (unreceived) lines", async () => {
    getPurchaseOrderMock.mockResolvedValueOnce(purchaseOrderDetail());
    findProductsForLinesMock.mockResolvedValueOnce([PRODUCT]);

    const result = await goodsReceiptNoteService.getPurchaseOrderPrefill(PURCHASE_ORDER_ID);

    expect(result).toEqual(
      expect.objectContaining({
        purchaseOrderId: PURCHASE_ORDER_ID,
        supplierId: SUPPLIER_ID,
        lines: [expect.objectContaining({ purchaseOrderItemId: ITEM_ID, remainingQuantity: 8 })],
      })
    );
  });

  it("returns null for a non-open purchase order", async () => {
    getPurchaseOrderMock.mockResolvedValueOnce(purchaseOrderDetail({ status: "DRAFT" }));
    await expect(goodsReceiptNoteService.getPurchaseOrderPrefill(PURCHASE_ORDER_ID)).resolves.toBeNull();
  });

  it("returns null when the purchase order does not exist", async () => {
    getPurchaseOrderMock.mockResolvedValueOnce(null);
    await expect(goodsReceiptNoteService.getPurchaseOrderPrefill(PURCHASE_ORDER_ID)).resolves.toBeNull();
  });
});
