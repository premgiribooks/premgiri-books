import { describe, expect, it, vi, beforeEach } from "vitest";

// Mirrors stock-transfer-service.test.ts's / stock-adjustment-service.test.ts's
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
  completeWithComputedItemsMock,
  updateStatusMock,
  findSelectableProductsMock,
  findSelectableWarehousesMock,
  findProductsForLinesMock,
  findWarehousesForLinesMock,
  findProductsForCompletionMock,
  findWarehouseForCompletionMock,
  ensureSequenceMock,
  generateNumberMock,
  previewNextNumberMock,
  getCurrentStockMock,
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
  completeWithComputedItemsMock: vi.fn(),
  updateStatusMock: vi.fn(),
  findSelectableProductsMock: vi.fn(),
  findSelectableWarehousesMock: vi.fn(),
  findProductsForLinesMock: vi.fn(),
  findWarehousesForLinesMock: vi.fn(),
  findProductsForCompletionMock: vi.fn(),
  findWarehouseForCompletionMock: vi.fn(),
  ensureSequenceMock: vi.fn(),
  generateNumberMock: vi.fn(),
  previewNextNumberMock: vi.fn(),
  getCurrentStockMock: vi.fn(),
  recordMovementsMock: vi.fn(),
  getCurrentCompanyUserMock: vi.fn(),
  getCurrentFinancialYearMock: vi.fn(),
  assertPermissionMock: vi.fn(),
  runInTransactionMock: vi.fn(),
  FAKE_TX: { marker: "fake-tx" },
}));

vi.mock("@/modules/physical-verifications/repositories/physical-verification-repository", () => ({
  physicalVerificationRepository: {
    findMany: findManyMock,
    findById: findByIdMock,
    create: createMock,
    replaceItemsAndUpdate: replaceItemsAndUpdateMock,
    completeWithComputedItems: completeWithComputedItemsMock,
    updateStatus: updateStatusMock,
    findSelectableProducts: findSelectableProductsMock,
    findSelectableWarehouses: findSelectableWarehousesMock,
    findProductsForLines: findProductsForLinesMock,
    findWarehousesForLines: findWarehousesForLinesMock,
    findProductsForCompletion: findProductsForCompletionMock,
    findWarehouseForCompletion: findWarehouseForCompletionMock,
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

vi.mock("@/engines/document-number/document-number-engine", () => ({
  documentNumberEngine: { ensureSequence: ensureSequenceMock, generateNumber: generateNumberMock, previewNextNumber: previewNextNumberMock },
}));

vi.mock("@/engines/inventory/inventory-engine", () => ({
  inventoryEngine: { getCurrentStock: getCurrentStockMock, recordMovements: recordMovementsMock },
}));

vi.mock("@/lib/current-user", () => ({ getCurrentCompanyUser: getCurrentCompanyUserMock }));
vi.mock("@/lib/current-financial-year", () => ({ getCurrentFinancialYear: getCurrentFinancialYearMock }));
vi.mock("@/lib/permissions", () => ({ assertPermission: assertPermissionMock }));
vi.mock("@/lib/transaction", () => ({ runInTransaction: runInTransactionMock }));

import { AppError } from "@/lib/app-error";
import { physicalVerificationService } from "@/modules/physical-verifications/services/physical-verification-service";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const FY_ID = "33333333-3333-4333-8333-333333333333";
const VERIFICATION_ID = "44444444-4444-4444-8444-444444444444";
const PRODUCT_A = "55555555-5555-4555-8555-555555555555";
const PRODUCT_B = "66666666-6666-4666-8666-666666666666";
const PRODUCT_C = "77777777-7777-4777-8777-777777777777";
const WAREHOUSE_ID = "88888888-8888-4888-8888-888888888888";

const CURRENT_USER = { id: USER_ID, companyId: COMPANY_ID, role: "Owner", userType: "COMPANY" as const, username: "owner", fullName: "Owner" };
const CURRENT_FY = { id: FY_ID };

function draftRow(overrides: Record<string, unknown> = {}) {
  return {
    id: VERIFICATION_ID,
    companyId: COMPANY_ID,
    financialYearId: FY_ID,
    verificationNumber: null,
    verificationDate: new Date("2026-09-11T00:00:00.000Z"),
    warehouseId: WAREHOUSE_ID,
    warehouseName: "Main Store",
    status: "DRAFT",
    narration: null,
    createdByUserId: USER_ID,
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [
      { id: "item-1", physicalVerificationId: VERIFICATION_ID, lineNumber: 1, productId: PRODUCT_A, systemQuantity: 0, countedQuantity: 15, varianceQuantity: 0 },
      { id: "item-2", physicalVerificationId: VERIFICATION_ID, lineNumber: 2, productId: PRODUCT_B, systemQuantity: 0, countedQuantity: 5, varianceQuantity: 0 },
      { id: "item-3", physicalVerificationId: VERIFICATION_ID, lineNumber: 3, productId: PRODUCT_C, systemQuantity: 0, countedQuantity: 8, varianceQuantity: 0 },
    ],
    ...overrides,
  };
}

interface LineInputOverrides {
  productId?: string;
  countedQuantity?: number;
}

function lineInput(overrides: LineInputOverrides = {}) {
  return { productId: PRODUCT_A, countedQuantity: 15, ...overrides };
}

function createInput(overrides: Record<string, unknown> = {}) {
  return {
    verificationDate: "2026-09-11",
    warehouseId: WAREHOUSE_ID,
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
  findProductsForLinesMock.mockResolvedValue([{ id: PRODUCT_A }, { id: PRODUCT_B }, { id: PRODUCT_C }]);
  findWarehousesForLinesMock.mockResolvedValue([{ id: WAREHOUSE_ID }]);
  findWarehouseForCompletionMock.mockResolvedValue({ id: WAREHOUSE_ID, name: "Main Store", isActive: true });
  findProductsForCompletionMock.mockResolvedValue([
    { id: PRODUCT_A, name: "Product A", isActive: true, productType: "TRADING" },
    { id: PRODUCT_B, name: "Product B", isActive: true, productType: "TRADING" },
    { id: PRODUCT_C, name: "Product C", isActive: true, productType: "TRADING" },
  ]);
  recordMovementsMock.mockResolvedValue([]);
});

describe("physicalVerificationService.createDraft", () => {
  it("creates a draft with no verificationNumber assigned and never touches the Document Number Engine", async () => {
    createMock.mockResolvedValue(draftRow());

    const result = await physicalVerificationService.createDraft(createInput());

    expect(result.verificationNumber).toBeNull();
    expect(assertPermissionMock).toHaveBeenCalledWith(CURRENT_USER, "inventory", "create");
    expect(createMock).toHaveBeenCalledWith(
      FAKE_TX,
      COMPANY_ID,
      FY_ID,
      expect.objectContaining({ warehouseId: WAREHOUSE_ID }),
      expect.arrayContaining([
        expect.objectContaining({ productId: PRODUCT_A, countedQuantity: 15, systemQuantity: 0, varianceQuantity: 0 }),
      ]),
      USER_ID
    );
    expect(ensureSequenceMock).not.toHaveBeenCalled();
    expect(generateNumberMock).not.toHaveBeenCalled();
  });

  it("rejects when no financial year is selected", async () => {
    getCurrentFinancialYearMock.mockResolvedValue(null);

    await expect(physicalVerificationService.createDraft(createInput())).rejects.toThrow(AppError);
  });

  // A cross-tenant productId/warehouseId must never be persisted into a
  // draft — the company-scoped existence check runs BEFORE any write, the
  // same rationale as stock-transfer-service.ts's identical check.
  it("rejects a line referencing a product outside the caller's company", async () => {
    findProductsForLinesMock.mockResolvedValue([]);

    await expect(physicalVerificationService.createDraft(createInput())).rejects.toThrow("One or more products were not found.");
    expect(createMock).not.toHaveBeenCalled();
  });

  it("rejects a warehouse outside the caller's company", async () => {
    findWarehousesForLinesMock.mockResolvedValue([]);

    await expect(physicalVerificationService.createDraft(createInput())).rejects.toThrow("Warehouse not found.");
    expect(createMock).not.toHaveBeenCalled();
  });

  it("always persists systemQuantity/varianceQuantity as 0 placeholders regardless of any extra submitted fields", async () => {
    createMock.mockResolvedValue(draftRow());

    await physicalVerificationService.createDraft(
      createInput({ lines: [{ ...lineInput(), systemQuantity: 999, varianceQuantity: 989 }] })
    );

    expect(createMock).toHaveBeenCalledWith(
      FAKE_TX,
      COMPANY_ID,
      FY_ID,
      expect.anything(),
      [expect.objectContaining({ productId: PRODUCT_A, countedQuantity: 15, systemQuantity: 0, varianceQuantity: 0 })],
      USER_ID
    );
  });
});

describe("physicalVerificationService.updateDraft", () => {
  it("rejects updating a non-DRAFT verification", async () => {
    findByIdMock.mockResolvedValue(draftRow({ status: "COMPLETED" }));

    await expect(physicalVerificationService.updateDraft(VERIFICATION_ID, createInput())).rejects.toThrow(AppError);
    expect(replaceItemsAndUpdateMock).not.toHaveBeenCalled();
  });

  it("rejects a cross-company verification", async () => {
    findByIdMock.mockResolvedValue(draftRow({ companyId: "other-company" }));

    await expect(physicalVerificationService.updateDraft(VERIFICATION_ID, createInput())).rejects.toThrow(AppError);
  });
});

describe("physicalVerificationService.completePhysicalVerification", () => {
  it("re-derives system quantity fresh at completion time (not the stale draft-time value) and posts mixed IN/OUT/no-movement lines correctly", async () => {
    findByIdMock.mockResolvedValueOnce(draftRow()).mockResolvedValueOnce(draftRow());
    // Product A: counted 15, system now 10 (moved since draft) -> variance +5 -> IN
    // Product B: counted 5, system now 8 -> variance -3 -> OUT
    // Product C: counted 8, system now 8 -> variance 0 -> no movement
    getCurrentStockMock.mockResolvedValue([
      { productId: PRODUCT_A, warehouseId: WAREHOUSE_ID, quantity: 10 },
      { productId: PRODUCT_B, warehouseId: WAREHOUSE_ID, quantity: 8 },
      { productId: PRODUCT_C, warehouseId: WAREHOUSE_ID, quantity: 8 },
    ]);
    generateNumberMock.mockResolvedValue({ documentSequenceId: "seq-1", number: 1, formatted: "PHYVER-0001" });
    completeWithComputedItemsMock.mockResolvedValue(draftRow({ status: "COMPLETED", verificationNumber: "PHYVER-0001" }));

    const result = await physicalVerificationService.completePhysicalVerification(VERIFICATION_ID);

    expect(assertPermissionMock).toHaveBeenCalledWith(CURRENT_USER, "inventory", "approve");
    expect(ensureSequenceMock).toHaveBeenCalledWith(COMPANY_ID, FY_ID, "PHYSICAL_VERIFICATION");
    expect(getCurrentStockMock).toHaveBeenCalledWith(COMPANY_ID, { warehouseId: WAREHOUSE_ID }, FAKE_TX);

    expect(recordMovementsMock).toHaveBeenCalledTimes(1);
    const [, movementLines] = recordMovementsMock.mock.calls[0];
    expect(movementLines).toEqual([
      expect.objectContaining({ productId: PRODUCT_A, direction: "IN", quantity: 5, transactionType: "PHYSICAL_VERIFICATION" }),
      expect.objectContaining({ productId: PRODUCT_B, direction: "OUT", quantity: 3, transactionType: "PHYSICAL_VERIFICATION" }),
    ]);

    expect(completeWithComputedItemsMock).toHaveBeenCalledWith(
      FAKE_TX,
      VERIFICATION_ID,
      COMPANY_ID,
      expect.objectContaining({ formatted: "PHYVER-0001" }),
      expect.arrayContaining([
        { id: "item-1", systemQuantity: 10, varianceQuantity: 5 },
        { id: "item-2", systemQuantity: 8, varianceQuantity: -3 },
        { id: "item-3", systemQuantity: 8, varianceQuantity: 0 },
      ])
    );
    expect(result.status).toBe("COMPLETED");
  });

  it("treats a product/warehouse pair with no movement history as system quantity 0", async () => {
    findByIdMock
      .mockResolvedValueOnce(draftRow({ items: [draftRow().items[0]] }))
      .mockResolvedValueOnce(draftRow({ items: [draftRow().items[0]] }));
    getCurrentStockMock.mockResolvedValue([]);
    generateNumberMock.mockResolvedValue({ documentSequenceId: "seq-1", number: 1, formatted: "PHYVER-0001" });
    completeWithComputedItemsMock.mockResolvedValue(draftRow({ status: "COMPLETED" }));

    await physicalVerificationService.completePhysicalVerification(VERIFICATION_ID);

    expect(completeWithComputedItemsMock).toHaveBeenCalledWith(
      FAKE_TX,
      VERIFICATION_ID,
      COMPANY_ID,
      expect.anything(),
      [{ id: "item-1", systemQuantity: 0, varianceQuantity: 15 }]
    );
  });

  it("runs completion under Serializable isolation with bounded retry", async () => {
    findByIdMock.mockResolvedValueOnce(draftRow()).mockResolvedValueOnce(draftRow());
    getCurrentStockMock.mockResolvedValue([]);
    generateNumberMock.mockResolvedValue({ documentSequenceId: "seq-1", number: 1, formatted: "PHYVER-0001" });
    completeWithComputedItemsMock.mockResolvedValue(draftRow({ status: "COMPLETED" }));

    await physicalVerificationService.completePhysicalVerification(VERIFICATION_ID);

    expect(runInTransactionMock).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ isolationLevel: "Serializable", retryable: expect.any(Function), conflictMessage: expect.any(String) })
    );
  });

  it("rejects completing a non-DRAFT verification", async () => {
    findByIdMock.mockResolvedValue(draftRow({ status: "COMPLETED" }));

    await expect(physicalVerificationService.completePhysicalVerification(VERIFICATION_ID)).rejects.toThrow(AppError);
    expect(recordMovementsMock).not.toHaveBeenCalled();
  });

  it("rejects an inactive warehouse at completion time even though it passed the draft-time check", async () => {
    findByIdMock.mockResolvedValueOnce(draftRow()).mockResolvedValueOnce(draftRow());
    findWarehouseForCompletionMock.mockResolvedValue({ id: WAREHOUSE_ID, name: "Main Store", isActive: false });

    await expect(physicalVerificationService.completePhysicalVerification(VERIFICATION_ID)).rejects.toThrow("inactive");
    expect(getCurrentStockMock).not.toHaveBeenCalled();
    expect(completeWithComputedItemsMock).not.toHaveBeenCalled();
  });

  it("rejects an inactive product at completion time, including one whose variance is zero and never reaches recordMovements", async () => {
    findByIdMock.mockResolvedValueOnce(draftRow()).mockResolvedValueOnce(draftRow());
    findProductsForCompletionMock.mockResolvedValue([
      { id: PRODUCT_A, name: "Product A", isActive: true, productType: "TRADING" },
      { id: PRODUCT_B, name: "Product B", isActive: true, productType: "TRADING" },
      { id: PRODUCT_C, name: "Product C", isActive: false, productType: "TRADING" },
    ]);

    await expect(physicalVerificationService.completePhysicalVerification(VERIFICATION_ID)).rejects.toThrow(
      'Product "Product C" is inactive'
    );
    expect(recordMovementsMock).not.toHaveBeenCalled();
  });

  it("rejects a non-TRADING product at completion time", async () => {
    findByIdMock.mockResolvedValueOnce(draftRow()).mockResolvedValueOnce(draftRow());
    findProductsForCompletionMock.mockResolvedValue([
      { id: PRODUCT_A, name: "Product A", isActive: true, productType: "TRADING" },
      { id: PRODUCT_B, name: "Product B", isActive: true, productType: "TRADING" },
      { id: PRODUCT_C, name: "Product C", isActive: true, productType: "SERVICE" },
    ]);

    await expect(physicalVerificationService.completePhysicalVerification(VERIFICATION_ID)).rejects.toThrow(
      "not a trading product"
    );
    expect(recordMovementsMock).not.toHaveBeenCalled();
  });

  it("posts no movement at all when every line's variance is zero", async () => {
    findByIdMock.mockResolvedValueOnce(draftRow()).mockResolvedValueOnce(draftRow());
    getCurrentStockMock.mockResolvedValue([
      { productId: PRODUCT_A, warehouseId: WAREHOUSE_ID, quantity: 15 },
      { productId: PRODUCT_B, warehouseId: WAREHOUSE_ID, quantity: 5 },
      { productId: PRODUCT_C, warehouseId: WAREHOUSE_ID, quantity: 8 },
    ]);
    generateNumberMock.mockResolvedValue({ documentSequenceId: "seq-1", number: 1, formatted: "PHYVER-0001" });
    completeWithComputedItemsMock.mockResolvedValue(draftRow({ status: "COMPLETED" }));

    await physicalVerificationService.completePhysicalVerification(VERIFICATION_ID);

    expect(recordMovementsMock).not.toHaveBeenCalled();
    expect(completeWithComputedItemsMock).toHaveBeenCalled();
  });

  // An OUT-direction variance rejected by the Inventory Engine's own
  // availability gate (allowNegativeStock off) must roll back the whole
  // completion atomically — the engine's own rule is exercised by
  // inventory-engine.test.ts; this asserts the caller's atomicity.
  it("an injected insufficient-stock rejection from the Inventory Engine rolls back the whole completion", async () => {
    findByIdMock.mockResolvedValueOnce(draftRow()).mockResolvedValueOnce(draftRow());
    getCurrentStockMock.mockResolvedValue([
      { productId: PRODUCT_A, warehouseId: WAREHOUSE_ID, quantity: 10 },
      { productId: PRODUCT_B, warehouseId: WAREHOUSE_ID, quantity: 8 },
      { productId: PRODUCT_C, warehouseId: WAREHOUSE_ID, quantity: 8 },
    ]);
    generateNumberMock.mockResolvedValue({ documentSequenceId: "seq-1", number: 1, formatted: "PHYVER-0001" });
    recordMovementsMock.mockRejectedValueOnce(new AppError("Insufficient stock for this product at the selected warehouse."));

    await expect(physicalVerificationService.completePhysicalVerification(VERIFICATION_ID)).rejects.toThrow("Insufficient stock");
    expect(completeWithComputedItemsMock).not.toHaveBeenCalled();
  });

  it("rejects when the caller lacks the inventory/approve permission", async () => {
    assertPermissionMock.mockRejectedValue(new AppError("You do not have permission to approve inventory."));

    await expect(physicalVerificationService.completePhysicalVerification(VERIFICATION_ID)).rejects.toThrow(
      "You do not have permission to approve inventory."
    );
    expect(findByIdMock).not.toHaveBeenCalled();
  });
});

describe("physicalVerificationService.cancelPhysicalVerification", () => {
  it("cancels a DRAFT verification with no stock reversal", async () => {
    findByIdMock.mockResolvedValueOnce(draftRow()).mockResolvedValueOnce(draftRow({ status: "CANCELLED" }));
    updateStatusMock.mockResolvedValue(1);

    const result = await physicalVerificationService.cancelPhysicalVerification(VERIFICATION_ID);

    expect(assertPermissionMock).toHaveBeenCalledWith(CURRENT_USER, "inventory", "approve");
    expect(recordMovementsMock).not.toHaveBeenCalled();
    expect(updateStatusMock).toHaveBeenCalledWith(expect.anything(), VERIFICATION_ID, COMPANY_ID, ["DRAFT"], "CANCELLED");
    expect(result.status).toBe("CANCELLED");
  });

  it("rejects cancelling a COMPLETED verification — no cancellation path exists once completed", async () => {
    findByIdMock.mockResolvedValue(draftRow({ status: "COMPLETED" }));

    await expect(physicalVerificationService.cancelPhysicalVerification(VERIFICATION_ID)).rejects.toThrow(AppError);
    expect(updateStatusMock).not.toHaveBeenCalled();
  });

  it("rejects cancelling an already-cancelled verification", async () => {
    findByIdMock.mockResolvedValue(draftRow({ status: "CANCELLED" }));

    await expect(physicalVerificationService.cancelPhysicalVerification(VERIFICATION_ID)).rejects.toThrow(AppError);
    expect(updateStatusMock).not.toHaveBeenCalled();
  });
});

describe("physicalVerificationService.listPhysicalVerifications / getPhysicalVerification / listFormOptions / getWarehouseStockPreview", () => {
  it("gates listing on inventory/view and returns empty without a financial year", async () => {
    getCurrentFinancialYearMock.mockResolvedValue(null);

    const result = await physicalVerificationService.listPhysicalVerifications();

    expect(assertPermissionMock).toHaveBeenCalledWith(CURRENT_USER, "inventory", "view");
    expect(result).toEqual([]);
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it("scopes getPhysicalVerification to the caller's company", async () => {
    findByIdMock.mockResolvedValue(draftRow({ companyId: "other-company" }));

    const result = await physicalVerificationService.getPhysicalVerification(VERIFICATION_ID);

    expect(result).toBeNull();
  });

  it("returns the product/warehouse picker options plus a next-number preview", async () => {
    findSelectableProductsMock.mockResolvedValue([{ id: PRODUCT_A }]);
    findSelectableWarehousesMock.mockResolvedValue([{ id: WAREHOUSE_ID }]);
    previewNextNumberMock.mockResolvedValue({ number: 1, formatted: "PHYVER-0001" });

    const options = await physicalVerificationService.listFormOptions();

    expect(options).toEqual({ products: [{ id: PRODUCT_A }], warehouses: [{ id: WAREHOUSE_ID }], nextVerificationNumber: "PHYVER-0001" });
  });

  it("returns a productId-keyed stock preview for the given warehouse, unfiltered by tx", async () => {
    getCurrentStockMock.mockResolvedValue([
      { productId: PRODUCT_A, warehouseId: WAREHOUSE_ID, quantity: 12 },
      { productId: PRODUCT_B, warehouseId: WAREHOUSE_ID, quantity: 3 },
    ]);

    const preview = await physicalVerificationService.getWarehouseStockPreview(WAREHOUSE_ID);

    expect(getCurrentStockMock).toHaveBeenCalledWith(COMPANY_ID, { warehouseId: WAREHOUSE_ID });
    expect(preview).toEqual({ [PRODUCT_A]: 12, [PRODUCT_B]: 3 });
  });

  it("rejects a stock preview for a warehouse outside the caller's company", async () => {
    findWarehousesForLinesMock.mockResolvedValue([]);

    await expect(physicalVerificationService.getWarehouseStockPreview(WAREHOUSE_ID)).rejects.toThrow("Warehouse not found.");
  });
});
