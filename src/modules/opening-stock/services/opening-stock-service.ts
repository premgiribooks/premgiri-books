import { Prisma } from "@prisma/client";

import { AppError } from "@/lib/app-error";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { assertPermission } from "@/lib/permissions";
import { isRetryableTransactionError } from "@/lib/prisma-errors";
import { runInTransaction } from "@/lib/transaction";
import { inventoryEngine } from "@/engines/inventory/inventory-engine";
import { pairKey } from "@/engines/inventory/inventory-validation";
import type { RecordedStockTransaction } from "@/engines/inventory/types";
import { stockTransactionRepository } from "@/modules/stock-transactions/repositories/stock-transaction-repository";
import { recordOpeningStockSchema, type RecordOpeningStockInput } from "@/modules/opening-stock/validation/opening-stock-schema";
import type { OpeningStockFormOptions, OpeningStockListFilters, OpeningStockListRow } from "@/types/opening-stock";

// The "at most one Opening Stock entry per (companyId, productId,
// warehouseId), ever" invariant is a check-then-insert race exactly like
// financial-year-repository.ts's "only one current FY" and
// inventory-engine.ts's own availability gate — two concurrent Opening
// Stock submissions for the same pair must not both observe "no prior
// transaction" and both succeed (46-opening-stock.md's Data Model).
const SERIALIZABLE_RETRY = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  retryable: isRetryableTransactionError,
  conflictMessage: "Opening stock data changed due to another request. Please try again.",
};

function duplicatePairMessage(productName: string, warehouseName: string): string {
  return (
    `"${productName}" at "${warehouseName}" already has stock movement recorded — Opening Stock can only be ` +
    "entered before any movement exists for that product/warehouse pair. Use Stock Adjustment instead."
  );
}

export const openingStockService = {
  async listOpeningStockEntries(filters: OpeningStockListFilters = {}): Promise<OpeningStockListRow[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "inventory", "view");
    return stockTransactionRepository.findOpeningStockEntries(user.companyId, filters);
  },

  async listFormOptions(): Promise<OpeningStockFormOptions> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "inventory", "view");

    const [products, warehouses] = await Promise.all([
      stockTransactionRepository.findOpeningStockEligibleProducts(user.companyId),
      stockTransactionRepository.findActiveWarehouses(user.companyId),
    ]);
    return { products, warehouses };
  },

  /**
   * The one write path (46-opening-stock.md's Service/Repository section):
   * inside a single Serializable transaction, checks that every line's
   * (product, warehouse) pair has no prior StockTransaction of any type
   * (this module's own uniqueness rule), then delegates the actual insert —
   * and every other business rule (TRADING-only, active/company-scoped,
   * quantity precision, future-date rejection) — to
   * inventoryEngine.recordMovements, never re-implementing any of it here.
   * Validates each line independently; the first invalid line rejects the
   * whole batch before any row is written (46-opening-stock.md's Business
   * Rules: "all-or-nothing per line").
   */
  async recordOpeningStock(input: RecordOpeningStockInput): Promise<RecordedStockTransaction[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "inventory", "create");

    const data = recordOpeningStockSchema.parse(input);

    return runInTransaction(async (tx) => {
      const pairs = data.lines.map((line) => ({ productId: line.productId, warehouseId: line.warehouseId }));
      const productIds = [...new Set(pairs.map((pair) => pair.productId))];
      const warehouseIds = [...new Set(pairs.map((pair) => pair.warehouseId))];

      const [existingPairs, products, warehouses] = await Promise.all([
        stockTransactionRepository.existingTransactionPairs(tx, user.companyId, pairs),
        stockTransactionRepository.findProductsForMovement(tx, productIds),
        stockTransactionRepository.findWarehousesForMovement(tx, warehouseIds),
      ]);
      const productById = new Map(products.map((product) => [product.id, product]));
      const warehouseById = new Map(warehouses.map((warehouse) => [warehouse.id, warehouse]));

      for (const pair of pairs) {
        if (existingPairs.has(pairKey(pair.productId, pair.warehouseId))) {
          const productName = productById.get(pair.productId)?.name ?? pair.productId;
          const warehouseName = warehouseById.get(pair.warehouseId)?.name ?? pair.warehouseId;
          throw new AppError(duplicatePairMessage(productName, warehouseName));
        }
      }

      const movementLines = data.lines.map((line) => ({
        productId: line.productId,
        warehouseId: line.warehouseId,
        transactionType: "OPENING_STOCK" as const,
        direction: "IN" as const,
        quantity: line.quantity,
        unitCost: line.unitCost,
        transactionDate: line.transactionDate,
        narration: line.narration,
      }));

      return inventoryEngine.recordMovements(user.companyId, movementLines, tx);
    }, SERIALIZABLE_RETRY);
  },
};
