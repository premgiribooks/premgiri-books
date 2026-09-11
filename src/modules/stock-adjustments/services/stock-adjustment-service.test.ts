import { describe, expect, it, vi, beforeEach } from "vitest";

// Mirrors opening-stock-service.test.ts's / purchase-return-service.test.ts's
// convention — mock the module-boundary repository, the Document Number and
// Inventory Engines this service orchestrates, and the shared
// transaction/session/permission boundaries, so runInTransaction's own
// callback runs against a fake tx instead of a real database, and the
// Serializable-retry options passed to it can be asserted directly.
const {
  findManyMock,
  findByIdMock,
  createMock,
  replaceItemsAndUpdateMock,
  markPostedMock,
  updateStatusMock,
  findSelectableProductsMock,
  findSelectableWarehousesMock,
  findProductsForLinesMock,
  findWarehousesForLinesMock,
  ensureSequenceMock,
  generateNumberMock,
  previewNextNumberMock,
  recordMovementsMock,
  getCurrentCompanyUserMock,
  getCurrentFinancialYearMock,
  assertPermissionMock,
  runInTransactionMock,
  FAKE_TX,
} = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  findByIdMock: vi.fn(),
  createMock: vi.fn(),
  replaceItemsAndUpdateMock: vi.fn(),
  markPostedMock: vi.fn(),
  updateStatusMock: vi.fn(),
  findSelectableProductsMock: vi.fn(),
  findSelectableWarehousesMock: vi.fn(),
  findProductsForLinesMock: vi.fn(),
  findWarehousesForLinesMock: vi.fn(),
  ensureSequenceMock: vi.fn(),
  generateNumberMock: vi.fn(),
  previewNextNumberMock: vi.fn(),
  recordMovementsMock: vi.fn(),
  getCurrentCompanyUserMock: vi.fn(),
  getCurrentFinancialYearMock: vi.fn(),
  assertPermissionMock: vi.fn(),
  runInTransactionMock: vi.fn(),
  FAKE_TX: { marker: "fake-tx" },
}));

vi.mock("@/modules/stock-adjustments/repositories/stock-adjustment-repository", () => ({
  stockAdjustmentRepository: {
    findMany: findManyMock,
    findById: findByIdMock,
    create: createMock,
    replaceItemsAndUpdate: replaceItemsAndUpdateMock,
    markPosted: markPostedMock,
    updateStatus: updateStatusMock,
    findSelectableProducts: findSelectableProductsMock,
    findSelectableWarehouses: findSelectableWarehousesMock,
    findProductsForLines: findProductsForLinesMock,
    findWarehousesForLines: findWarehousesForLinesMock,
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

vi.mock("@/engines/document-number/document-number-engine", () => ({
  documentNumberEngine: { ensureSequence: ensureSequenceMock, generateNumber: generateNumberMock, previewNextNumber: previewNextNumberMock },
}));

vi.mock("@/engines/inventory/inventory-engine", () => ({
  inventoryEngine: { recordMovements: recordMovementsMock },
}));

vi.mock("@/lib/current-user", () => ({ getCurrentCompanyUser: getCurrentCompanyUserMock }));
vi.mock("@/lib/current-financial-year", () => ({ getCurrentFinancialYear: getCurrentFinancialYearMock }));
vi.mock("@/lib/permissions", () => ({ assertPermission: assertPermissionMock }));
vi.mock("@/lib/transaction", () => ({ runInTransaction: runInTransactionMock }));

import { AppError } from "@/lib/app-error";
import { stockAdjustmentService } from "@/modules/stock-adjustments/services/stock-adjustment-service";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const FY_ID = "33333333-3333-4333-8333-333333333333";
const ADJUSTMENT_ID = "44444444-4444-4444-8444-444444444444";
const PRODUCT_A = "55555555-5555-4555-8555-555555555555";
const PRODUCT_B = "66666666-6666-4666-8666-666666666666";
const WAREHOUSE_A = "77777777-7777-4777-8777-777777777777";

const CURRENT_USER = { id: USER_ID, companyId: COMPANY_ID, role: "Owner", userType: "COMPANY" as const, username: "owner", fullName: "Owner" };
const CURRENT_FY = { id: FY_ID };

function draftRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ADJUSTMENT_ID,
    companyId: COMPANY_ID,
    financialYearId: FY_ID,
    adjustmentNumber: null,
    adjustmentDate: new Date("2026-09-11T00:00:00.000Z"),
    reason: "Quarterly shrinkage write-off",
    status: "DRAFT",
    createdByUserId: USER_ID,
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [
      { id: "item-1", stockAdjustmentId: ADJUSTMENT_ID, lineNumber: 1, productId: PRODUCT_A, warehouseId: WAREHOUSE_A, direction: "IN", quantity: 10, narration: null },
      { id: "item-2", stockAdjustmentId: ADJUSTMENT_ID, lineNumber: 2, productId: PRODUCT_B, warehouseId: WAREHOUSE_A, direction: "OUT", quantity: 4, narration: "damaged carton" },
    ],
    ...overrides,
  };
}

interface LineInputOverrides {
  productId?: string;
  warehouseId?: string;
  direction?: "IN" | "OUT";
  quantity?: number;
  narration?: string;
}

function lineInput(overrides: LineInputOverrides = {}) {
  return { productId: PRODUCT_A, warehouseId: WAREHOUSE_A, direction: "IN" as const, quantity: 10, ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentCompanyUserMock.mockResolvedValue(CURRENT_USER);
  getCurrentFinancialYearMock.mockResolvedValue(CURRENT_FY);
  assertPermissionMock.mockResolvedValue(undefined);
  runInTransactionMock.mockImplementation((fn: (tx: unknown) => unknown) => fn(FAKE_TX));
  recordMovementsMock.mockResolvedValue([]);
  findProductsForLinesMock.mockResolvedValue([{ id: PRODUCT_A }, { id: PRODUCT_B }]);
  findWarehousesForLinesMock.mockResolvedValue([{ id: WAREHOUSE_A }]);
});

describe("stockAdjustmentService.createDraft", () => {
  it("creates a draft with no adjustmentNumber assigned and never touches the Document Number Engine", async () => {
    createMock.mockResolvedValue(draftRow());

    const result = await stockAdjustmentService.createDraft({
      adjustmentDate: "2026-09-11",
      reason: "Quarterly shrinkage write-off",
      lines: [lineInput()],
    });

    expect(result.adjustmentNumber).toBeNull();
    expect(assertPermissionMock).toHaveBeenCalledWith(CURRENT_USER, "inventory", "create");
    expect(createMock).toHaveBeenCalledWith(
      FAKE_TX,
      COMPANY_ID,
      FY_ID,
      expect.objectContaining({ reason: "Quarterly shrinkage write-off" }),
      expect.arrayContaining([expect.objectContaining({ productId: PRODUCT_A })]),
      USER_ID
    );
    expect(ensureSequenceMock).not.toHaveBeenCalled();
    expect(generateNumberMock).not.toHaveBeenCalled();
  });

  it("rejects when no financial year is selected", async () => {
    getCurrentFinancialYearMock.mockResolvedValue(null);

    await expect(
      stockAdjustmentService.createDraft({ adjustmentDate: "2026-09-11", reason: "reason", lines: [lineInput()] })
    ).rejects.toThrow(AppError);
  });

  // A cross-tenant productId/warehouseId must never be persisted into a
  // draft — the company-scoped existence check runs BEFORE any write, so a
  // foreign id is rejected outright rather than silently stored and later
  // leaking that other company's product/warehouse name on this draft's
  // detail/edit pages.
  it("rejects a line referencing a product outside the caller's company", async () => {
    findProductsForLinesMock.mockResolvedValue([]);

    await expect(
      stockAdjustmentService.createDraft({ adjustmentDate: "2026-09-11", reason: "reason", lines: [lineInput()] })
    ).rejects.toThrow("One or more products were not found.");
    expect(createMock).not.toHaveBeenCalled();
  });

  it("rejects a line referencing a warehouse outside the caller's company", async () => {
    findWarehousesForLinesMock.mockResolvedValue([]);

    await expect(
      stockAdjustmentService.createDraft({ adjustmentDate: "2026-09-11", reason: "reason", lines: [lineInput()] })
    ).rejects.toThrow("One or more warehouses were not found.");
    expect(createMock).not.toHaveBeenCalled();
  });
});

describe("stockAdjustmentService.updateDraft", () => {
  it("rejects updating a non-DRAFT adjustment", async () => {
    findByIdMock.mockResolvedValue(draftRow({ status: "POSTED" }));

    await expect(
      stockAdjustmentService.updateDraft(ADJUSTMENT_ID, { adjustmentDate: "2026-09-11", reason: "reason", lines: [lineInput()] })
    ).rejects.toThrow(AppError);
    expect(replaceItemsAndUpdateMock).not.toHaveBeenCalled();
  });

  it("rejects a cross-company adjustment", async () => {
    findByIdMock.mockResolvedValue(draftRow({ companyId: "other-company" }));

    await expect(
      stockAdjustmentService.updateDraft(ADJUSTMENT_ID, { adjustmentDate: "2026-09-11", reason: "reason", lines: [lineInput()] })
    ).rejects.toThrow(AppError);
  });

  it("rejects a line referencing a product outside the caller's company", async () => {
    findByIdMock.mockResolvedValue(draftRow());
    findProductsForLinesMock.mockResolvedValue([]);

    await expect(
      stockAdjustmentService.updateDraft(ADJUSTMENT_ID, { adjustmentDate: "2026-09-11", reason: "reason", lines: [lineInput()] })
    ).rejects.toThrow("One or more products were not found.");
    expect(replaceItemsAndUpdateMock).not.toHaveBeenCalled();
  });
});

describe("stockAdjustmentService.postStockAdjustment", () => {
  it("posts mixed IN/OUT lines atomically, honoring each line's own direction", async () => {
    findByIdMock.mockResolvedValueOnce(draftRow()).mockResolvedValueOnce(draftRow());
    generateNumberMock.mockResolvedValue({ documentSequenceId: "seq-1", number: 1, formatted: "STKADJ-0001" });
    markPostedMock.mockResolvedValue(draftRow({ status: "POSTED", adjustmentNumber: "STKADJ-0001" }));

    const result = await stockAdjustmentService.postStockAdjustment(ADJUSTMENT_ID);

    expect(assertPermissionMock).toHaveBeenCalledWith(CURRENT_USER, "inventory", "approve");
    expect(ensureSequenceMock).toHaveBeenCalledWith(COMPANY_ID, FY_ID, "STOCK_ADJUSTMENT");
    expect(recordMovementsMock).toHaveBeenCalledWith(
      COMPANY_ID,
      expect.arrayContaining([
        expect.objectContaining({ productId: PRODUCT_A, direction: "IN", transactionType: "ADJUSTMENT" }),
        expect.objectContaining({ productId: PRODUCT_B, direction: "OUT", transactionType: "ADJUSTMENT" }),
      ]),
      FAKE_TX
    );
    expect(markPostedMock).toHaveBeenCalledWith(FAKE_TX, ADJUSTMENT_ID, COMPANY_ID, expect.objectContaining({ formatted: "STKADJ-0001" }));
    expect(result.status).toBe("POSTED");
  });

  it("runs posting under Serializable isolation with bounded retry", async () => {
    findByIdMock.mockResolvedValueOnce(draftRow()).mockResolvedValueOnce(draftRow());
    generateNumberMock.mockResolvedValue({ documentSequenceId: "seq-1", number: 1, formatted: "STKADJ-0001" });
    markPostedMock.mockResolvedValue(draftRow({ status: "POSTED" }));

    await stockAdjustmentService.postStockAdjustment(ADJUSTMENT_ID);

    expect(runInTransactionMock).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ isolationLevel: "Serializable", retryable: expect.any(Function), conflictMessage: expect.any(String) })
    );
  });

  it("rejects posting a non-DRAFT adjustment", async () => {
    findByIdMock.mockResolvedValue(draftRow({ status: "POSTED" }));

    await expect(stockAdjustmentService.postStockAdjustment(ADJUSTMENT_ID)).rejects.toThrow(AppError);
    expect(recordMovementsMock).not.toHaveBeenCalled();
  });

  it("an injected failure in the stock posting prevents the status flip (single-transaction atomicity)", async () => {
    findByIdMock.mockResolvedValueOnce(draftRow()).mockResolvedValueOnce(draftRow());
    generateNumberMock.mockResolvedValue({ documentSequenceId: "seq-1", number: 1, formatted: "STKADJ-0001" });
    recordMovementsMock.mockRejectedValueOnce(new AppError("Insufficient stock for this product at the selected warehouse."));

    await expect(stockAdjustmentService.postStockAdjustment(ADJUSTMENT_ID)).rejects.toThrow("Insufficient stock");
    expect(markPostedMock).not.toHaveBeenCalled();
  });

  it("rejects when the caller lacks the inventory/approve permission", async () => {
    assertPermissionMock.mockRejectedValue(new AppError("You do not have permission to approve inventory."));

    await expect(stockAdjustmentService.postStockAdjustment(ADJUSTMENT_ID)).rejects.toThrow(
      "You do not have permission to approve inventory."
    );
    expect(findByIdMock).not.toHaveBeenCalled();
  });
});

describe("stockAdjustmentService.cancelStockAdjustment", () => {
  it("reverses every line with the opposite direction (an IN line reverses to OUT, an OUT line reverses to IN)", async () => {
    const posted = draftRow({ status: "POSTED", adjustmentNumber: "STKADJ-0001" });
    findByIdMock.mockResolvedValueOnce(posted).mockResolvedValueOnce(posted).mockResolvedValueOnce(draftRow({ status: "CANCELLED" }));
    updateStatusMock.mockResolvedValue(1);

    const result = await stockAdjustmentService.cancelStockAdjustment(ADJUSTMENT_ID);

    expect(recordMovementsMock).toHaveBeenCalledWith(
      COMPANY_ID,
      expect.arrayContaining([
        expect.objectContaining({ productId: PRODUCT_A, direction: "OUT" }),
        expect.objectContaining({ productId: PRODUCT_B, direction: "IN" }),
      ]),
      FAKE_TX
    );
    expect(result.status).toBe("CANCELLED");
  });

  it("runs cancellation under Serializable isolation with bounded retry (the reversal batch may contain OUT lines)", async () => {
    const posted = draftRow({ status: "POSTED" });
    findByIdMock.mockResolvedValueOnce(posted).mockResolvedValueOnce(posted).mockResolvedValueOnce(draftRow({ status: "CANCELLED" }));
    updateStatusMock.mockResolvedValue(1);

    await stockAdjustmentService.cancelStockAdjustment(ADJUSTMENT_ID);

    expect(runInTransactionMock).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ isolationLevel: "Serializable", retryable: expect.any(Function), conflictMessage: expect.any(String) })
    );
  });

  it("rejects cancelling a non-POSTED adjustment", async () => {
    findByIdMock.mockResolvedValue(draftRow({ status: "DRAFT" }));

    await expect(stockAdjustmentService.cancelStockAdjustment(ADJUSTMENT_ID)).rejects.toThrow(AppError);
    expect(recordMovementsMock).not.toHaveBeenCalled();
  });

  it("an injected failure in the stock reversal prevents the status flip (single-transaction atomicity)", async () => {
    const posted = draftRow({ status: "POSTED" });
    findByIdMock.mockResolvedValueOnce(posted).mockResolvedValueOnce(posted);
    recordMovementsMock.mockRejectedValueOnce(new Error("stock reversal failed"));

    await expect(stockAdjustmentService.cancelStockAdjustment(ADJUSTMENT_ID)).rejects.toThrow("stock reversal failed");
    expect(updateStatusMock).not.toHaveBeenCalled();
  });
});

describe("stockAdjustmentService.listStockAdjustments / getStockAdjustment / listFormOptions", () => {
  it("gates listing on inventory/view and returns empty without a financial year", async () => {
    getCurrentFinancialYearMock.mockResolvedValue(null);

    const result = await stockAdjustmentService.listStockAdjustments();

    expect(assertPermissionMock).toHaveBeenCalledWith(CURRENT_USER, "inventory", "view");
    expect(result).toEqual([]);
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it("scopes getStockAdjustment to the caller's company", async () => {
    findByIdMock.mockResolvedValue(draftRow({ companyId: "other-company" }));

    const result = await stockAdjustmentService.getStockAdjustment(ADJUSTMENT_ID);

    expect(result).toBeNull();
  });

  it("returns the product/warehouse picker options plus a next-number preview", async () => {
    findSelectableProductsMock.mockResolvedValue([{ id: PRODUCT_A }]);
    findSelectableWarehousesMock.mockResolvedValue([{ id: WAREHOUSE_A }]);
    previewNextNumberMock.mockResolvedValue({ number: 1, formatted: "STKADJ-0001" });

    const options = await stockAdjustmentService.listFormOptions();

    expect(options).toEqual({ products: [{ id: PRODUCT_A }], warehouses: [{ id: WAREHOUSE_A }], nextAdjustmentNumber: "STKADJ-0001" });
  });
});
