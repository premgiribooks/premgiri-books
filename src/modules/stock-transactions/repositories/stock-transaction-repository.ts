import { randomUUID } from "node:crypto";

import { Prisma, type ProductType, type StockDirection } from "@prisma/client";

import { fetchPage, type Page, type PageParams } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { batchKey, pairKey } from "@/engines/inventory/inventory-validation";
import type { SerialMovementRecord } from "@/engines/inventory/inventory-validation";
import type {
  BatchStockFilters,
  BatchStockRow,
  CurrentStockFilters,
  CurrentStockRow,
  RecordedStockTransaction,
  StockLedgerFilters,
  StockMovementLineInput,
  TransferStockResult,
} from "@/engines/inventory/types";

type PrismaClientOrTransaction = typeof prisma | Prisma.TransactionClient;

export interface ProductForMovement {
  id: string;
  companyId: string;
  name: string;
  isActive: boolean;
  productType: ProductType;
  isBatchTracked: boolean;
  isSerialTracked: boolean;
  unit: { decimalPlaces: number };
}

export interface WarehouseForMovement {
  id: string;
  companyId: string;
  name: string;
  isActive: boolean;
}

/** Batch lookup for the batch-required/forbidden and active checks recordMovements/transferStock enforce (50-batch-tracking.md). */
export interface BatchForMovement {
  id: string;
  companyId: string;
  productId: string;
  batchNumber: string;
  isActive: boolean;
}

/** Serial lookup for the serial-required/forbidden and active checks recordMovements/transferStock enforce (51-serial-number-tracking.md). */
export interface SerialForMovement {
  id: string;
  companyId: string;
  productId: string;
  serialValue: string;
  isActive: boolean;
}

export interface ProductForValuation {
  id: string;
  name: string;
  purchasePrice: number | null;
}

// Opening Stock (46-opening-stock.md) read-model shapes — owned by this
// repository, like ProductForMovement/WarehouseForMovement above, rather than
// imported from the leaf feature module's own types file (which re-exports
// these instead — the same direction src/engines/inventory/types.ts already
// uses for StockMovementLineInput/TransferStockInput).
export interface OpeningStockProductOption {
  id: string;
  name: string;
  productCode: string | null;
  isActive: boolean;
  unitSymbol: string;
  unitDecimalPlaces: number;
  purchasePrice: number | null;
  defaultWarehouseId: string | null;
}

export interface OpeningStockWarehouseOption {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}

export interface OpeningStockListRow {
  id: string;
  productId: string;
  productName: string;
  productCode: string | null;
  warehouseId: string;
  warehouseName: string;
  quantity: number;
  unitSymbol: string;
  unitCost: number | null;
  transactionDate: Date;
  narration: string | null;
  createdAt: Date;
}

export interface OpeningStockListFilters {
  search?: string;
  productId?: string;
  warehouseId?: string;
}

// Decimal -> number normalization at the repository boundary (established
// convention, e.g. voucher-repository.ts's toPostedVoucher).
function toRecordedStockTransaction(raw: {
  id: string;
  companyId: string;
  productId: string;
  warehouseId: string;
  transactionType: RecordedStockTransaction["transactionType"];
  direction: StockDirection;
  quantity: Prisma.Decimal;
  unitCost: Prisma.Decimal | null;
  transactionDate: Date;
  referenceType: string | null;
  referenceId: string | null;
  transferGroupId: string | null;
  batchId: string | null;
  serialId: string | null;
  narration: string | null;
  createdAt: Date;
  updatedAt: Date;
}): RecordedStockTransaction {
  return {
    id: raw.id,
    companyId: raw.companyId,
    productId: raw.productId,
    warehouseId: raw.warehouseId,
    transactionType: raw.transactionType,
    direction: raw.direction,
    quantity: raw.quantity.toNumber(),
    unitCost: raw.unitCost === null ? null : raw.unitCost.toNumber(),
    transactionDate: raw.transactionDate,
    referenceType: raw.referenceType,
    referenceId: raw.referenceId,
    transferGroupId: raw.transferGroupId,
    batchId: raw.batchId,
    serialId: raw.serialId,
    narration: raw.narration,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

function toDecimalSum(sum: Prisma.Decimal | null): number {
  return (sum ?? new Prisma.Decimal(0)).toNumber();
}

function buildOpeningStockWhere(
  companyId: string,
  filters: OpeningStockListFilters
): Prisma.StockTransactionWhereInput {
  const search = filters.search?.trim();
  return {
    companyId,
    transactionType: "OPENING_STOCK",
    ...(filters.productId ? { productId: filters.productId } : {}),
    ...(filters.warehouseId ? { warehouseId: filters.warehouseId } : {}),
    ...(search
      ? {
          product: {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { productCode: { contains: search, mode: "insensitive" } },
            ],
          },
        }
      : {}),
  };
}

const OPENING_STOCK_SELECT = {
  id: true,
  productId: true,
  warehouseId: true,
  quantity: true,
  unitCost: true,
  transactionDate: true,
  narration: true,
  createdAt: true,
  product: { select: { name: true, productCode: true, unit: { select: { symbol: true } } } },
  warehouse: { select: { name: true } },
} as const;

type OpeningStockEntryRaw = Prisma.StockTransactionGetPayload<{ select: typeof OPENING_STOCK_SELECT }>;

function toOpeningStockListRow(row: OpeningStockEntryRaw): OpeningStockListRow {
  return {
    id: row.id,
    productId: row.productId,
    productName: row.product.name,
    productCode: row.product.productCode,
    warehouseId: row.warehouseId,
    warehouseName: row.warehouse.name,
    quantity: row.quantity.toNumber(),
    unitSymbol: row.product.unit.symbol,
    unitCost: row.unitCost === null ? null : row.unitCost.toNumber(),
    transactionDate: row.transactionDate,
    narration: row.narration,
    createdAt: row.createdAt,
  };
}

export const stockTransactionRepository = {
  /** Batch lookup for the product/type/active checks recordMovements and transferStock each enforce. */
  async findProductsForMovement(
    client: PrismaClientOrTransaction,
    productIds: readonly string[]
  ): Promise<ProductForMovement[]> {
    return client.product.findMany({
      where: { id: { in: [...productIds] } },
      select: {
        id: true,
        companyId: true,
        name: true,
        isActive: true,
        productType: true,
        isBatchTracked: true,
        isSerialTracked: true,
        unit: { select: { decimalPlaces: true } },
      },
    });
  },

  /** Batch lookup for the warehouse company-scope/active checks. */
  async findWarehousesForMovement(
    client: PrismaClientOrTransaction,
    warehouseIds: readonly string[]
  ): Promise<WarehouseForMovement[]> {
    return client.warehouse.findMany({
      where: { id: { in: [...warehouseIds] } },
      select: { id: true, companyId: true, name: true, isActive: true },
    });
  },

  /** Batch lookup for the batch-scope/active checks (50-batch-tracking.md) — kept here, not in product-batch-repository.ts, so the engine keeps its single-repository dependency. */
  async findBatchesForMovement(
    client: PrismaClientOrTransaction,
    batchIds: readonly string[]
  ): Promise<BatchForMovement[]> {
    return client.productBatch.findMany({
      where: { id: { in: [...batchIds] } },
      select: { id: true, companyId: true, productId: true, batchNumber: true, isActive: true },
    });
  },

  /** Serial lookup for the serial-scope/active checks (51-serial-number-tracking.md) — kept here, not in serial-number-repository.ts, for the identical single-repository-dependency reason as findBatchesForMovement. */
  async findSerialsForMovement(
    client: PrismaClientOrTransaction,
    serialIds: readonly string[]
  ): Promise<SerialForMovement[]> {
    return client.serialNumber.findMany({
      where: { id: { in: [...serialIds] } },
      select: { id: true, companyId: true, productId: true, serialValue: true, isActive: true },
    });
  },

  /**
   * Each requested serial's full movement history, grouped by `serialId` —
   * the engine's own read for `deriveSerialStatus`'s "cannot oversell an
   * identity" OUT-availability check (51-serial-number-tracking.md). Always
   * run on the caller's transaction so it observes the same Serializable
   * snapshot as the insert that follows it, the same contract as
   * `sumStockForPairs`/`sumStockForBatchTriples`.
   */
  async findSerialMovementHistory(
    tx: Prisma.TransactionClient,
    serialIds: readonly string[]
  ): Promise<Map<string, SerialMovementRecord[]>> {
    const result = new Map<string, SerialMovementRecord[]>();
    if (serialIds.length === 0) {
      return result;
    }

    const rows = await tx.stockTransaction.findMany({
      where: { serialId: { in: [...serialIds] } },
      select: { serialId: true, direction: true, transactionType: true, warehouseId: true, createdAt: true },
    });

    for (const row of rows) {
      if (!row.serialId) {
        continue;
      }
      const existing = result.get(row.serialId) ?? [];
      existing.push({
        direction: row.direction,
        transactionType: row.transactionType,
        warehouseId: row.warehouseId,
        createdAt: row.createdAt,
      });
      result.set(row.serialId, existing);
    }
    return result;
  },

  /** The negative-stock gate (code-standards.md). Defaults to `false` if the company's settings row is somehow missing — the safer default. */
  async findAllowNegativeStock(companyId: string): Promise<boolean> {
    const settings = await prisma.companySettings.findUnique({
      where: { companyId },
      select: { allowNegativeStock: true },
    });
    return settings?.allowNegativeStock ?? false;
  },

  /**
   * The FIFO-by-warehouse-age auto-allocator's own read (src/engines/
   * inventory/warehouse-allocation.ts) — one row per ACTIVE warehouse that
   * has ever carried this product, each with its own current net quantity
   * (Sigma IN - Sigma OUT) and its own earliest-ever IN transaction date for
   * this product, sorted oldest-first. A warehouse with a zero/negative net
   * quantity is still included (it did carry this product once) but the
   * allocator itself skips it when actually drawing stock — this read isn't
   * the place to filter that out, since "oldest warehouse that ever held it"
   * and "warehouse with stock right now" are different questions this one
   * query answers together. Two `groupBy` calls (Postgres has no single
   * aggregate for "net signed sum" + "MIN date filtered to one direction" in
   * one pass) merged client-side by warehouseId — the same shape
   * aggregateCurrentStock/sumStockForPairs already use for the signed-sum
   * half. Always run on the caller's transaction so it observes the same
   * Serializable snapshot as the insert that follows it.
   */
  async findWarehouseFifoCandidates(
    tx: Prisma.TransactionClient,
    companyId: string,
    productId: string
  ): Promise<{ warehouseId: string; availableQuantity: number; firstInDate: Date }[]> {
    const [stockRows, firstInRows] = await Promise.all([
      tx.stockTransaction.groupBy({
        by: ["warehouseId", "direction"],
        where: { companyId, productId, warehouse: { isActive: true } },
        _sum: { quantity: true },
      }),
      tx.stockTransaction.groupBy({
        by: ["warehouseId"],
        where: { companyId, productId, direction: "IN", warehouse: { isActive: true } },
        _min: { transactionDate: true },
      }),
    ]);

    const quantityByWarehouse = new Map<string, number>();
    for (const row of stockRows) {
      const signedQuantity = row.direction === "IN" ? toDecimalSum(row._sum.quantity) : -toDecimalSum(row._sum.quantity);
      quantityByWarehouse.set(row.warehouseId, (quantityByWarehouse.get(row.warehouseId) ?? 0) + signedQuantity);
    }

    const candidates = firstInRows
      .filter((row): row is typeof row & { _min: { transactionDate: Date } } => row._min.transactionDate !== null)
      .map((row) => ({
        warehouseId: row.warehouseId,
        availableQuantity: quantityByWarehouse.get(row.warehouseId) ?? 0,
        firstInDate: row._min.transactionDate,
      }));

    candidates.sort((a, b) => a.firstInDate.getTime() - b.firstInDate.getTime());
    return candidates;
  },

  /**
   * The auto-allocator's own last-resort target when a product has NEVER
   * been stocked in any warehouse yet (so `findWarehouseFifoCandidates`
   * returns nothing to rank) but the company still allows negative stock —
   * the product's own `defaultWarehouseId` if it's set and still active,
   * otherwise the company's single `isDefault` warehouse if it's active,
   * otherwise `null` (the caller then has no warehouse at all to write to
   * and must fail with a clear setup message rather than guessing one).
   */
  async findFallbackWarehouseId(companyId: string, productId: string): Promise<string | null> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { defaultWarehouseId: true, defaultWarehouse: { select: { isActive: true } } },
    });
    if (product?.defaultWarehouseId && product.defaultWarehouse?.isActive) {
      return product.defaultWarehouseId;
    }

    const companyDefault = await prisma.warehouse.findFirst({
      where: { companyId, isDefault: true, isActive: true },
      select: { id: true },
    });
    return companyDefault?.id ?? null;
  },

  /**
   * Current stock (Sigma IN - Sigma OUT) for exactly the requested (product,
   * warehouse) pairs, keyed by `pairKey` — the availability-check read.
   * Always run on the caller's transaction so it observes the same
   * Serializable snapshot as the insert that follows it. Pairs with no
   * transaction history at all are not present in Postgres's `groupBy`
   * output but ARE included in the returned map at 0, so callers never have
   * to special-case "no history yet."
   */
  async sumStockForPairs(
    tx: Prisma.TransactionClient,
    companyId: string,
    pairs: readonly { productId: string; warehouseId: string }[]
  ): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    for (const pair of pairs) {
      result.set(pairKey(pair.productId, pair.warehouseId), 0);
    }
    if (pairs.length === 0) {
      return result;
    }

    const rows = await tx.stockTransaction.groupBy({
      by: ["productId", "warehouseId", "direction"],
      where: {
        companyId,
        OR: pairs.map((pair) => ({ productId: pair.productId, warehouseId: pair.warehouseId })),
      },
      _sum: { quantity: true },
    });

    for (const row of rows) {
      const key = pairKey(row.productId, row.warehouseId);
      const signedQuantity = row.direction === "IN" ? toDecimalSum(row._sum.quantity) : -toDecimalSum(row._sum.quantity);
      result.set(key, (result.get(key) ?? 0) + signedQuantity);
    }

    return result;
  },

  /**
   * Batch-scoped analog of `sumStockForPairs` — current stock (Sigma IN -
   * Sigma OUT) for exactly the requested (product, warehouse, batch)
   * triples, keyed by `batchKey` (50-batch-tracking.md's batch-scoped
   * availability check). Same zero-prefill and same-transaction-snapshot
   * contract as `sumStockForPairs`.
   */
  async sumStockForBatchTriples(
    tx: Prisma.TransactionClient,
    companyId: string,
    triples: readonly { productId: string; warehouseId: string; batchId: string }[]
  ): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    for (const triple of triples) {
      result.set(batchKey(triple.productId, triple.warehouseId, triple.batchId), 0);
    }
    if (triples.length === 0) {
      return result;
    }

    const rows = await tx.stockTransaction.groupBy({
      by: ["productId", "warehouseId", "batchId", "direction"],
      where: {
        companyId,
        OR: triples.map((triple) => ({
          productId: triple.productId,
          warehouseId: triple.warehouseId,
          batchId: triple.batchId,
        })),
      },
      _sum: { quantity: true },
    });

    for (const row of rows) {
      if (!row.batchId) {
        continue;
      }
      const key = batchKey(row.productId, row.warehouseId, row.batchId);
      const signedQuantity = row.direction === "IN" ? toDecimalSum(row._sum.quantity) : -toDecimalSum(row._sum.quantity);
      result.set(key, (result.get(key) ?? 0) + signedQuantity);
    }

    return result;
  },

  /**
   * Bulk-inserts every line atomically, always on the caller's transaction
   * (inventory-engine.ts never calls this outside one). Postgres's
   * multi-row `INSERT ... VALUES (...), (...) RETURNING` preserves the
   * VALUES list order, so the result array lines up with `lines`.
   */
  async createMany(
    tx: Prisma.TransactionClient,
    companyId: string,
    lines: readonly StockMovementLineInput[]
  ): Promise<RecordedStockTransaction[]> {
    const created = await tx.stockTransaction.createManyAndReturn({
      data: lines.map((line) => ({
        companyId,
        productId: line.productId,
        warehouseId: line.warehouseId,
        transactionType: line.transactionType,
        direction: line.direction,
        quantity: line.quantity,
        unitCost: line.unitCost ?? null,
        transactionDate: new Date(`${line.transactionDate}T00:00:00.000Z`),
        referenceType: line.referenceType ?? null,
        referenceId: line.referenceId ?? null,
        batchId: line.batchId ?? null,
        serialId: line.serialId ?? null,
        narration: line.narration ?? null,
      })),
    });
    return created.map(toRecordedStockTransaction);
  },

  /**
   * Writes the OUT row (source) and IN row (destination) sharing one
   * generated `transferGroupId`, atomically on the caller's transaction —
   * a transfer is exactly two linked rows, `unitCost` null on both
   * (32-inventory-engine.md's Data Model decisions).
   */
  async createTransferPair(
    tx: Prisma.TransactionClient,
    companyId: string,
    input: {
      productId: string;
      sourceWarehouseId: string;
      destinationWarehouseId: string;
      quantity: number;
      transactionDate: Date;
      batchId: string | null;
      serialId: string | null;
      narration: string | null;
    }
  ): Promise<TransferStockResult> {
    const transferGroupId = randomUUID();

    // Sequential, not Promise.all: `tx` is a single pg PoolClient for the
    // whole transaction, and pg only supports one in-flight query per client
    // — running these concurrently triggered "Calling client.query() when
    // the client is already executing a query is deprecated" in a real
    // installed build, which pg's own docs say becomes a hard failure in
    // pg@9 rather than a warning.
    const outRow = await tx.stockTransaction.create({
      data: {
        companyId,
        productId: input.productId,
        warehouseId: input.sourceWarehouseId,
        transactionType: "TRANSFER",
        direction: "OUT",
        quantity: input.quantity,
        unitCost: null,
        transactionDate: input.transactionDate,
        transferGroupId,
        batchId: input.batchId,
        serialId: input.serialId,
        narration: input.narration,
      },
    });
    const inRow = await tx.stockTransaction.create({
      data: {
        companyId,
        productId: input.productId,
        warehouseId: input.destinationWarehouseId,
        transactionType: "TRANSFER",
        direction: "IN",
        quantity: input.quantity,
        unitCost: null,
        transactionDate: input.transactionDate,
        transferGroupId,
        batchId: input.batchId,
        serialId: input.serialId,
        narration: input.narration,
      },
    });

    return {
      outTransaction: toRecordedStockTransaction(outRow),
      inTransaction: toRecordedStockTransaction(inRow),
    };
  },

  /**
   * Current stock rows for `getCurrentStock` — grouped Sigma IN - Sigma OUT,
   * optionally narrowed to one product and/or one warehouse. Both the
   * "single-pair" (both filters given) and "per-warehouse breakdown" (only
   * `productId` given) shapes 32-inventory-engine.md describes are this
   * same array, just filtered differently.
   */
  async aggregateCurrentStock(
    companyId: string,
    filters: CurrentStockFilters = {},
    client: PrismaClientOrTransaction = prisma
  ): Promise<CurrentStockRow[]> {
    const rows = await client.stockTransaction.groupBy({
      by: ["productId", "warehouseId", "direction"],
      where: {
        companyId,
        ...(filters.productId ? { productId: filters.productId } : {}),
        ...(filters.warehouseId ? { warehouseId: filters.warehouseId } : {}),
      },
      _sum: { quantity: true },
    });

    const byPair = new Map<string, CurrentStockRow>();
    for (const row of rows) {
      const key = pairKey(row.productId, row.warehouseId);
      const signedQuantity = row.direction === "IN" ? toDecimalSum(row._sum.quantity) : -toDecimalSum(row._sum.quantity);
      const existing = byPair.get(key);
      if (existing) {
        existing.quantity += signedQuantity;
      } else {
        byPair.set(key, { productId: row.productId, warehouseId: row.warehouseId, quantity: signedQuantity });
      }
    }
    return [...byPair.values()];
  },

  /**
   * Batch-scoped analog of `aggregateCurrentStock` — grouped Sigma IN -
   * Sigma OUT per (product, warehouse, batch), optionally narrowed to one
   * product/warehouse/batch (50-batch-tracking.md's getBatchStock). Rows
   * with a null `batchId` (non-batch-tracked movements) are excluded.
   */
  async aggregateBatchStock(
    companyId: string,
    filters: BatchStockFilters = {},
    client: PrismaClientOrTransaction = prisma
  ): Promise<BatchStockRow[]> {
    const rows = await client.stockTransaction.groupBy({
      by: ["productId", "warehouseId", "batchId", "direction"],
      where: {
        companyId,
        batchId: filters.batchId ? filters.batchId : { not: null },
        ...(filters.productId ? { productId: filters.productId } : {}),
        ...(filters.warehouseId ? { warehouseId: filters.warehouseId } : {}),
      },
      _sum: { quantity: true },
    });

    const byTriple = new Map<string, BatchStockRow>();
    for (const row of rows) {
      if (!row.batchId) {
        continue;
      }
      const key = batchKey(row.productId, row.warehouseId, row.batchId);
      const signedQuantity = row.direction === "IN" ? toDecimalSum(row._sum.quantity) : -toDecimalSum(row._sum.quantity);
      const existing = byTriple.get(key);
      if (existing) {
        existing.quantity += signedQuantity;
      } else {
        byTriple.set(key, {
          productId: row.productId,
          warehouseId: row.warehouseId,
          batchId: row.batchId,
          quantity: signedQuantity,
        });
      }
    }
    return [...byTriple.values()];
  },

  /** Per-product Sigma IN - Sigma OUT across all warehouses, or within one when `warehouseId` is given — the getStockValuation aggregation. */
  async aggregateStockByProduct(
    companyId: string,
    warehouseId?: string
  ): Promise<{ productId: string; direction: StockDirection; quantity: number }[]> {
    const rows = await prisma.stockTransaction.groupBy({
      by: ["productId", "direction"],
      where: { companyId, ...(warehouseId ? { warehouseId } : {}) },
      _sum: { quantity: true },
    });
    return rows.map((row) => ({
      productId: row.productId,
      direction: row.direction,
      quantity: toDecimalSum(row._sum.quantity),
    }));
  },

  /** Name + Latest Purchase Cost for the products a valuation run needs to price. */
  async findProductsForValuation(companyId: string, productIds: readonly string[]): Promise<ProductForValuation[]> {
    const rows = await prisma.product.findMany({
      where: { companyId, id: { in: [...productIds] } },
      select: { id: true, name: true, purchasePrice: true },
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      purchasePrice: row.purchasePrice === null ? null : row.purchasePrice.toNumber(),
    }));
  },

  /** Dated movements for one product — the stock-register primitive `getStockLedger` walks to build a running balance. */
  async findLedgerTransactions(
    companyId: string,
    productId: string,
    filters: StockLedgerFilters = {}
  ): Promise<RecordedStockTransaction[]> {
    const rows = await prisma.stockTransaction.findMany({
      where: {
        companyId,
        productId,
        ...(filters.warehouseId ? { warehouseId: filters.warehouseId } : {}),
        ...(filters.batchId ? { batchId: filters.batchId } : {}),
        ...(filters.from || filters.to
          ? {
              transactionDate: {
                ...(filters.from ? { gte: filters.from } : {}),
                ...(filters.to ? { lte: filters.to } : {}),
              },
            }
          : {}),
      },
      orderBy: [{ transactionDate: "asc" }, { createdAt: "asc" }],
    });
    return rows.map(toRecordedStockTransaction);
  },

  /**
   * Which of the given (product, warehouse) pairs already have ANY
   * StockTransaction row (any transactionType) — Opening Stock's own
   * uniqueness gate (46-opening-stock.md's Data Model: "no StockTransaction
   * of any type exists yet for this pair", not merely "no prior
   * OPENING_STOCK row"). Always run on the caller's Serializable
   * transaction so it observes the same snapshot as the insert that
   * follows it — the same recipe as `sumStockForPairs`.
   */
  async existingTransactionPairs(
    tx: Prisma.TransactionClient,
    companyId: string,
    pairs: readonly { productId: string; warehouseId: string }[]
  ): Promise<Set<string>> {
    if (pairs.length === 0) {
      return new Set();
    }
    const rows = await tx.stockTransaction.findMany({
      where: {
        companyId,
        OR: pairs.map((pair) => ({ productId: pair.productId, warehouseId: pair.warehouseId })),
      },
      select: { productId: true, warehouseId: true },
    });
    return new Set(rows.map((row) => pairKey(row.productId, row.warehouseId)));
  },

  /** The Opening Stock line editor's product picker — active TRADING
   * products only, since only TRADING products may carry stock
   * (46-opening-stock.md's UI; mirrors purchase-invoice-repository.ts's
   * findInvoiceableProducts minus the GST/HSN fields this module never
   * touches). */
  async findOpeningStockEligibleProducts(companyId: string): Promise<OpeningStockProductOption[]> {
    const rows = await prisma.product.findMany({
      where: { companyId, isActive: true, productType: "TRADING" },
      select: {
        id: true,
        name: true,
        productCode: true,
        isActive: true,
        purchasePrice: true,
        defaultWarehouseId: true,
        unit: { select: { symbol: true, decimalPlaces: true } },
      },
      orderBy: { name: "asc" },
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      productCode: row.productCode,
      isActive: row.isActive,
      unitSymbol: row.unit.symbol,
      unitDecimalPlaces: row.unit.decimalPlaces,
      purchasePrice: row.purchasePrice === null ? null : row.purchasePrice.toNumber(),
      defaultWarehouseId: row.defaultWarehouseId,
    }));
  },

  /** The Opening Stock line editor's warehouse picker — mirrors
   * purchase-invoice-repository.ts's findSelectableWarehouses. */
  async findActiveWarehouses(companyId: string): Promise<OpeningStockWarehouseOption[]> {
    return prisma.warehouse.findMany({
      where: { companyId, isActive: true },
      select: { id: true, name: true, code: true, isActive: true },
      orderBy: { name: "asc" },
    });
  },

  /** The Opening Stock list page's read model — a filtered, name-joined view
   * over StockTransaction (46-opening-stock.md's Data Model: "a filtered
   * view over StockTransaction, not a new table"). `search` matches the
   * product's name or code. */
  async findOpeningStockEntries(companyId: string, filters: OpeningStockListFilters = {}): Promise<OpeningStockListRow[]> {
    const rows = await prisma.stockTransaction.findMany({
      where: buildOpeningStockWhere(companyId, filters),
      select: OPENING_STOCK_SELECT,
      orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
    });
    return rows.map(toOpeningStockListRow);
  },

  /** Infinite-scroll page for the Opening Stock list — same filters/
   * ordering as `findOpeningStockEntries`, just `skip`/`take`-bounded. */
  async findOpeningStockEntriesPage(
    companyId: string,
    filters: OpeningStockListFilters,
    page: PageParams
  ): Promise<Page<OpeningStockListRow>> {
    const result = await fetchPage(
      (args) =>
        prisma.stockTransaction.findMany({
          where: buildOpeningStockWhere(companyId, filters),
          select: OPENING_STOCK_SELECT,
          orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
          ...args,
        }),
      page
    );
    return { items: result.items.map(toOpeningStockListRow), hasMore: result.hasMore };
  },
};
