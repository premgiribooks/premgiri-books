import { Prisma } from "@prisma/client";

import { AppError } from "@/lib/app-error";
import { prisma } from "@/lib/prisma";
import { isRetryableTransactionError } from "@/lib/prisma-errors";
import { runInTransaction } from "@/lib/transaction";
import type {
  CreateProductBatchInput,
  UpdateProductBatchInput,
} from "@/modules/product-batches/validation/product-batch-schema";
import type {
  ProductBatch,
  ProductBatchListFilters,
  ProductBatchOption,
  ProductBatchWithStock,
  UpdateProductBatchResult,
} from "@/types/product-batch";

// Read-then-write invariant guard (the batch has no recorded movement),
// identical shape/reasoning to product-repository.ts's
// assertImmutableFieldsIfMovementsExist — a concurrent Inventory Engine
// OUT-containing movement batch also opens Serializable, so both sides need
// it to actually detect the conflict.
const SERIALIZABLE_RETRY = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  retryable: isRetryableTransactionError,
  conflictMessage: "This batch was changed by another request. Please try again.",
};

function toStoredDate(value: string | undefined): Date | null {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

function buildWhere(
  companyId: string,
  productId: string,
  filters: ProductBatchListFilters
): Prisma.ProductBatchWhereInput {
  const where: Prisma.ProductBatchWhereInput = { companyId, productId };
  if (filters.status === "active") {
    where.isActive = true;
  } else if (filters.status === "inactive") {
    where.isActive = false;
  }
  return where;
}

/** Sigma IN - Sigma OUT per batchId, plus whether any row exists at all — one groupBy, no N+1 (50-batch-tracking.md: batch quantity is never stored). */
async function aggregateStockByBatchId(
  companyId: string,
  productId: string
): Promise<{ stockByBatchId: Map<string, number>; movedBatchIds: Set<string> }> {
  const rows = await prisma.stockTransaction.groupBy({
    by: ["batchId", "direction"],
    where: { companyId, productId, batchId: { not: null } },
    _sum: { quantity: true },
  });

  const stockByBatchId = new Map<string, number>();
  const movedBatchIds = new Set<string>();
  for (const row of rows) {
    if (!row.batchId) {
      continue;
    }
    movedBatchIds.add(row.batchId);
    const signed = row.direction === "IN" ? (row._sum.quantity?.toNumber() ?? 0) : -(row._sum.quantity?.toNumber() ?? 0);
    stockByBatchId.set(row.batchId, (stockByBatchId.get(row.batchId) ?? 0) + signed);
  }
  return { stockByBatchId, movedBatchIds };
}

function withZeroStock(batch: ProductBatch): ProductBatchWithStock {
  return { ...batch, currentStock: 0, hasMovements: false };
}

export const productBatchRepository = {
  /** The Batches tab's list — every batch of one product, joined with its derived current stock. */
  async findManyWithStock(
    companyId: string,
    productId: string,
    filters: ProductBatchListFilters = {}
  ): Promise<ProductBatchWithStock[]> {
    const [batches, { stockByBatchId, movedBatchIds }] = await Promise.all([
      prisma.productBatch.findMany({
        where: buildWhere(companyId, productId, filters),
        orderBy: { batchNumber: "asc" },
      }),
      aggregateStockByBatchId(companyId, productId),
    ]);

    return batches.map((batch) => ({
      ...batch,
      currentStock: stockByBatchId.get(batch.id) ?? 0,
      hasMovements: movedBatchIds.has(batch.id),
    }));
  },

  /** One batch joined with its own derived stock/movement state — the service's getBatch/getBatchStock primitive. */
  async findByIdWithStock(id: string): Promise<ProductBatchWithStock | null> {
    const batch = await prisma.productBatch.findUnique({ where: { id } });
    if (!batch) {
      return null;
    }
    const rows = await prisma.stockTransaction.groupBy({
      by: ["direction"],
      where: { batchId: id },
      _sum: { quantity: true },
    });

    let currentStock = 0;
    let hasMovements = false;
    for (const row of rows) {
      hasMovements = true;
      currentStock += row.direction === "IN" ? (row._sum.quantity?.toNumber() ?? 0) : -(row._sum.quantity?.toNumber() ?? 0);
    }
    return { ...batch, currentStock, hasMovements };
  },

  // No Serializable isolation on create — no cross-row invariant to guard
  // beyond the DB's own unique constraint (mirrors product-repository.ts's
  // create()).
  async create(companyId: string, data: CreateProductBatchInput): Promise<ProductBatchWithStock> {
    return runInTransaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: data.productId },
        select: { id: true, companyId: true, isBatchTracked: true },
      });
      if (!product || product.companyId !== companyId) {
        throw new AppError("Product not found.");
      }
      if (!product.isBatchTracked) {
        throw new AppError("This product is not batch-tracked — enable batch tracking on the product first.");
      }

      const batch = await tx.productBatch.create({
        data: {
          companyId,
          productId: data.productId,
          batchNumber: data.batchNumber,
          manufactureDate: toStoredDate(data.manufactureDate),
          expiryDate: toStoredDate(data.expiryDate),
        },
      });
      return withZeroStock(batch);
    });
  },

  /**
   * A batch's batchNumber/dates may only be edited before it has any
   * recorded StockTransaction (50-batch-tracking.md: "never renamed or
   * removed" once moved) — read-check-write in one Serializable transaction,
   * the same recipe as product-repository.ts's unit/type immutability guard.
   */
  async update(id: string, companyId: string, data: UpdateProductBatchInput): Promise<UpdateProductBatchResult> {
    return runInTransaction(async (tx) => {
      const existing = await tx.productBatch.findUnique({ where: { id } });
      if (!existing || existing.companyId !== companyId) {
        return { status: "not_found" };
      }

      const hasMovements = await tx.stockTransaction.findFirst({
        where: { batchId: id },
        select: { id: true },
      });
      if (hasMovements) {
        return { status: "has_movements" };
      }

      const updated = await tx.productBatch.update({
        where: { id },
        data: {
          batchNumber: data.batchNumber,
          manufactureDate: toStoredDate(data.manufactureDate),
          expiryDate: toStoredDate(data.expiryDate),
        },
      });
      return { status: "ok", batch: withZeroStock(updated) };
    }, SERIALIZABLE_RETRY);
  },

  /** Deactivate/activate — no invariant to guard (mirrors every other master's toggle); currentStock/hasMovements recomputed for the caller's read-model. */
  async setActive(
    id: string,
    companyId: string,
    isActive: boolean
  ): Promise<{ status: "not_found" } | { status: "ok"; batch: ProductBatchWithStock }> {
    const existing = await prisma.productBatch.findUnique({ where: { id } });
    if (!existing || existing.companyId !== companyId) {
      return { status: "not_found" };
    }

    const updated = await prisma.productBatch.update({ where: { id }, data: { isActive } });
    const { stockByBatchId, movedBatchIds } = await aggregateStockByBatchId(companyId, updated.productId);
    return {
      status: "ok",
      batch: {
        ...updated,
        currentStock: stockByBatchId.get(id) ?? 0,
        hasMovements: movedBatchIds.has(id),
      },
    };
  },

  /** The `<BatchSelector>` read-model — active batches only, optionally scoped to one warehouse's own stock. */
  async findOptionsForSelector(
    companyId: string,
    productId: string,
    warehouseId?: string
  ): Promise<ProductBatchOption[]> {
    const [batches, rows] = await Promise.all([
      prisma.productBatch.findMany({
        where: { companyId, productId, isActive: true },
        orderBy: { batchNumber: "asc" },
      }),
      prisma.stockTransaction.groupBy({
        by: ["batchId", "direction"],
        where: {
          companyId,
          productId,
          batchId: { not: null },
          ...(warehouseId ? { warehouseId } : {}),
        },
        _sum: { quantity: true },
      }),
    ]);

    const stockByBatchId = new Map<string, number>();
    for (const row of rows) {
      if (!row.batchId) {
        continue;
      }
      const signed = row.direction === "IN" ? (row._sum.quantity?.toNumber() ?? 0) : -(row._sum.quantity?.toNumber() ?? 0);
      stockByBatchId.set(row.batchId, (stockByBatchId.get(row.batchId) ?? 0) + signed);
    }

    return batches.map((batch) => ({
      id: batch.id,
      batchNumber: batch.batchNumber,
      expiryDate: batch.expiryDate,
      currentStock: stockByBatchId.get(batch.id) ?? 0,
    }));
  },
};
