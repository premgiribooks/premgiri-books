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
