import { describe, expect, it } from "vitest";

import {
  buildCurrentStockReport,
  buildLowStockReport,
  buildStockLedgerReport,
  buildStockValuationReport,
} from "@/engines/reporting/inventory-reports";
import type { CurrentStockRow, StockLedgerResult, StockValuationResult } from "@/engines/inventory/types";
import type { InventoryReportProductOption, InventoryReportWarehouseOption } from "@/types/inventory-report";

const PRODUCT_A: InventoryReportProductOption = {
  id: "prod-a",
  name: "Widget",
  productCode: "WID-1",
  unitName: "Nos",
  isActive: true,
  minStockLevel: 10,
};
const PRODUCT_B: InventoryReportProductOption = {
  id: "prod-b",
  name: "Gadget",
  productCode: "GAD-1",
  unitName: "Nos",
  isActive: true,
  minStockLevel: null,
};
const PRODUCT_INACTIVE: InventoryReportProductOption = {
  id: "prod-c",
  name: "Discontinued Widget",
  productCode: "DIS-1",
  unitName: "Nos",
  isActive: false,
  minStockLevel: 5,
};

const WAREHOUSE_1: InventoryReportWarehouseOption = { id: "wh-1", name: "Main Warehouse" };
const WAREHOUSE_2: InventoryReportWarehouseOption = { id: "wh-2", name: "Branch Warehouse" };

function stockRow(overrides: Partial<CurrentStockRow> = {}): CurrentStockRow {
  return { productId: PRODUCT_A.id, warehouseId: WAREHOUSE_1.id, quantity: 25, ...overrides };
}

describe("buildCurrentStockReport", () => {
  it("joins getCurrentStock's rows to product/warehouse display names", () => {
    const report = buildCurrentStockReport([stockRow()], [PRODUCT_A, PRODUCT_B], [WAREHOUSE_1, WAREHOUSE_2], {
      includeZeroStock: false,
    });
    expect(report.rows).toEqual([
      {
        productId: "prod-a",
        productName: "Widget",
        productCode: "WID-1",
        unitName: "Nos",
        warehouseId: "wh-1",
        warehouseName: "Main Warehouse",
        quantity: 25,
      },
    ]);
  });

  it("omits every active product with no movement when includeZeroStock is off", () => {
    const report = buildCurrentStockReport([stockRow()], [PRODUCT_A, PRODUCT_B], [WAREHOUSE_1, WAREHOUSE_2], {
      includeZeroStock: false,
    });
    expect(report.rows.map((row) => row.productId)).toEqual(["prod-a"]);
  });

  it("adds a zero-quantity row for every active product with no movement when includeZeroStock is on, excluding inactive products", () => {
    const report = buildCurrentStockReport(
      [stockRow()],
      [PRODUCT_A, PRODUCT_B, PRODUCT_INACTIVE],
      [WAREHOUSE_1, WAREHOUSE_2],
      { includeZeroStock: true }
    );
    const gadgetRow = report.rows.find((row) => row.productId === "prod-b");
    expect(gadgetRow).toMatchObject({ quantity: 0, warehouseId: null, warehouseName: null });
    expect(report.rows.some((row) => row.productId === "prod-c")).toBe(false);
  });

  it("attributes an added zero-stock row to the filtered warehouse when one is selected", () => {
    const report = buildCurrentStockReport([], [PRODUCT_A], [WAREHOUSE_1], {
      warehouseId: "wh-1",
      includeZeroStock: true,
    });
    expect(report.rows).toEqual([
      {
        productId: "prod-a",
        productName: "Widget",
        productCode: "WID-1",
        unitName: "Nos",
        warehouseId: "wh-1",
        warehouseName: "Main Warehouse",
        quantity: 0,
      },
    ]);
  });

  it("drops a stock row whose productId is not in the resolved product list (foreign-company defense)", () => {
    const report = buildCurrentStockReport([stockRow({ productId: "unknown-product" })], [PRODUCT_A], [WAREHOUSE_1], {
      includeZeroStock: false,
    });
    expect(report.rows).toEqual([]);
  });
});

describe("buildStockLedgerReport", () => {
  function ledgerResult(overrides: Partial<StockLedgerResult> = {}): StockLedgerResult {
    return {
      productId: "prod-a",
      closingBalance: 40,
      lines: [
        {
          id: "line-1",
          transactionType: "SALES",
          direction: "OUT",
          quantity: 5,
          unitCost: 100,
          transactionDate: new Date("2026-04-01T00:00:00.000Z"),
          warehouseId: "wh-1",
          referenceType: "SALES_INVOICE",
          referenceId: "inv-1",
          batchId: null,
          narration: null,
          runningBalance: 45,
        },
        {
          id: "line-2",
          transactionType: "STOCK_ADJUSTMENT" as never,
          direction: "OUT",
          quantity: 2,
          unitCost: null,
          transactionDate: new Date("2026-04-02T00:00:00.000Z"),
          warehouseId: "wh-1",
          referenceType: "STOCK_ADJUSTMENT",
          referenceId: "adj-1",
          batchId: null,
          narration: "Damage write-off",
          runningBalance: 43,
        },
        {
          id: "line-3",
          transactionType: "OPENING_STOCK",
          direction: "IN",
          quantity: 40,
          unitCost: 90,
          transactionDate: new Date("2026-03-01T00:00:00.000Z"),
          warehouseId: "wh-1",
          referenceType: null,
          referenceId: null,
          batchId: null,
          narration: null,
          runningBalance: 40,
        },
      ],
      ...overrides,
    } as unknown as StockLedgerResult;
  }

  it("resolves a known referenceType with a document number to '<Friendly Name> #<number>'", () => {
    const documentNumberByKey = new Map([["SALES_INVOICE:inv-1", "INV-0001"]]);
    const report = buildStockLedgerReport(ledgerResult(), "Widget", [WAREHOUSE_1], documentNumberByKey);
    expect(report.lines[0].referenceLabel).toBe("Sales Invoice #INV-0001");
  });

  it("falls back to the raw referenceType for an unrecognized-but-present reference (Stock Adjustment)", () => {
    const report = buildStockLedgerReport(ledgerResult(), "Widget", [WAREHOUSE_1], new Map());
    expect(report.lines[1].referenceLabel).toBe("STOCK_ADJUSTMENT");
  });

  it("falls back to the humanized transactionType for a null referenceType (Opening Stock)", () => {
    const report = buildStockLedgerReport(ledgerResult(), "Widget", [WAREHOUSE_1], new Map());
    expect(report.lines[2].referenceLabel).toBe("Opening Stock");
  });

  it("copies the running balance and ordering unmodified from getStockLedger's own output", () => {
    const report = buildStockLedgerReport(ledgerResult(), "Widget", [WAREHOUSE_1], new Map());
    expect(report.lines.map((line) => line.runningBalance)).toEqual([45, 43, 40]);
    expect(report.closingBalance).toBe(40);
  });
});

describe("buildStockValuationReport", () => {
  function valuation(overrides: Partial<StockValuationResult> = {}): StockValuationResult {
    return {
      rows: [
        { productId: "prod-a", productName: "Widget", quantity: 10, unitCost: 100, value: 1000, isUnvalued: false },
        { productId: "prod-b", productName: "Gadget", quantity: 5, unitCost: 0, value: 0, isUnvalued: true },
      ],
      totalValue: 1000,
      ...overrides,
    };
  }

  it("attaches productCode for display and copies every other field verbatim", () => {
    const report = buildStockValuationReport(
      valuation(),
      new Map([
        ["prod-a", "WID-1"],
        ["prod-b", "GAD-1"],
      ])
    );
    expect(report.rows[0]).toEqual({
      productId: "prod-a",
      productName: "Widget",
      productCode: "WID-1",
      quantity: 10,
      unitCost: 100,
      value: 1000,
      isUnvalued: false,
    });
  });

  it("flags isUnvalued exactly for null-purchasePrice products, which naturally contribute 0 to totalValue rather than being excluded", () => {
    const report = buildStockValuationReport(valuation(), new Map());
    expect(report.rows[1].isUnvalued).toBe(true);
    expect(report.rows[1].value).toBe(0);
    expect(report.totalValue).toBe(1000);
  });
});

describe("buildLowStockReport", () => {
  it("includes only rows below their own product's minStockLevel, excluding products with no threshold set", () => {
    const report = buildLowStockReport(
      [stockRow({ productId: "prod-a", quantity: 5 }), stockRow({ productId: "prod-b", warehouseId: "wh-1", quantity: 1 })],
      [PRODUCT_A, PRODUCT_B],
      [WAREHOUSE_1],
      {}
    );
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]).toEqual({
      productId: "prod-a",
      productName: "Widget",
      productCode: "WID-1",
      warehouseId: "wh-1",
      warehouseName: "Main Warehouse",
      currentStock: 5,
      minStockLevel: 10,
      shortfall: 5,
    });
  });

  it("excludes a row at or above its threshold", () => {
    const report = buildLowStockReport([stockRow({ productId: "prod-a", quantity: 10 })], [PRODUCT_A], [WAREHOUSE_1], {});
    expect(report.rows).toEqual([]);
  });

  it("adds a zero-quantity row for a product with minStockLevel set and no recorded movement anywhere", () => {
    const report = buildLowStockReport([], [PRODUCT_A], [WAREHOUSE_1], {});
    expect(report.rows).toEqual([
      {
        productId: "prod-a",
        productName: "Widget",
        productCode: "WID-1",
        warehouseId: null,
        warehouseName: null,
        currentStock: 0,
        minStockLevel: 10,
        shortfall: 10,
      },
    ]);
  });

  it("excludes an inactive product even when its minStockLevel is set", () => {
    const report = buildLowStockReport([], [PRODUCT_INACTIVE], [WAREHOUSE_1], {});
    expect(report.rows).toEqual([]);
  });
});
