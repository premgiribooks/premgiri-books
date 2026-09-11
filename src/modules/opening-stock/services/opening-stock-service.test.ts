import { describe, expect, it, vi, beforeEach } from "vitest";

// Mirrors inventory-engine.test.ts's convention — mock the module-boundary
// repository this service calls through, the Inventory Engine it delegates
// the actual write to, and the shared transaction/session/permission
// boundaries, so runInTransaction's own-transaction path runs the callback
// against a fake tx instead of a real database, and the Serializable-retry
// options passed to it can be asserted directly.
const {
  existingTransactionPairsMock,
  findProductsForMovementMock,
  findWarehousesForMovementMock,
  findOpeningStockEntriesMock,
  findOpeningStockEligibleProductsMock,
  findActiveWarehousesMock,
  recordMovementsMock,
  getCurrentCompanyUserMock,
  assertPermissionMock,
  runInTransactionMock,
  FAKE_TX,
} = vi.hoisted(() => ({
  existingTransactionPairsMock: vi.fn(),
  findProductsForMovementMock: vi.fn(),
  findWarehousesForMovementMock: vi.fn(),
  findOpeningStockEntriesMock: vi.fn(),
  findOpeningStockEligibleProductsMock: vi.fn(),
  findActiveWarehousesMock: vi.fn(),
  recordMovementsMock: vi.fn(),
  getCurrentCompanyUserMock: vi.fn(),
  assertPermissionMock: vi.fn(),
  runInTransactionMock: vi.fn(),
  FAKE_TX: { marker: "fake-tx" },
}));

vi.mock("@/modules/stock-transactions/repositories/stock-transaction-repository", () => ({
  stockTransactionRepository: {
    existingTransactionPairs: existingTransactionPairsMock,
    findProductsForMovement: findProductsForMovementMock,
    findWarehousesForMovement: findWarehousesForMovementMock,
    findOpeningStockEntries: findOpeningStockEntriesMock,
    findOpeningStockEligibleProducts: findOpeningStockEligibleProductsMock,
    findActiveWarehouses: findActiveWarehousesMock,
  },
}));

vi.mock("@/engines/inventory/inventory-engine", () => ({
  inventoryEngine: { recordMovements: recordMovementsMock },
}));

vi.mock("@/lib/current-user", () => ({ getCurrentCompanyUser: getCurrentCompanyUserMock }));
vi.mock("@/lib/permissions", () => ({ assertPermission: assertPermissionMock }));
vi.mock("@/lib/transaction", () => ({ runInTransaction: runInTransactionMock }));

import { AppError } from "@/lib/app-error";
import { openingStockService } from "@/modules/opening-stock/services/opening-stock-service";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const PRODUCT_A = "33333333-3333-4333-8333-333333333333";
const PRODUCT_B = "88888888-8888-4888-8888-888888888888";
const WAREHOUSE_A = "44444444-4444-4444-8444-444444444444";
const WAREHOUSE_B = "99999999-9999-4999-8999-999999999999";

const CURRENT_USER = { id: USER_ID, companyId: COMPANY_ID, role: "Owner", userType: "COMPANY" as const, username: "owner", fullName: "Owner" };

const PRODUCT_A_ROW = { id: PRODUCT_A, companyId: COMPANY_ID, name: "Widget", isActive: true, productType: "TRADING" as const, unit: { decimalPlaces: 2 } };
const PRODUCT_B_ROW = { id: PRODUCT_B, companyId: COMPANY_ID, name: "Gadget", isActive: true, productType: "TRADING" as const, unit: { decimalPlaces: 0 } };
const WAREHOUSE_A_ROW = { id: WAREHOUSE_A, companyId: COMPANY_ID, name: "Main Store", isActive: true };
const WAREHOUSE_B_ROW = { id: WAREHOUSE_B, companyId: COMPANY_ID, name: "Branch Store", isActive: true };

function openingStockLine(overrides: Record<string, unknown> = {}) {
  return {
    productId: PRODUCT_A,
    warehouseId: WAREHOUSE_A,
    quantity: 10,
    transactionDate: "2024-01-01",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentCompanyUserMock.mockResolvedValue(CURRENT_USER);
  assertPermissionMock.mockResolvedValue(undefined);
  runInTransactionMock.mockImplementation((fn: (tx: unknown) => unknown) => fn(FAKE_TX));
  findProductsForMovementMock.mockResolvedValue([PRODUCT_A_ROW, PRODUCT_B_ROW]);
  findWarehousesForMovementMock.mockResolvedValue([WAREHOUSE_A_ROW, WAREHOUSE_B_ROW]);
  existingTransactionPairsMock.mockResolvedValue(new Set());
  recordMovementsMock.mockResolvedValue([{ id: "created-1" }]);
});

describe("openingStockService.recordOpeningStock", () => {
  it("records opening stock for a fresh (product, warehouse) pair", async () => {
    const result = await openingStockService.recordOpeningStock({ lines: [openingStockLine()] });

    expect(result).toEqual([{ id: "created-1" }]);
    expect(assertPermissionMock).toHaveBeenCalledWith(CURRENT_USER, "inventory", "create");
    expect(recordMovementsMock).toHaveBeenCalledWith(
      COMPANY_ID,
      [
        expect.objectContaining({
          productId: PRODUCT_A,
          warehouseId: WAREHOUSE_A,
          transactionType: "OPENING_STOCK",
          direction: "IN",
          quantity: 10,
        }),
      ],
      FAKE_TX
    );
  });

  it("rejects a second Opening Stock entry for a pair that already has an OPENING_STOCK transaction", async () => {
    existingTransactionPairsMock.mockResolvedValue(new Set([`${PRODUCT_A}::${WAREHOUSE_A}`]));

    await expect(openingStockService.recordOpeningStock({ lines: [openingStockLine()] })).rejects.toThrow(AppError);
    expect(recordMovementsMock).not.toHaveBeenCalled();
  });

  // The uniqueness check is "no StockTransaction of any type exists yet for
  // this pair", not merely "no prior OPENING_STOCK row" — a stray
  // non-OPENING_STOCK movement (e.g. ADJUSTMENT) must also block a later
  // Opening Stock entry (46-opening-stock.md's Data Model). The mocked
  // existingTransactionPairs return value is type-agnostic, exactly
  // mirroring what the real query (which matches on the pair regardless of
  // transactionType) would return.
  it("rejects an Opening Stock entry when a non-OPENING_STOCK transaction already exists for the pair", async () => {
    existingTransactionPairsMock.mockResolvedValue(new Set([`${PRODUCT_A}::${WAREHOUSE_A}`]));

    await expect(openingStockService.recordOpeningStock({ lines: [openingStockLine()] })).rejects.toThrow(
      /already has stock movement recorded/
    );
    expect(recordMovementsMock).not.toHaveBeenCalled();
  });

  it("rejects the whole batch when only one of several lines has an existing transaction (all-or-nothing)", async () => {
    existingTransactionPairsMock.mockResolvedValue(new Set([`${PRODUCT_B}::${WAREHOUSE_B}`]));

    await expect(
      openingStockService.recordOpeningStock({
        lines: [openingStockLine(), openingStockLine({ productId: PRODUCT_B, warehouseId: WAREHOUSE_B })],
      })
    ).rejects.toThrow(AppError);
    expect(recordMovementsMock).not.toHaveBeenCalled();
  });

  it("rejects two lines that submit the same (product, warehouse) pair within one batch", async () => {
    await expect(
      openingStockService.recordOpeningStock({
        lines: [openingStockLine(), openingStockLine({ quantity: 5 })],
      })
    ).rejects.toThrow();
    expect(runInTransactionMock).not.toHaveBeenCalled();
  });

  it("runs the uniqueness check and insert under Serializable isolation with bounded retry", async () => {
    await openingStockService.recordOpeningStock({ lines: [openingStockLine()] });

    expect(runInTransactionMock).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        isolationLevel: "Serializable",
        retryable: expect.any(Function),
        conflictMessage: expect.any(String),
      })
    );
  });

  it("rejects when the caller lacks the inventory/create permission", async () => {
    assertPermissionMock.mockRejectedValue(new AppError("You do not have permission to create inventory."));

    await expect(openingStockService.recordOpeningStock({ lines: [openingStockLine()] })).rejects.toThrow(
      "You do not have permission to create inventory."
    );
    expect(runInTransactionMock).not.toHaveBeenCalled();
  });
});

describe("openingStockService.listOpeningStockEntries", () => {
  it("gates on inventory/view and scopes the query to the caller's company", async () => {
    findOpeningStockEntriesMock.mockResolvedValue([]);

    await openingStockService.listOpeningStockEntries({ search: "widget" });

    expect(assertPermissionMock).toHaveBeenCalledWith(CURRENT_USER, "inventory", "view");
    expect(findOpeningStockEntriesMock).toHaveBeenCalledWith(COMPANY_ID, { search: "widget" });
  });
});

describe("openingStockService.listFormOptions", () => {
  it("gates on inventory/view and returns the product/warehouse picker options", async () => {
    findOpeningStockEligibleProductsMock.mockResolvedValue([{ id: PRODUCT_A }]);
    findActiveWarehousesMock.mockResolvedValue([{ id: WAREHOUSE_A }]);

    const options = await openingStockService.listFormOptions();

    expect(assertPermissionMock).toHaveBeenCalledWith(CURRENT_USER, "inventory", "view");
    expect(options).toEqual({ products: [{ id: PRODUCT_A }], warehouses: [{ id: WAREHOUSE_A }] });
  });
});
