import type { StockTransactionType } from "@prisma/client";

import type { CurrentStockRow, StockLedgerResult, StockValuationResult } from "@/engines/inventory/types";
import type {
  CurrentStockReport,
  CurrentStockReportRow,
  InventoryReportProductOption,
  InventoryReportWarehouseOption,
  LowStockReport,
  LowStockReportRow,
  StockLedgerReport,
  StockValuationReport,
} from "@/types/inventory-report";
import type { ReportExportColumn, ReportExportTable } from "@/types/report-export";

// 70-inventory-reports.md's Reporting Engine composition layer — pure
// functions only, no Prisma import anywhere in this file. Every data access
// happens in inventory-report-service.ts, which passes already-fetched
// product/warehouse rows and a resolved reference-label map in as plain
// arguments; every stock figure here is read as-is from inventoryEngine's
// own getCurrentStock/getStockLedger/getStockValuation output — never
// re-summed or re-derived from StockTransaction rows directly (Invariant 3,
// this spec's own "no new stock-quantity aggregation logic" rule).

function round4(value: number): number {
  const factor = 10 ** 4;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

const REFERENCE_TYPE_LABELS: Readonly<Record<string, string>> = {
  SALES_INVOICE: "Sales Invoice",
  PURCHASE_INVOICE: "Purchase Invoice",
  SALES_RETURN: "Sales Return",
  PURCHASE_RETURN: "Purchase Return",
  CREDIT_NOTE: "Credit Note",
  DEBIT_NOTE: "Debit Note",
};

/** "OPENING_STOCK" -> "Opening Stock", "TRANSFER" -> "Transfer". */
function humanizeTransactionType(transactionType: StockTransactionType): string {
  return transactionType
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Business Rules #2's reference-label resolution. A known document
 * `referenceType` (Sales/Purchase Invoice, Sales/Purchase Return, Credit/
 * Debit Note) resolves to "<Friendly Name> #<document number>" via the
 * caller-supplied `documentNumberByKey` map (one batched lookup per
 * referenceType, built in inventory-report-service.ts — no Prisma here), or
 * just "<Friendly Name>" when no document number resolved (e.g. the document
 * is still DRAFT and its number is null). An unrecognized-but-present
 * referenceType (e.g. "STOCK_ADJUSTMENT", "PHYSICAL_VERIFICATION" — real
 * movements, but not modeled as a separate numbered document header) falls
 * back to that raw string. A null referenceType (Opening Stock, Transfer —
 * no separate document header at all per their own specs) falls back to the
 * humanized transactionType.
 */
function resolveReferenceLabel(
  referenceType: string | null,
  referenceId: string | null,
  transactionType: StockTransactionType,
  documentNumberByKey: ReadonlyMap<string, string>
): string {
  if (!referenceType) {
    return humanizeTransactionType(transactionType);
  }
  const friendlyName = REFERENCE_TYPE_LABELS[referenceType];
  if (!friendlyName) {
    return referenceType;
  }
  const documentNumber = referenceId ? documentNumberByKey.get(`${referenceType}:${referenceId}`) : undefined;
  return documentNumber ? `${friendlyName} #${documentNumber}` : friendlyName;
}

export interface CurrentStockReportOptions {
  warehouseId?: string;
  includeZeroStock: boolean;
}

/**
 * Business Rules #1 — joins `getCurrentStock`'s own rows to Product/
 * Warehouse display names. When `includeZeroStock` is set, every active
 * TRADING product not already present in `stockRows` (no recorded movement
 * at all) is added as a zero-quantity row, so a business can confirm nothing
 * has moved for a new product rather than the product silently not
 * appearing anywhere on the report.
 */
export function buildCurrentStockReport(
  stockRows: readonly CurrentStockRow[],
  products: readonly InventoryReportProductOption[],
  warehouses: readonly InventoryReportWarehouseOption[],
  options: CurrentStockReportOptions
): CurrentStockReport {
  const productById = new Map(products.map((product) => [product.id, product]));
  const warehouseById = new Map(warehouses.map((warehouse) => [warehouse.id, warehouse]));
  const seenProductIds = new Set<string>();

  const rows: CurrentStockReportRow[] = [];
  for (const stockRow of stockRows) {
    const product = productById.get(stockRow.productId);
    if (!product) {
      // Defensive only — a stock movement always references a real,
      // never-hard-deleted product (Invariant), but a foreign-company
      // productId sneaking through a filter would also land here and is
      // correctly dropped rather than leaking a name.
      continue;
    }
    seenProductIds.add(stockRow.productId);
    const warehouse = warehouseById.get(stockRow.warehouseId);
    rows.push({
      productId: product.id,
      productName: product.name,
      productCode: product.productCode,
      unitName: product.unitName,
      warehouseId: stockRow.warehouseId,
      warehouseName: warehouse?.name ?? null,
      quantity: stockRow.quantity,
    });
  }

  if (options.includeZeroStock) {
    const filterWarehouse = options.warehouseId ? warehouseById.get(options.warehouseId) : undefined;
    for (const product of products) {
      if (!product.isActive || seenProductIds.has(product.id)) {
        continue;
      }
      rows.push({
        productId: product.id,
        productName: product.name,
        productCode: product.productCode,
        unitName: product.unitName,
        warehouseId: options.warehouseId ?? null,
        warehouseName: filterWarehouse?.name ?? null,
        quantity: 0,
      });
    }
  }

  return { rows };
}

/** Business Rules #2 — dated movements for one product, reference-label resolved, running balance copied verbatim from `getStockLedger`. */
export function buildStockLedgerReport(
  ledgerResult: StockLedgerResult,
  productName: string,
  warehouses: readonly InventoryReportWarehouseOption[],
  documentNumberByKey: ReadonlyMap<string, string>
): StockLedgerReport {
  const warehouseById = new Map(warehouses.map((warehouse) => [warehouse.id, warehouse]));

  const lines = ledgerResult.lines.map((line) => ({
    id: line.id,
    transactionType: line.transactionType,
    direction: line.direction,
    quantity: line.quantity,
    unitCost: line.unitCost,
    transactionDate: line.transactionDate,
    warehouseId: line.warehouseId,
    warehouseName: warehouseById.get(line.warehouseId)?.name ?? null,
    referenceLabel: resolveReferenceLabel(line.referenceType, line.referenceId, line.transactionType, documentNumberByKey),
    narration: line.narration,
    runningBalance: line.runningBalance,
  }));

  return {
    productId: ledgerResult.productId,
    productName,
    lines,
    closingBalance: ledgerResult.closingBalance,
  };
}

/** Business Rules #3 — attaches `productCode` (not part of `getStockValuation`'s own row shape) for display; every other field, including `totalValue`, is copied verbatim. */
export function buildStockValuationReport(
  valuation: StockValuationResult,
  productCodeById: ReadonlyMap<string, string>
): StockValuationReport {
  const rows = valuation.rows.map((row) => ({
    productId: row.productId,
    productName: row.productName,
    productCode: productCodeById.get(row.productId) ?? "",
    quantity: row.quantity,
    unitCost: row.unitCost,
    value: row.value,
    isUnvalued: row.isUnvalued,
  }));

  return { rows, totalValue: valuation.totalValue };
}

export interface LowStockReportOptions {
  warehouseId?: string;
}

/**
 * Business Rules #4 — joins `getCurrentStock`'s own (product, warehouse)
 * rows to each product's `minStockLevel`, filtering to rows below it (a
 * product with no `minStockLevel` configured is excluded, never treated as
 * "always low" or "never low"). A product with a configured `minStockLevel`
 * but zero recorded movement anywhere never appears in `stockRows` at all
 * (`getCurrentStock` only groups over existing StockTransaction rows) — the
 * report's single most urgent case, so it is added here as one synthetic
 * zero-quantity row rather than silently omitted, the same structural
 * reasoning as Current Stock's own "show zero-stock products" addition. This
 * reads every quantity as-is from `stockRows`/`product.minStockLevel` — the
 * only arithmetic performed is the `<` comparison and the `shortfall`
 * subtraction, never a re-sum across warehouses.
 */
export function buildLowStockReport(
  stockRows: readonly CurrentStockRow[],
  products: readonly InventoryReportProductOption[],
  warehouses: readonly InventoryReportWarehouseOption[],
  options: LowStockReportOptions
): LowStockReport {
  const warehouseById = new Map(warehouses.map((warehouse) => [warehouse.id, warehouse]));
  const thresholdProducts = products.filter(
    (product): product is InventoryReportProductOption & { minStockLevel: number } =>
      product.isActive && product.minStockLevel !== null
  );
  const productById = new Map(thresholdProducts.map((product) => [product.id, product]));
  const seenProductIds = new Set<string>();

  const rows: LowStockReportRow[] = [];
  for (const stockRow of stockRows) {
    const product = productById.get(stockRow.productId);
    if (!product) {
      continue;
    }
    seenProductIds.add(stockRow.productId);
    if (stockRow.quantity >= product.minStockLevel) {
      continue;
    }
    const warehouse = warehouseById.get(stockRow.warehouseId);
    rows.push({
      productId: product.id,
      productName: product.name,
      productCode: product.productCode,
      warehouseId: stockRow.warehouseId,
      warehouseName: warehouse?.name ?? null,
      currentStock: stockRow.quantity,
      minStockLevel: product.minStockLevel,
      shortfall: round4(product.minStockLevel - stockRow.quantity),
    });
  }

  const filterWarehouse = options.warehouseId ? warehouseById.get(options.warehouseId) : undefined;
  for (const product of thresholdProducts) {
    if (seenProductIds.has(product.id) || product.minStockLevel <= 0) {
      continue;
    }
    rows.push({
      productId: product.id,
      productName: product.name,
      productCode: product.productCode,
      warehouseId: options.warehouseId ?? null,
      warehouseName: filterWarehouse?.name ?? null,
      currentStock: 0,
      minStockLevel: product.minStockLevel,
      shortfall: product.minStockLevel,
    });
  }

  return { rows };
}

type CurrentStockExportRow = Record<string, string | number | null>;

const CURRENT_STOCK_EXPORT_COLUMNS: ReportExportColumn[] = [
  { key: "productName", header: "Product Name", type: "string" },
  { key: "productCode", header: "Product Code", type: "string" },
  { key: "warehouseName", header: "Warehouse", type: "string" },
  { key: "quantity", header: "Current Stock", type: "number" },
  { key: "unitName", header: "Unit", type: "string" },
];

/**
 * Flattens buildCurrentStockReport's rows into the flat rows shape
 * src/lib/excel-export.ts's shared contract understands, mirroring
 * current-stock-table.tsx's exact column set — productName/productCode
 * split into their own columns (a flat sheet has no room for the screen's
 * stacked two-line product cell), matching toItemWiseSalesExportTable's own
 * precedent. No totals footer: current-stock-table.tsx renders none, and a
 * per-(product, warehouse) quantity listing has no meaningful cross-row sum.
 */
export function toCurrentStockExportTable(report: CurrentStockReport): ReportExportTable[] {
  const rows: CurrentStockExportRow[] = report.rows.map((row) => ({
    productName: row.productName,
    productCode: row.productCode,
    warehouseName: row.warehouseName ?? "All Warehouses",
    quantity: row.quantity,
    unitName: row.unitName,
  }));

  return [
    {
      sheetName: "Current Stock",
      columns: CURRENT_STOCK_EXPORT_COLUMNS,
      rows,
    },
  ];
}

type StockLedgerExportRow = Record<string, string | number | Date | null>;

const STOCK_LEDGER_EXPORT_COLUMNS: ReportExportColumn[] = [
  { key: "transactionDate", header: "Date", type: "date" },
  { key: "warehouseName", header: "Warehouse", type: "string" },
  { key: "referenceLabel", header: "Reference", type: "string" },
  { key: "narration", header: "Narration", type: "string" },
  { key: "direction", header: "Direction", type: "string" },
  { key: "quantity", header: "Quantity", type: "number" },
  { key: "runningBalance", header: "Running Balance", type: "number" },
];

/**
 * Flattens buildStockLedgerReport's dated lines into the flat rows-plus-
 * totals-footer shape src/lib/excel-export.ts's shared contract understands,
 * mirroring stock-ledger-table.tsx's exact column set — narration split into
 * its own column (the screen nests it under Reference; a flat sheet has no
 * room for a stacked two-line cell), matching toCustomerStatementExportTable's
 * own precedent. Closing Balance is a synthetic totals-footer row copied
 * straight from `report.closingBalance`, never re-derived from
 * `report.lines`, mirroring toCustomerStatementExportTable's identical
 * Closing Balance row shape.
 */
export function toStockLedgerExportTable(report: StockLedgerReport): ReportExportTable[] {
  const rows: StockLedgerExportRow[] = report.lines.map((line) => ({
    transactionDate: line.transactionDate,
    warehouseName: line.warehouseName ?? "—",
    referenceLabel: line.referenceLabel,
    narration: line.narration ?? "",
    direction: line.direction,
    quantity: line.quantity,
    runningBalance: line.runningBalance,
  }));

  return [
    {
      sheetName: "Stock Ledger",
      title: report.productName,
      columns: STOCK_LEDGER_EXPORT_COLUMNS,
      rows,
      totals: {
        transactionDate: null,
        warehouseName: "",
        referenceLabel: "",
        narration: "Closing Balance",
        direction: "",
        quantity: null,
        runningBalance: report.closingBalance,
      },
    },
  ];
}

type LowStockExportRow = Record<string, string | number | null>;

const LOW_STOCK_EXPORT_COLUMNS: ReportExportColumn[] = [
  { key: "productName", header: "Product Name", type: "string" },
  { key: "productCode", header: "Product Code", type: "string" },
  { key: "warehouseName", header: "Warehouse", type: "string" },
  { key: "currentStock", header: "Current Stock", type: "number" },
  { key: "minStockLevel", header: "Minimum Stock Level", type: "number" },
  { key: "shortfall", header: "Shortfall", type: "number" },
];

/**
 * Flattens buildLowStockReport's rows into the flat rows shape
 * src/lib/excel-export.ts's shared contract understands, mirroring
 * low-stock-table.tsx's exact column set — productName/productCode split
 * into their own columns, matching toCurrentStockExportTable's identical
 * treatment. No totals footer: low-stock-table.tsx renders none, and summing
 * Shortfall across unrelated products would not be a meaningful figure.
 */
export function toLowStockExportTable(report: LowStockReport): ReportExportTable[] {
  const rows: LowStockExportRow[] = report.rows.map((row) => ({
    productName: row.productName,
    productCode: row.productCode,
    warehouseName: row.warehouseName ?? "All Warehouses",
    currentStock: row.currentStock,
    minStockLevel: row.minStockLevel,
    shortfall: row.shortfall,
  }));

  return [
    {
      sheetName: "Low Stock",
      columns: LOW_STOCK_EXPORT_COLUMNS,
      rows,
    },
  ];
}

type StockValuationExportRow = Record<string, string | number | null>;

const STOCK_VALUATION_EXPORT_COLUMNS: ReportExportColumn[] = [
  { key: "productName", header: "Product Name", type: "string" },
  { key: "productCode", header: "Product Code", type: "string" },
  { key: "quantity", header: "Current Stock", type: "number" },
  { key: "unitCost", header: "Unit Cost", type: "currency" },
  { key: "value", header: "Total Value", type: "currency" },
];

/**
 * Flattens buildStockValuationReport's rows into the flat rows-plus-totals-
 * footer shape src/lib/excel-export.ts's shared contract understands,
 * mirroring stock-valuation-table.tsx's exact column set — an unvalued
 * row's Unit Cost cell shows "Cost not set" (that screen's own Badge text)
 * instead of the underlying numeric 0, matching the on-screen conditional
 * exactly rather than silently exporting a ₹0 as if it were a real cost.
 * Total Value's totals footer is copied straight from `report.totalValue`,
 * never re-summed.
 */
export function toStockValuationExportTable(report: StockValuationReport): ReportExportTable[] {
  const rows: StockValuationExportRow[] = report.rows.map((row) => ({
    productName: row.productName,
    productCode: row.productCode,
    quantity: row.quantity,
    unitCost: row.isUnvalued ? "Cost not set" : row.unitCost,
    value: row.value,
  }));

  return [
    {
      sheetName: "Stock Valuation",
      columns: STOCK_VALUATION_EXPORT_COLUMNS,
      rows,
      totals: {
        productName: "Total Value",
        productCode: "",
        quantity: null,
        unitCost: null,
        value: report.totalValue,
      },
    },
  ];
}
