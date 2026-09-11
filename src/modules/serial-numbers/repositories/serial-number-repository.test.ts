import { beforeEach, describe, expect, it, vi } from "vitest";

// Mirrors product-batch-repository.test.ts's convention: mock the
// module-level prisma client. create() routes through $transaction into
// FAKE_TX; the other, non-transactional reads call the top-level mocks
// directly.
const { FAKE_TX, serialNumberMock, stockTransactionMock, warehouseMock } = vi.hoisted(() => ({
  FAKE_TX: {
    product: { findUnique: vi.fn() },
    serialNumber: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
  serialNumberMock: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  stockTransactionMock: { findMany: vi.fn() },
  warehouseMock: { findMany: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: (fn: (tx: unknown) => unknown) => fn(FAKE_TX),
    serialNumber: serialNumberMock,
    stockTransaction: stockTransactionMock,
    warehouse: warehouseMock,
  },
}));

import { serialNumberRepository } from "@/modules/serial-numbers/repositories/serial-number-repository";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_COMPANY_ID = "99999999-9999-4999-8999-999999999999";
const PRODUCT_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_PRODUCT_ID = "88888888-8888-4888-8888-888888888888";
const SERIAL_ID = "33333333-3333-4333-8333-333333333333";
const WAREHOUSE_ID = "44444444-4444-4444-8444-444444444444";

beforeEach(() => {
  FAKE_TX.product.findUnique.mockReset();
  FAKE_TX.serialNumber.findUnique.mockReset();
  FAKE_TX.serialNumber.create.mockReset();
  FAKE_TX.serialNumber.update.mockReset();
  serialNumberMock.findMany.mockReset();
  serialNumberMock.findUnique.mockReset();
  serialNumberMock.update.mockReset();
  stockTransactionMock.findMany.mockReset().mockResolvedValue([]);
  warehouseMock.findMany.mockReset().mockResolvedValue([]);
});

describe("create", () => {
  it("rejects a product from another company", async () => {
    FAKE_TX.product.findUnique.mockResolvedValue({ id: PRODUCT_ID, companyId: OTHER_COMPANY_ID, isSerialTracked: true });

    await expect(
      serialNumberRepository.create(COMPANY_ID, { productId: PRODUCT_ID, serialValue: "SN-001" })
    ).rejects.toThrow("Product not found.");
  });

  it("rejects a product that is not serial-tracked", async () => {
    FAKE_TX.product.findUnique.mockResolvedValue({ id: PRODUCT_ID, companyId: COMPANY_ID, isSerialTracked: false });

    await expect(
      serialNumberRepository.create(COMPANY_ID, { productId: PRODUCT_ID, serialValue: "SN-001" })
    ).rejects.toThrow("not serial-tracked");
  });

  it("creates a serial for a serial-tracked product in the same company, with NO_MOVEMENTS status", async () => {
    FAKE_TX.product.findUnique.mockResolvedValue({ id: PRODUCT_ID, companyId: COMPANY_ID, isSerialTracked: true });
    FAKE_TX.serialNumber.create.mockResolvedValue({
      id: SERIAL_ID,
      companyId: COMPANY_ID,
      productId: PRODUCT_ID,
      serialValue: "SN-001",
      isActive: true,
    });

    const result = await serialNumberRepository.create(COMPANY_ID, { productId: PRODUCT_ID, serialValue: "SN-001" });

    expect(result.serialValue).toBe("SN-001");
    expect(result.status).toBe("NO_MOVEMENTS");
    expect(result.currentWarehouseId).toBeNull();
    expect(result.currentWarehouseName).toBeNull();
  });

  it("propagates a duplicate (companyId, productId, serialValue) as a unique-constraint error", async () => {
    FAKE_TX.product.findUnique.mockResolvedValue({ id: PRODUCT_ID, companyId: COMPANY_ID, isSerialTracked: true });
    const uniqueError = Object.assign(new Error("duplicate"), {
      code: "P2002",
      meta: { target: ["companyId", "productId", "serialValue"] },
    });
    FAKE_TX.serialNumber.create.mockRejectedValue(uniqueError);

    await expect(
      serialNumberRepository.create(COMPANY_ID, { productId: PRODUCT_ID, serialValue: "SN-001" })
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("two different products may share the same serialValue (no repository-level guard beyond the DB constraint)", async () => {
    FAKE_TX.product.findUnique.mockResolvedValue({ id: OTHER_PRODUCT_ID, companyId: COMPANY_ID, isSerialTracked: true });
    FAKE_TX.serialNumber.create.mockResolvedValue({
      id: "55555555-5555-4555-8555-555555555555",
      companyId: COMPANY_ID,
      productId: OTHER_PRODUCT_ID,
      serialValue: "SN-001",
      isActive: true,
    });

    await expect(
      serialNumberRepository.create(COMPANY_ID, { productId: OTHER_PRODUCT_ID, serialValue: "SN-001" })
    ).resolves.toBeDefined();
  });
});

describe("findManyWithStatus", () => {
  it("derives IN_STOCK and the receiving warehouse's name from the latest IN movement", async () => {
    serialNumberMock.findMany.mockResolvedValue([
      { id: SERIAL_ID, companyId: COMPANY_ID, productId: PRODUCT_ID, serialValue: "SN-001", isActive: true },
    ]);
    stockTransactionMock.findMany.mockResolvedValue([
      {
        serialId: SERIAL_ID,
        direction: "IN",
        transactionType: "PURCHASE",
        warehouseId: WAREHOUSE_ID,
        createdAt: new Date("2026-07-01T00:00:00.000Z"),
      },
    ]);
    warehouseMock.findMany.mockResolvedValue([{ id: WAREHOUSE_ID, name: "Main Store" }]);

    const result = await serialNumberRepository.findManyWithStatus(COMPANY_ID, PRODUCT_ID);

    expect(result).toEqual([
      expect.objectContaining({
        id: SERIAL_ID,
        status: "IN_STOCK",
        currentWarehouseId: WAREHOUSE_ID,
        currentWarehouseName: "Main Store",
      }),
    ]);
  });

  it("reports NO_MOVEMENTS and no warehouse for a serial with no transaction rows", async () => {
    serialNumberMock.findMany.mockResolvedValue([
      { id: SERIAL_ID, companyId: COMPANY_ID, productId: PRODUCT_ID, serialValue: "SN-001", isActive: true },
    ]);
    stockTransactionMock.findMany.mockResolvedValue([]);

    const result = await serialNumberRepository.findManyWithStatus(COMPANY_ID, PRODUCT_ID);

    expect(result).toEqual([
      expect.objectContaining({ status: "NO_MOVEMENTS", currentWarehouseId: null, currentWarehouseName: null }),
    ]);
  });

  it("keeps two serials of the same product independent", async () => {
    const serialB = "66666666-6666-4666-8666-666666666666";
    serialNumberMock.findMany.mockResolvedValue([
      { id: SERIAL_ID, companyId: COMPANY_ID, productId: PRODUCT_ID, serialValue: "SN-001", isActive: true },
      { id: serialB, companyId: COMPANY_ID, productId: PRODUCT_ID, serialValue: "SN-002", isActive: true },
    ]);
    stockTransactionMock.findMany.mockResolvedValue([
      {
        serialId: SERIAL_ID,
        direction: "IN",
        transactionType: "PURCHASE",
        warehouseId: WAREHOUSE_ID,
        createdAt: new Date("2026-07-01T00:00:00.000Z"),
      },
    ]);
    warehouseMock.findMany.mockResolvedValue([{ id: WAREHOUSE_ID, name: "Main Store" }]);

    const result = await serialNumberRepository.findManyWithStatus(COMPANY_ID, PRODUCT_ID);

    const byId = new Map(result.map((serial) => [serial.id, serial]));
    expect(byId.get(SERIAL_ID)?.status).toBe("IN_STOCK");
    expect(byId.get(serialB)?.status).toBe("NO_MOVEMENTS");
  });
});

describe("findByIdWithStatus", () => {
  it("returns null for an unknown id", async () => {
    serialNumberMock.findUnique.mockResolvedValue(null);
    expect(await serialNumberRepository.findByIdWithStatus(SERIAL_ID)).toBeNull();
  });

  it("computes status from the serial's own StockTransaction rows", async () => {
    serialNumberMock.findUnique.mockResolvedValue({
      id: SERIAL_ID,
      companyId: COMPANY_ID,
      productId: PRODUCT_ID,
      serialValue: "SN-001",
      isActive: true,
    });
    stockTransactionMock.findMany.mockResolvedValue([
      {
        direction: "OUT",
        transactionType: "SALES",
        warehouseId: WAREHOUSE_ID,
        createdAt: new Date("2026-07-01T00:00:00.000Z"),
      },
    ]);

    const result = await serialNumberRepository.findByIdWithStatus(SERIAL_ID);
    expect(result).toMatchObject({ status: "SOLD", currentWarehouseId: null });
  });
});

describe("setActive", () => {
  it("returns not_found for a cross-company serial", async () => {
    serialNumberMock.findUnique.mockResolvedValue({ id: SERIAL_ID, companyId: OTHER_COMPANY_ID });

    const result = await serialNumberRepository.setActive(SERIAL_ID, COMPANY_ID, false);
    expect(result.status).toBe("not_found");
  });

  it("deactivates a serial in the same company", async () => {
    serialNumberMock.findUnique.mockResolvedValue({ id: SERIAL_ID, companyId: COMPANY_ID, isActive: true });
    serialNumberMock.update.mockResolvedValue({
      id: SERIAL_ID,
      companyId: COMPANY_ID,
      productId: PRODUCT_ID,
      serialValue: "SN-001",
      isActive: false,
    });

    const result = await serialNumberRepository.setActive(SERIAL_ID, COMPANY_ID, false);
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.serialNumber.isActive).toBe(false);
    }
  });
});
