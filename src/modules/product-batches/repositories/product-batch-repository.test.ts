import { beforeEach, describe, expect, it, vi } from "vitest";

// Mirrors product-repository.test.ts's convention: mock the module-level
// prisma client. Transactional methods (create/update) route through
// $transaction into FAKE_TX; non-transactional reads (findManyWithStock,
// findById, setActive) call the top-level mocks directly.
const { FAKE_TX, productBatchMock, stockTransactionMock } = vi.hoisted(() => ({
  FAKE_TX: {
    product: { findUnique: vi.fn() },
    productBatch: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    stockTransaction: { findFirst: vi.fn(), groupBy: vi.fn() },
  },
  productBatchMock: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  stockTransactionMock: { groupBy: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: (fn: (tx: unknown) => unknown) => fn(FAKE_TX),
    productBatch: productBatchMock,
    stockTransaction: stockTransactionMock,
  },
}));

import { productBatchRepository } from "@/modules/product-batches/repositories/product-batch-repository";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_COMPANY_ID = "99999999-9999-4999-8999-999999999999";
const PRODUCT_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_PRODUCT_ID = "88888888-8888-4888-8888-888888888888";
const BATCH_ID = "33333333-3333-4333-8333-333333333333";

function decimal(value: number) {
  return { toNumber: () => value };
}

beforeEach(() => {
  FAKE_TX.product.findUnique.mockReset();
  FAKE_TX.productBatch.findUnique.mockReset();
  FAKE_TX.productBatch.create.mockReset();
  FAKE_TX.productBatch.update.mockReset();
  FAKE_TX.stockTransaction.findFirst.mockReset();
  FAKE_TX.stockTransaction.groupBy.mockReset();
  productBatchMock.findMany.mockReset();
  productBatchMock.findUnique.mockReset();
  productBatchMock.update.mockReset();
  stockTransactionMock.groupBy.mockReset();
});

describe("create", () => {
  it("rejects a product from another company", async () => {
    FAKE_TX.product.findUnique.mockResolvedValue({ id: PRODUCT_ID, companyId: OTHER_COMPANY_ID, isBatchTracked: true });

    await expect(
      productBatchRepository.create(COMPANY_ID, { productId: PRODUCT_ID, batchNumber: "B-001" })
    ).rejects.toThrow("Product not found.");
  });

  it("rejects a product that is not batch-tracked", async () => {
    FAKE_TX.product.findUnique.mockResolvedValue({ id: PRODUCT_ID, companyId: COMPANY_ID, isBatchTracked: false });

    await expect(
      productBatchRepository.create(COMPANY_ID, { productId: PRODUCT_ID, batchNumber: "B-001" })
    ).rejects.toThrow("not batch-tracked");
  });

  it("creates a batch for a batch-tracked product in the same company", async () => {
    FAKE_TX.product.findUnique.mockResolvedValue({ id: PRODUCT_ID, companyId: COMPANY_ID, isBatchTracked: true });
    FAKE_TX.productBatch.create.mockResolvedValue({
      id: BATCH_ID,
      companyId: COMPANY_ID,
      productId: PRODUCT_ID,
      batchNumber: "B-001",
      manufactureDate: null,
      expiryDate: null,
      isActive: true,
    });

    const result = await productBatchRepository.create(COMPANY_ID, { productId: PRODUCT_ID, batchNumber: "B-001" });

    expect(result.batchNumber).toBe("B-001");
    expect(result.currentStock).toBe(0);
    expect(result.hasMovements).toBe(false);
  });

  it("propagates a duplicate (companyId, productId, batchNumber) as a unique-constraint error", async () => {
    FAKE_TX.product.findUnique.mockResolvedValue({ id: PRODUCT_ID, companyId: COMPANY_ID, isBatchTracked: true });
    const uniqueError = Object.assign(new Error("duplicate"), {
      code: "P2002",
      meta: { target: ["companyId", "productId", "batchNumber"] },
    });
    FAKE_TX.productBatch.create.mockRejectedValue(uniqueError);

    await expect(
      productBatchRepository.create(COMPANY_ID, { productId: PRODUCT_ID, batchNumber: "B-001" })
    ).rejects.toMatchObject({ code: "P2002" });
  });
});

describe("update", () => {
  it("returns not_found for a cross-company batch", async () => {
    FAKE_TX.productBatch.findUnique.mockResolvedValue({ id: BATCH_ID, companyId: OTHER_COMPANY_ID });

    const result = await productBatchRepository.update(BATCH_ID, COMPANY_ID, { batchNumber: "B-002" });
    expect(result.status).toBe("not_found");
  });

  it("rejects an update once any StockTransaction references the batch", async () => {
    FAKE_TX.productBatch.findUnique.mockResolvedValue({ id: BATCH_ID, companyId: COMPANY_ID, productId: PRODUCT_ID });
    FAKE_TX.stockTransaction.findFirst.mockResolvedValue({ id: "txn-1" });

    const result = await productBatchRepository.update(BATCH_ID, COMPANY_ID, { batchNumber: "B-002" });
    expect(result.status).toBe("has_movements");
    expect(FAKE_TX.productBatch.update).not.toHaveBeenCalled();
  });

  it("allows an update while no movement exists (batch-number typo correction)", async () => {
    FAKE_TX.productBatch.findUnique.mockResolvedValue({ id: BATCH_ID, companyId: COMPANY_ID, productId: PRODUCT_ID });
    FAKE_TX.stockTransaction.findFirst.mockResolvedValue(null);
    FAKE_TX.productBatch.update.mockResolvedValue({
      id: BATCH_ID,
      companyId: COMPANY_ID,
      productId: PRODUCT_ID,
      batchNumber: "B-002",
      manufactureDate: null,
      expiryDate: null,
      isActive: true,
    });

    const result = await productBatchRepository.update(BATCH_ID, COMPANY_ID, { batchNumber: "B-002" });
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.batch.batchNumber).toBe("B-002");
    }
  });
});

describe("findManyWithStock", () => {
  it("joins aggregated stock with one groupBy call, normalizing Decimal to number", async () => {
    productBatchMock.findMany.mockResolvedValue([
      { id: BATCH_ID, companyId: COMPANY_ID, productId: PRODUCT_ID, batchNumber: "B-001", manufactureDate: null, expiryDate: null, isActive: true },
    ]);
    stockTransactionMock.groupBy.mockResolvedValue([
      { batchId: BATCH_ID, direction: "IN", _sum: { quantity: decimal(10) } },
      { batchId: BATCH_ID, direction: "OUT", _sum: { quantity: decimal(4) } },
    ]);

    const result = await productBatchRepository.findManyWithStock(COMPANY_ID, PRODUCT_ID);

    expect(stockTransactionMock.groupBy).toHaveBeenCalledTimes(1);
    expect(result).toEqual([
      expect.objectContaining({ id: BATCH_ID, currentStock: 6, hasMovements: true }),
    ]);
  });

  it("reports zero stock and no movements for a batch with no transaction rows", async () => {
    productBatchMock.findMany.mockResolvedValue([
      { id: BATCH_ID, companyId: COMPANY_ID, productId: PRODUCT_ID, batchNumber: "B-001", manufactureDate: null, expiryDate: null, isActive: true },
    ]);
    stockTransactionMock.groupBy.mockResolvedValue([]);

    const result = await productBatchRepository.findManyWithStock(COMPANY_ID, PRODUCT_ID);

    expect(result).toEqual([expect.objectContaining({ currentStock: 0, hasMovements: false })]);
  });

  it("keeps two batches of the same product independent", async () => {
    const batchB = "44444444-4444-4444-8444-444444444444";
    productBatchMock.findMany.mockResolvedValue([
      { id: BATCH_ID, companyId: COMPANY_ID, productId: PRODUCT_ID, batchNumber: "B-001", manufactureDate: null, expiryDate: null, isActive: true },
      { id: batchB, companyId: COMPANY_ID, productId: PRODUCT_ID, batchNumber: "B-002", manufactureDate: null, expiryDate: null, isActive: true },
    ]);
    stockTransactionMock.groupBy.mockResolvedValue([
      { batchId: BATCH_ID, direction: "IN", _sum: { quantity: decimal(10) } },
    ]);

    const result = await productBatchRepository.findManyWithStock(COMPANY_ID, PRODUCT_ID);

    const byId = new Map(result.map((batch) => [batch.id, batch]));
    expect(byId.get(BATCH_ID)?.currentStock).toBe(10);
    expect(byId.get(batchB)?.currentStock).toBe(0);
  });
});

describe("findByIdWithStock", () => {
  it("returns null for an unknown id", async () => {
    productBatchMock.findUnique.mockResolvedValue(null);
    expect(await productBatchRepository.findByIdWithStock(BATCH_ID)).toBeNull();
  });

  it("computes currentStock and hasMovements from the batch's own StockTransaction rows", async () => {
    productBatchMock.findUnique.mockResolvedValue({
      id: BATCH_ID,
      companyId: COMPANY_ID,
      productId: PRODUCT_ID,
      batchNumber: "B-001",
      manufactureDate: null,
      expiryDate: null,
      isActive: true,
    });
    stockTransactionMock.groupBy.mockResolvedValue([
      { direction: "IN", _sum: { quantity: decimal(10) } },
      { direction: "OUT", _sum: { quantity: decimal(3) } },
    ]);

    const result = await productBatchRepository.findByIdWithStock(BATCH_ID);
    expect(result).toMatchObject({ currentStock: 7, hasMovements: true });
  });
});

describe("duplicate batchNumber across different products", () => {
  it("two different products may share the same batchNumber (no repository-level guard beyond the DB constraint)", async () => {
    FAKE_TX.product.findUnique.mockResolvedValue({ id: OTHER_PRODUCT_ID, companyId: COMPANY_ID, isBatchTracked: true });
    FAKE_TX.productBatch.create.mockResolvedValue({
      id: "55555555-5555-4555-8555-555555555555",
      companyId: COMPANY_ID,
      productId: OTHER_PRODUCT_ID,
      batchNumber: "B-001",
      manufactureDate: null,
      expiryDate: null,
      isActive: true,
    });

    await expect(
      productBatchRepository.create(COMPANY_ID, { productId: OTHER_PRODUCT_ID, batchNumber: "B-001" })
    ).resolves.toBeDefined();
  });
});
