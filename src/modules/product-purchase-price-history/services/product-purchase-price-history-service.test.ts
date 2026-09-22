import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCurrentCompanyUserMock, assertPermissionMock, findCurrentPurchasePricesMock, applyPriceChangeMock, listHistoryForProductMock } =
  vi.hoisted(() => ({
    getCurrentCompanyUserMock: vi.fn(),
    assertPermissionMock: vi.fn(),
    findCurrentPurchasePricesMock: vi.fn(),
    applyPriceChangeMock: vi.fn(),
    listHistoryForProductMock: vi.fn(),
  }));

vi.mock("@/lib/current-user", () => ({
  getCurrentCompanyUser: getCurrentCompanyUserMock,
}));

vi.mock("@/lib/permissions", () => ({
  assertPermission: assertPermissionMock,
}));

vi.mock("@/modules/product-purchase-price-history/repositories/product-purchase-price-history-repository", () => ({
  productPurchasePriceHistoryRepository: {
    findCurrentPurchasePrices: findCurrentPurchasePricesMock,
    applyPriceChange: applyPriceChangeMock,
    listHistoryForProduct: listHistoryForProductMock,
  },
}));

import { productPurchasePriceHistoryService } from "@/modules/product-purchase-price-history/services/product-purchase-price-history-service";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const PRODUCT_A = "22222222-2222-4222-8222-222222222222";
const PRODUCT_B = "44444444-4444-4444-8444-444444444444";
const INVOICE_ID = "33333333-3333-4333-8333-333333333333";
const USER_ID = "55555555-5555-4555-8555-555555555555";
const FAKE_TX = {} as never;

const baseDocInput = {
  sourceDocumentType: "PURCHASE_INVOICE" as const,
  sourceDocumentId: INVOICE_ID,
  sourceDocumentNumber: "PI-0001",
  sourceDocumentDate: new Date("2026-09-22T00:00:00.000Z"),
  changedByUserId: USER_ID,
};

beforeEach(() => {
  getCurrentCompanyUserMock.mockReset();
  assertPermissionMock.mockReset();
  findCurrentPurchasePricesMock.mockReset();
  applyPriceChangeMock.mockReset();
  listHistoryForProductMock.mockReset();
});

describe("syncFromPurchaseDocument", () => {
  it("asserts no permission — it is a side effect of an already-authorized posting", async () => {
    findCurrentPurchasePricesMock.mockResolvedValue(new Map([[PRODUCT_A, 100]]));

    await productPurchasePriceHistoryService.syncFromPurchaseDocument(FAKE_TX, COMPANY_ID, {
      ...baseDocInput,
      lines: [{ productId: PRODUCT_A, lineNumber: 1, netUnitCost: 120 }],
    });

    expect(assertPermissionMock).not.toHaveBeenCalled();
    expect(getCurrentCompanyUserMock).not.toHaveBeenCalled();
  });

  it("applies the resolved update when it differs from the current price", async () => {
    findCurrentPurchasePricesMock.mockResolvedValue(new Map([[PRODUCT_A, 100]]));

    await productPurchasePriceHistoryService.syncFromPurchaseDocument(FAKE_TX, COMPANY_ID, {
      ...baseDocInput,
      lines: [{ productId: PRODUCT_A, lineNumber: 1, netUnitCost: 120 }],
    });

    expect(applyPriceChangeMock).toHaveBeenCalledWith(FAKE_TX, COMPANY_ID, {
      productId: PRODUCT_A,
      oldPurchasePrice: 100,
      newPurchasePrice: 120,
      ...baseDocInput,
    });
  });

  it("is a no-op — does not call the repository's write method — when the resolved value matches the current price", async () => {
    findCurrentPurchasePricesMock.mockResolvedValue(new Map([[PRODUCT_A, 120]]));

    await productPurchasePriceHistoryService.syncFromPurchaseDocument(FAKE_TX, COMPANY_ID, {
      ...baseDocInput,
      lines: [{ productId: PRODUCT_A, lineNumber: 1, netUnitCost: 120 }],
    });

    expect(applyPriceChangeMock).not.toHaveBeenCalled();
  });

  it("treats a first-ever price (current price null) as a real change, not a no-op", async () => {
    findCurrentPurchasePricesMock.mockResolvedValue(new Map([[PRODUCT_A, null]]));

    await productPurchasePriceHistoryService.syncFromPurchaseDocument(FAKE_TX, COMPANY_ID, {
      ...baseDocInput,
      lines: [{ productId: PRODUCT_A, lineNumber: 1, netUnitCost: 120 }],
    });

    expect(applyPriceChangeMock).toHaveBeenCalledWith(
      FAKE_TX,
      COMPANY_ID,
      expect.objectContaining({ oldPurchasePrice: null, newPurchasePrice: 120 })
    );
  });

  it("silently skips a product missing from the current-price map (cross-company/stale reference)", async () => {
    findCurrentPurchasePricesMock.mockResolvedValue(new Map());

    await productPurchasePriceHistoryService.syncFromPurchaseDocument(FAKE_TX, COMPANY_ID, {
      ...baseDocInput,
      lines: [{ productId: PRODUCT_A, lineNumber: 1, netUnitCost: 120 }],
    });

    expect(applyPriceChangeMock).not.toHaveBeenCalled();
  });

  it("does nothing at all — never reads current prices — when every line is zero/negative cost", async () => {
    await productPurchasePriceHistoryService.syncFromPurchaseDocument(FAKE_TX, COMPANY_ID, {
      ...baseDocInput,
      lines: [{ productId: PRODUCT_A, lineNumber: 1, netUnitCost: 0 }],
    });

    expect(findCurrentPurchasePricesMock).not.toHaveBeenCalled();
    expect(applyPriceChangeMock).not.toHaveBeenCalled();
  });

  it("applies one change per distinct product, skipping only the no-op one", async () => {
    findCurrentPurchasePricesMock.mockResolvedValue(
      new Map([
        [PRODUCT_A, 100],
        [PRODUCT_B, 50],
      ])
    );

    await productPurchasePriceHistoryService.syncFromPurchaseDocument(FAKE_TX, COMPANY_ID, {
      ...baseDocInput,
      lines: [
        { productId: PRODUCT_A, lineNumber: 1, netUnitCost: 100 },
        { productId: PRODUCT_B, lineNumber: 2, netUnitCost: 60 },
      ],
    });

    expect(applyPriceChangeMock).toHaveBeenCalledTimes(1);
    expect(applyPriceChangeMock).toHaveBeenCalledWith(
      FAKE_TX,
      COMPANY_ID,
      expect.objectContaining({ productId: PRODUCT_B, newPurchasePrice: 60 })
    );
  });
});

describe("listHistoryForProduct", () => {
  it("gates on masters:view and delegates to the repository", async () => {
    getCurrentCompanyUserMock.mockResolvedValue({ id: USER_ID, companyId: COMPANY_ID });
    listHistoryForProductMock.mockResolvedValue([]);

    await productPurchasePriceHistoryService.listHistoryForProduct(PRODUCT_A);

    expect(assertPermissionMock).toHaveBeenCalledWith({ id: USER_ID, companyId: COMPANY_ID }, "masters", "view");
    expect(listHistoryForProductMock).toHaveBeenCalledWith(COMPANY_ID, PRODUCT_A);
  });
});
