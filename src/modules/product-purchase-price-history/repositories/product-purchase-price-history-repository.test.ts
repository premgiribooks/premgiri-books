import { beforeEach, describe, expect, it, vi } from "vitest";

const { productPurchasePriceHistoryMock } = vi.hoisted(() => ({
  productPurchasePriceHistoryMock: { findMany: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    productPurchasePriceHistory: productPurchasePriceHistoryMock,
  },
}));

import { productPurchasePriceHistoryRepository } from "@/modules/product-purchase-price-history/repositories/product-purchase-price-history-repository";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_COMPANY_ID = "99999999-9999-4999-8999-999999999999";
const PRODUCT_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_PRODUCT_ID = "44444444-4444-4444-8444-444444444444";
const INVOICE_ID = "33333333-3333-4333-8333-333333333333";
const USER_ID = "55555555-5555-4555-8555-555555555555";

function decimal(value: number) {
  return { toNumber: () => value };
}

function fakeTx() {
  return {
    product: { findMany: vi.fn(), updateMany: vi.fn() },
    productPurchasePriceHistory: { create: vi.fn() },
  };
}

beforeEach(() => {
  productPurchasePriceHistoryMock.findMany.mockReset();
});

describe("findCurrentPurchasePrices", () => {
  it("returns an empty map for empty input without touching the database", async () => {
    const tx = fakeTx();
    const result = await productPurchasePriceHistoryRepository.findCurrentPurchasePrices(
      tx as never,
      COMPANY_ID,
      []
    );
    expect(result.size).toBe(0);
    expect(tx.product.findMany).not.toHaveBeenCalled();
  });

  it("maps productId to its current purchasePrice, null when unset", async () => {
    const tx = fakeTx();
    tx.product.findMany.mockResolvedValue([
      { id: PRODUCT_ID, purchasePrice: decimal(100) },
      { id: OTHER_PRODUCT_ID, purchasePrice: null },
    ]);

    const result = await productPurchasePriceHistoryRepository.findCurrentPurchasePrices(tx as never, COMPANY_ID, [
      PRODUCT_ID,
      OTHER_PRODUCT_ID,
    ]);

    expect(result.get(PRODUCT_ID)).toBe(100);
    expect(result.get(OTHER_PRODUCT_ID)).toBeNull();
    expect(tx.product.findMany).toHaveBeenCalledWith({
      where: { id: { in: [PRODUCT_ID, OTHER_PRODUCT_ID] }, companyId: COMPANY_ID },
      select: { id: true, purchasePrice: true },
    });
  });
});

describe("applyPriceChange", () => {
  const baseInput = {
    productId: PRODUCT_ID,
    oldPurchasePrice: 100,
    newPurchasePrice: 120,
    sourceDocumentType: "PURCHASE_INVOICE" as const,
    sourceDocumentId: INVOICE_ID,
    sourceDocumentNumber: "PI-0001",
    sourceDocumentDate: new Date("2026-09-22T00:00:00.000Z"),
    changedByUserId: USER_ID,
  };

  it("updates the product and inserts a history row on the same tx client", async () => {
    const tx = fakeTx();
    tx.product.updateMany.mockResolvedValue({ count: 1 });

    await productPurchasePriceHistoryRepository.applyPriceChange(tx as never, COMPANY_ID, baseInput);

    expect(tx.product.updateMany).toHaveBeenCalledWith({
      where: { id: PRODUCT_ID, companyId: COMPANY_ID },
      data: { purchasePrice: 120 },
    });
    expect(tx.productPurchasePriceHistory.create).toHaveBeenCalledWith({
      data: {
        companyId: COMPANY_ID,
        productId: PRODUCT_ID,
        oldPurchasePrice: 100,
        newPurchasePrice: 120,
        sourceDocumentType: "PURCHASE_INVOICE",
        sourceDocumentId: INVOICE_ID,
        sourceDocumentNumber: "PI-0001",
        sourceDocumentDate: baseInput.sourceDocumentDate,
        changedByUserId: USER_ID,
      },
    });
  });

  it("stores a null oldPurchasePrice for a product that never had one", async () => {
    const tx = fakeTx();
    tx.product.updateMany.mockResolvedValue({ count: 1 });

    await productPurchasePriceHistoryRepository.applyPriceChange(tx as never, COMPANY_ID, {
      ...baseInput,
      oldPurchasePrice: null,
    });

    expect(tx.productPurchasePriceHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ oldPurchasePrice: null }) })
    );
  });

  it("silently skips a product that does not belong to this company — updates nothing, inserts nothing", async () => {
    const tx = fakeTx();
    tx.product.updateMany.mockResolvedValue({ count: 0 });

    await productPurchasePriceHistoryRepository.applyPriceChange(tx as never, OTHER_COMPANY_ID, baseInput);

    expect(tx.product.updateMany).toHaveBeenCalledWith({
      where: { id: PRODUCT_ID, companyId: OTHER_COMPANY_ID },
      data: { purchasePrice: 120 },
    });
    expect(tx.productPurchasePriceHistory.create).not.toHaveBeenCalled();
  });
});

describe("listHistoryForProduct", () => {
  it("filters by companyId and productId, orders newest first, and normalizes Decimals", async () => {
    productPurchasePriceHistoryMock.findMany.mockResolvedValue([
      {
        id: "h1",
        productId: PRODUCT_ID,
        oldPurchasePrice: decimal(100),
        newPurchasePrice: decimal(120),
        sourceDocumentType: "PURCHASE_INVOICE",
        sourceDocumentId: INVOICE_ID,
        sourceDocumentNumber: "PI-0001",
        sourceDocumentDate: new Date("2026-09-22T00:00:00.000Z"),
        changedByUserId: USER_ID,
        changedBy: { fullName: "Asha Patel" },
        createdAt: new Date("2026-09-22T10:00:00.000Z"),
      },
      {
        id: "h0",
        productId: PRODUCT_ID,
        oldPurchasePrice: null,
        newPurchasePrice: decimal(100),
        sourceDocumentType: "PURCHASE_ORDER",
        sourceDocumentId: "order-1",
        sourceDocumentNumber: "PO-0001",
        sourceDocumentDate: new Date("2026-09-10T00:00:00.000Z"),
        changedByUserId: null,
        changedBy: null,
        createdAt: new Date("2026-09-10T10:00:00.000Z"),
      },
    ]);

    const rows = await productPurchasePriceHistoryRepository.listHistoryForProduct(COMPANY_ID, PRODUCT_ID);

    expect(productPurchasePriceHistoryMock.findMany).toHaveBeenCalledWith({
      where: { companyId: COMPANY_ID, productId: PRODUCT_ID },
      orderBy: { createdAt: "desc" },
      include: { changedBy: { select: { fullName: true } } },
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ id: "h1", oldPurchasePrice: 100, newPurchasePrice: 120, changedByUserName: "Asha Patel" });
    expect(rows[1]).toMatchObject({ id: "h0", oldPurchasePrice: null, newPurchasePrice: 100, changedByUserName: null });
  });
});
