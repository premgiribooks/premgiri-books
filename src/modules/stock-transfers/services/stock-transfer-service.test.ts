import { describe, expect, it, vi, beforeEach } from "vitest";

// Mirrors stock-adjustment-service.test.ts's / opening-stock-service.test.ts's
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
  transferStockMock,
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
  transferStockMock: vi.fn(),
  getCurrentCompanyUserMock: vi.fn(),
  getCurrentFinancialYearMock: vi.fn(),
  assertPermissionMock: vi.fn(),
  runInTransactionMock: vi.fn(),
  FAKE_TX: { marker: "fake-tx" },
}));

vi.mock("@/modules/stock-transfers/repositories/stock-transfer-repository", () => ({
  stockTransferRepository: {
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
  inventoryEngine: { transferStock: transferStockMock },
}));

vi.mock("@/lib/current-user", () => ({ getCurrentCompanyUser: getCurrentCompanyUserMock }));
vi.mock("@/lib/current-financial-year", () => ({ getCurrentFinancialYear: getCurrentFinancialYearMock }));
vi.mock("@/lib/permissions", () => ({ assertPermission: assertPermissionMock }));
vi.mock("@/lib/transaction", () => ({ runInTransaction: runInTransactionMock }));

import { AppError } from "@/lib/app-error";
import { stockTransferService } from "@/modules/stock-transfers/services/stock-transfer-service";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const FY_ID = "33333333-3333-4333-8333-333333333333";
const TRANSFER_ID = "44444444-4444-4444-8444-444444444444";
const PRODUCT_A = "55555555-5555-4555-8555-555555555555";
const PRODUCT_B = "66666666-6666-4666-8666-666666666666";
const SOURCE_WAREHOUSE = "77777777-7777-4777-8777-777777777777";
const DESTINATION_WAREHOUSE = "88888888-8888-4888-8888-888888888888";

const CURRENT_USER = { id: USER_ID, companyId: COMPANY_ID, role: "Owner", userType: "COMPANY" as const, username: "owner", fullName: "Owner" };
const CURRENT_FY = { id: FY_ID };

function draftRow(overrides: Record<string, unknown> = {}) {
  return {
    id: TRANSFER_ID,
    companyId: COMPANY_ID,
    financialYearId: FY_ID,
    transferNumber: null,
    transferDate: new Date("2026-09-11T00:00:00.000Z"),
    sourceWarehouseId: SOURCE_WAREHOUSE,
    destinationWarehouseId: DESTINATION_WAREHOUSE,
    sourceWarehouseName: "Main Store",
    destinationWarehouseName: "Branch Store",
    status: "DRAFT",
    narration: null,
    createdByUserId: USER_ID,
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [
      { id: "item-1", stockTransferId: TRANSFER_ID, lineNumber: 1, productId: PRODUCT_A, quantity: 10 },
      { id: "item-2", stockTransferId: TRANSFER_ID, lineNumber: 2, productId: PRODUCT_B, quantity: 4 },
    ],
    ...overrides,
  };
}

interface LineInputOverrides {
  productId?: string;
  quantity?: number;
}

function lineInput(overrides: LineInputOverrides = {}) {
  return { productId: PRODUCT_A, quantity: 10, ...overrides };
}

function createInput(overrides: Record<string, unknown> = {}) {
  return {
    transferDate: "2026-09-11",
    sourceWarehouseId: SOURCE_WAREHOUSE,
    destinationWarehouseId: DESTINATION_WAREHOUSE,
    lines: [lineInput()],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentCompanyUserMock.mockResolvedValue(CURRENT_USER);
  getCurrentFinancialYearMock.mockResolvedValue(CURRENT_FY);
  assertPermissionMock.mockResolvedValue(undefined);
  runInTransactionMock.mockImplementation((fn: (tx: unknown) => unknown) => fn(FAKE_TX));
  transferStockMock.mockResolvedValue({ outTransaction: {}, inTransaction: {} });
  findProductsForLinesMock.mockResolvedValue([{ id: PRODUCT_A }, { id: PRODUCT_B }]);
  findWarehousesForLinesMock.mockResolvedValue([{ id: SOURCE_WAREHOUSE }, { id: DESTINATION_WAREHOUSE }]);
});

describe("stockTransferService.createDraft", () => {
  it("creates a draft with no transferNumber assigned and never touches the Document Number Engine", async () => {
    createMock.mockResolvedValue(draftRow());

    const result = await stockTransferService.createDraft(createInput());

    expect(result.transferNumber).toBeNull();
    expect(assertPermissionMock).toHaveBeenCalledWith(CURRENT_USER, "inventory", "create");
    expect(createMock).toHaveBeenCalledWith(
      FAKE_TX,
      COMPANY_ID,
      FY_ID,
      expect.objectContaining({ sourceWarehouseId: SOURCE_WAREHOUSE, destinationWarehouseId: DESTINATION_WAREHOUSE }),
      expect.arrayContaining([expect.objectContaining({ productId: PRODUCT_A })]),
      USER_ID
    );
    expect(ensureSequenceMock).not.toHaveBeenCalled();
    expect(generateNumberMock).not.toHaveBeenCalled();
  });

  it("rejects when no financial year is selected", async () => {
    getCurrentFinancialYearMock.mockResolvedValue(null);

    await expect(stockTransferService.createDraft(createInput())).rejects.toThrow(AppError);
  });

  it("rejects when source and destination warehouse are equal", async () => {
    await expect(
      stockTransferService.createDraft(createInput({ destinationWarehouseId: SOURCE_WAREHOUSE }))
    ).rejects.toThrow();
    expect(createMock).not.toHaveBeenCalled();
  });

  // A cross-tenant productId/warehouseId must never be persisted into a
  // draft — the company-scoped existence check runs BEFORE any write, the
  // same rationale as stock-adjustment-service.ts's identical check.
  it("rejects a line referencing a product outside the caller's company", async () => {
    findProductsForLinesMock.mockResolvedValue([]);

    await expect(stockTransferService.createDraft(createInput())).rejects.toThrow("One or more products were not found.");
    expect(createMock).not.toHaveBeenCalled();
  });

  it("rejects a source or destination warehouse outside the caller's company", async () => {
    findWarehousesForLinesMock.mockResolvedValue([{ id: SOURCE_WAREHOUSE }]);

    await expect(stockTransferService.createDraft(createInput())).rejects.toThrow("One or more warehouses were not found.");
    expect(createMock).not.toHaveBeenCalled();
  });
});

describe("stockTransferService.updateDraft", () => {
  it("rejects updating a non-DRAFT transfer", async () => {
    findByIdMock.mockResolvedValue(draftRow({ status: "POSTED" }));

    await expect(stockTransferService.updateDraft(TRANSFER_ID, createInput())).rejects.toThrow(AppError);
    expect(replaceItemsAndUpdateMock).not.toHaveBeenCalled();
  });

  it("rejects a cross-company transfer", async () => {
    findByIdMock.mockResolvedValue(draftRow({ companyId: "other-company" }));

    await expect(stockTransferService.updateDraft(TRANSFER_ID, createInput())).rejects.toThrow(AppError);
  });

  it("rejects a line referencing a product outside the caller's company", async () => {
    findByIdMock.mockResolvedValue(draftRow());
    findProductsForLinesMock.mockResolvedValue([]);

    await expect(stockTransferService.updateDraft(TRANSFER_ID, createInput())).rejects.toThrow("One or more products were not found.");
    expect(replaceItemsAndUpdateMock).not.toHaveBeenCalled();
  });
});

describe("stockTransferService.postStockTransfer", () => {
  it("posts every line via inventoryEngine.transferStock, source to destination, atomically", async () => {
    findByIdMock.mockResolvedValueOnce(draftRow()).mockResolvedValueOnce(draftRow());
    generateNumberMock.mockResolvedValue({ documentSequenceId: "seq-1", number: 1, formatted: "STKTRF-0001" });
    markPostedMock.mockResolvedValue(draftRow({ status: "POSTED", transferNumber: "STKTRF-0001" }));

    const result = await stockTransferService.postStockTransfer(TRANSFER_ID);

    expect(assertPermissionMock).toHaveBeenCalledWith(CURRENT_USER, "inventory", "approve");
    expect(ensureSequenceMock).toHaveBeenCalledWith(COMPANY_ID, FY_ID, "STOCK_TRANSFER");
    expect(transferStockMock).toHaveBeenCalledTimes(2);
    expect(transferStockMock).toHaveBeenNthCalledWith(
      1,
      COMPANY_ID,
      expect.objectContaining({
        productId: PRODUCT_A,
        sourceWarehouseId: SOURCE_WAREHOUSE,
        destinationWarehouseId: DESTINATION_WAREHOUSE,
        quantity: 10,
      }),
      FAKE_TX
    );
    expect(transferStockMock).toHaveBeenNthCalledWith(
      2,
      COMPANY_ID,
      expect.objectContaining({ productId: PRODUCT_B, sourceWarehouseId: SOURCE_WAREHOUSE, destinationWarehouseId: DESTINATION_WAREHOUSE }),
      FAKE_TX
    );
    expect(markPostedMock).toHaveBeenCalledWith(FAKE_TX, TRANSFER_ID, COMPANY_ID, expect.objectContaining({ formatted: "STKTRF-0001" }));
    expect(result.status).toBe("POSTED");
  });

  it("runs posting under Serializable isolation with bounded retry", async () => {
    findByIdMock.mockResolvedValueOnce(draftRow()).mockResolvedValueOnce(draftRow());
    generateNumberMock.mockResolvedValue({ documentSequenceId: "seq-1", number: 1, formatted: "STKTRF-0001" });
    markPostedMock.mockResolvedValue(draftRow({ status: "POSTED" }));

    await stockTransferService.postStockTransfer(TRANSFER_ID);

    expect(runInTransactionMock).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ isolationLevel: "Serializable", retryable: expect.any(Function), conflictMessage: expect.any(String) })
    );
  });

  it("rejects posting a non-DRAFT transfer", async () => {
    findByIdMock.mockResolvedValue(draftRow({ status: "POSTED" }));

    await expect(stockTransferService.postStockTransfer(TRANSFER_ID)).rejects.toThrow(AppError);
    expect(transferStockMock).not.toHaveBeenCalled();
  });

  it("an injected failure on a later line rolls back the whole posting (single-transaction atomicity)", async () => {
    findByIdMock.mockResolvedValueOnce(draftRow()).mockResolvedValueOnce(draftRow());
    generateNumberMock.mockResolvedValue({ documentSequenceId: "seq-1", number: 1, formatted: "STKTRF-0001" });
    transferStockMock.mockResolvedValueOnce({ outTransaction: {}, inTransaction: {} });
    transferStockMock.mockRejectedValueOnce(new AppError("Insufficient stock for this product at the source warehouse."));

    await expect(stockTransferService.postStockTransfer(TRANSFER_ID)).rejects.toThrow("Insufficient stock");
    expect(transferStockMock).toHaveBeenCalledTimes(2);
    expect(markPostedMock).not.toHaveBeenCalled();
  });

  it("rejects when the caller lacks the inventory/approve permission", async () => {
    assertPermissionMock.mockRejectedValue(new AppError("You do not have permission to approve inventory."));

    await expect(stockTransferService.postStockTransfer(TRANSFER_ID)).rejects.toThrow(
      "You do not have permission to approve inventory."
    );
    expect(findByIdMock).not.toHaveBeenCalled();
  });
});

describe("stockTransferService.cancelStockTransfer", () => {
  it("reverses every line with source and destination swapped", async () => {
    const posted = draftRow({ status: "POSTED", transferNumber: "STKTRF-0001" });
    findByIdMock.mockResolvedValueOnce(posted).mockResolvedValueOnce(posted).mockResolvedValueOnce(draftRow({ status: "CANCELLED" }));
    updateStatusMock.mockResolvedValue(1);

    const result = await stockTransferService.cancelStockTransfer(TRANSFER_ID);

    expect(transferStockMock).toHaveBeenCalledTimes(2);
    expect(transferStockMock).toHaveBeenNthCalledWith(
      1,
      COMPANY_ID,
      expect.objectContaining({ productId: PRODUCT_A, sourceWarehouseId: DESTINATION_WAREHOUSE, destinationWarehouseId: SOURCE_WAREHOUSE }),
      FAKE_TX
    );
    expect(result.status).toBe("CANCELLED");
  });

  it("runs cancellation under Serializable isolation with bounded retry", async () => {
    const posted = draftRow({ status: "POSTED" });
    findByIdMock.mockResolvedValueOnce(posted).mockResolvedValueOnce(posted).mockResolvedValueOnce(draftRow({ status: "CANCELLED" }));
    updateStatusMock.mockResolvedValue(1);

    await stockTransferService.cancelStockTransfer(TRANSFER_ID);

    expect(runInTransactionMock).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ isolationLevel: "Serializable", retryable: expect.any(Function), conflictMessage: expect.any(String) })
    );
  });

  it("rejects cancelling a non-POSTED transfer", async () => {
    findByIdMock.mockResolvedValue(draftRow({ status: "DRAFT" }));

    await expect(stockTransferService.cancelStockTransfer(TRANSFER_ID)).rejects.toThrow(AppError);
    expect(transferStockMock).not.toHaveBeenCalled();
  });

  it("an injected failure in the stock reversal prevents the status flip (single-transaction atomicity)", async () => {
    const posted = draftRow({ status: "POSTED" });
    findByIdMock.mockResolvedValueOnce(posted).mockResolvedValueOnce(posted);
    transferStockMock.mockRejectedValueOnce(new Error("stock reversal failed"));

    await expect(stockTransferService.cancelStockTransfer(TRANSFER_ID)).rejects.toThrow("stock reversal failed");
    expect(updateStatusMock).not.toHaveBeenCalled();
  });
});

describe("stockTransferService.listStockTransfers / getStockTransfer / listFormOptions", () => {
  it("gates listing on inventory/view and returns empty without a financial year", async () => {
    getCurrentFinancialYearMock.mockResolvedValue(null);

    const result = await stockTransferService.listStockTransfers();

    expect(assertPermissionMock).toHaveBeenCalledWith(CURRENT_USER, "inventory", "view");
    expect(result).toEqual([]);
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it("scopes getStockTransfer to the caller's company", async () => {
    findByIdMock.mockResolvedValue(draftRow({ companyId: "other-company" }));

    const result = await stockTransferService.getStockTransfer(TRANSFER_ID);

    expect(result).toBeNull();
  });

  it("returns the product/warehouse picker options plus a next-number preview", async () => {
    findSelectableProductsMock.mockResolvedValue([{ id: PRODUCT_A }]);
    findSelectableWarehousesMock.mockResolvedValue([{ id: SOURCE_WAREHOUSE }]);
    previewNextNumberMock.mockResolvedValue({ number: 1, formatted: "STKTRF-0001" });

    const options = await stockTransferService.listFormOptions();

    expect(options).toEqual({ products: [{ id: PRODUCT_A }], warehouses: [{ id: SOURCE_WAREHOUSE }], nextTransferNumber: "STKTRF-0001" });
  });
});
