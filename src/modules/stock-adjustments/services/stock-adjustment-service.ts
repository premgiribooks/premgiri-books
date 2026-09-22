import { Prisma } from "@prisma/client";

import { AppError } from "@/lib/app-error";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { getCurrentFinancialYear } from "@/lib/current-financial-year";
import type { Page, PageParams } from "@/lib/pagination";
import { assertPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { isRetryableTransactionError } from "@/lib/prisma-errors";
import { runInTransaction } from "@/lib/transaction";
import { documentNumberEngine } from "@/engines/document-number/document-number-engine";
import { inventoryEngine } from "@/engines/inventory/inventory-engine";
import {
  stockAdjustmentRepository,
  type StockAdjustmentHeaderPersistData,
  type StockAdjustmentLinePersistData,
} from "@/modules/stock-adjustments/repositories/stock-adjustment-repository";
import {
  createStockAdjustmentSchema,
  toUtcDate,
  updateStockAdjustmentSchema,
  type CreateStockAdjustmentInput,
  type UpdateStockAdjustmentInput,
} from "@/modules/stock-adjustments/validation/stock-adjustment-schema";
import type {
  StockAdjustmentDetail,
  StockAdjustmentFormOptions,
  StockAdjustmentListFilters,
  StockAdjustmentListRow,
} from "@/types/stock-adjustment";

const NOT_FOUND_MESSAGE = "Stock adjustment not found.";
const NO_FINANCIAL_YEAR_MESSAGE = "Select a financial year before working with stock adjustments.";
const CANNOT_CHANGE_MESSAGE =
  "This stock adjustment can no longer be changed — it may have been posted or cancelled. Please refresh.";
const CANNOT_POST_MESSAGE =
  "This stock adjustment can no longer be posted — it may have already been posted or cancelled. Please refresh.";
const CANNOT_CANCEL_MESSAGE = "Only a posted stock adjustment can be cancelled.";

// Both posting and cancellation may batch mixed IN/OUT lines
// (47-stock-adjustment.md's Business Rules: "this document owns that
// retry, not the engine" — the Inventory Engine's own isolation contract
// requires the CALLER to open a Serializable transaction with bounded
// P2034 retry whenever a batch it hands to recordMovements contains an OUT
// line, since only the caller can retry a transaction it owns).
const SERIALIZABLE_RETRY = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  retryable: isRetryableTransactionError,
  conflictMessage: "Stock levels changed due to another request. Please try again.",
};

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function requireFinancialYear(): Promise<{ id: string }> {
  const financialYear = await getCurrentFinancialYear();
  if (!financialYear) {
    throw new AppError(NO_FINANCIAL_YEAR_MESSAGE);
  }
  return financialYear;
}

/**
 * A client-supplied productId/warehouseId must belong to the caller's
 * company before a draft is allowed to reference it — checked at
 * create/update time (not deferred to Posting, unlike active/TRADING-ness,
 * which the Inventory Engine re-validates at Post) since a DRAFT's line
 * detail (product name/code, warehouse name) is rendered on the detail/edit
 * pages immediately, before any posting ever happens. Without this check a
 * cross-company id would persist and leak another tenant's product/warehouse
 * names on every view of this draft — mirrors purchase-invoice-service.ts's
 * loadProductsMap/loadWarehousesMap company-scoped existence check.
 */
async function assertLineReferencesBelongToCompany(
  companyId: string,
  lines: readonly { productId: string; warehouseId: string }[]
): Promise<void> {
  const productIds = [...new Set(lines.map((line) => line.productId))];
  const warehouseIds = [...new Set(lines.map((line) => line.warehouseId))];

  const [products, warehouses] = await Promise.all([
    stockAdjustmentRepository.findProductsForLines(prisma, companyId, productIds),
    stockAdjustmentRepository.findWarehousesForLines(prisma, companyId, warehouseIds),
  ]);
  const productIdSet = new Set(products.map((product) => product.id));
  const warehouseIdSet = new Set(warehouses.map((warehouse) => warehouse.id));

  for (const line of lines) {
    if (!productIdSet.has(line.productId)) {
      throw new AppError("One or more products were not found.");
    }
    if (!warehouseIdSet.has(line.warehouseId)) {
      throw new AppError("One or more warehouses were not found.");
    }
  }
}

function toHeaderPersistData(data: { adjustmentDate: string; reason: string }): StockAdjustmentHeaderPersistData {
  return { adjustmentDate: toUtcDate(data.adjustmentDate), reason: data.reason };
}

function toLinePersistData(
  lines: readonly { productId: string; warehouseId: string; direction: "IN" | "OUT"; quantity: number; narration?: string }[]
): StockAdjustmentLinePersistData[] {
  return lines.map((line) => ({
    productId: line.productId,
    warehouseId: line.warehouseId,
    direction: line.direction,
    quantity: line.quantity,
    narration: line.narration ?? null,
  }));
}

export const stockAdjustmentService = {
  async listStockAdjustments(filters: StockAdjustmentListFilters = {}): Promise<StockAdjustmentListRow[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "inventory", "view");

    const financialYear = await getCurrentFinancialYear();
    if (!financialYear) {
      return [];
    }
    return stockAdjustmentRepository.findMany(user.companyId, financialYear.id, filters);
  },

  /** Infinite-scroll page for the Stock Adjustments list page. */
  async listStockAdjustmentsPage(
    filters: StockAdjustmentListFilters,
    page: PageParams
  ): Promise<Page<StockAdjustmentListRow>> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "inventory", "view");

    const financialYear = await getCurrentFinancialYear();
    if (!financialYear) {
      return { items: [], hasMore: false };
    }
    return stockAdjustmentRepository.findManyPage(user.companyId, financialYear.id, filters, page);
  },

  async getStockAdjustment(id: string): Promise<StockAdjustmentDetail | null> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "inventory", "view");

    const adjustment = await stockAdjustmentRepository.findById(id);
    if (!adjustment || adjustment.companyId !== user.companyId) {
      return null;
    }
    return adjustment;
  },

  async listFormOptions(): Promise<StockAdjustmentFormOptions> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "inventory", "view");
    const financialYear = await requireFinancialYear();

    const [products, warehouses, preview] = await Promise.all([
      stockAdjustmentRepository.findSelectableProducts(user.companyId),
      stockAdjustmentRepository.findSelectableWarehouses(user.companyId),
      documentNumberEngine.previewNextNumber({
        companyId: user.companyId,
        financialYearId: financialYear.id,
        documentType: "STOCK_ADJUSTMENT",
      }),
    ]);

    return { products, warehouses, nextAdjustmentNumber: preview.formatted };
  },

  async createDraft(input: CreateStockAdjustmentInput): Promise<StockAdjustmentDetail> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "inventory", "create");
    const financialYear = await requireFinancialYear();

    const data = createStockAdjustmentSchema.parse(input);
    await assertLineReferencesBelongToCompany(user.companyId, data.lines);
    const header = toHeaderPersistData(data);
    const lines = toLinePersistData(data.lines);

    return runInTransaction((tx) =>
      stockAdjustmentRepository.create(tx, user.companyId, financialYear.id, header, lines, user.id)
    );
  },

  // Only reachable while DRAFT (47-stock-adjustment.md: "Editable while
  // DRAFT") — checked before AND, atomically, inside the write transaction,
  // the purchase-return-service.ts double-check pattern.
  async updateDraft(id: string, input: UpdateStockAdjustmentInput): Promise<StockAdjustmentDetail> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "inventory", "edit");

    const existing = await stockAdjustmentRepository.findById(id);
    if (!existing || existing.companyId !== user.companyId) {
      throw new AppError(NOT_FOUND_MESSAGE);
    }
    if (existing.status !== "DRAFT") {
      throw new AppError(CANNOT_CHANGE_MESSAGE);
    }

    const data = updateStockAdjustmentSchema.parse(input);
    await assertLineReferencesBelongToCompany(user.companyId, data.lines);
    const header = toHeaderPersistData(data);
    const lines = toLinePersistData(data.lines);

    const updated = await runInTransaction((tx) =>
      stockAdjustmentRepository.replaceItemsAndUpdate(tx, id, user.companyId, ["DRAFT"], header, lines)
    );
    if (!updated) {
      throw new AppError(CANNOT_CHANGE_MESSAGE);
    }
    return updated;
  },

  /**
   * Posting (47-stock-adjustment.md's Business Rules): generates
   * `adjustmentNumber`, then records one `StockTransactionType.ADJUSTMENT`
   * movement per line — each line's own `direction`, so a single document
   * may post a mix of found-stock (IN) and write-off (OUT) lines in one
   * atomic batch — via `inventoryEngine.recordMovements`, which performs
   * every other business rule itself (TRADING-only, active/company-scoped,
   * quantity precision, OUT-line availability against
   * `allowNegativeStock`, future-date rejection); this service never
   * re-implements any of that. Gated on "approve" unconditionally — every
   * adjustment is a stock correction outside the normal transactional flow
   * and warrants sign-off.
   */
  async postStockAdjustment(id: string): Promise<StockAdjustmentDetail> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "inventory", "approve");

    const existing = await stockAdjustmentRepository.findById(id);
    if (!existing || existing.companyId !== user.companyId) {
      throw new AppError(NOT_FOUND_MESSAGE);
    }
    if (existing.status !== "DRAFT") {
      throw new AppError(CANNOT_POST_MESSAGE);
    }

    await documentNumberEngine.ensureSequence(user.companyId, existing.financialYearId, "STOCK_ADJUSTMENT");

    return runInTransaction(async (tx) => {
      const current = await stockAdjustmentRepository.findById(id, tx);
      if (!current || current.companyId !== user.companyId || current.status !== "DRAFT") {
        throw new AppError(CANNOT_POST_MESSAGE);
      }

      const generated = await documentNumberEngine.generateNumber(tx, {
        companyId: user.companyId,
        financialYearId: current.financialYearId,
        documentType: "STOCK_ADJUSTMENT",
      });

      const stockLines = current.items.map((item) => ({
        productId: item.productId,
        warehouseId: item.warehouseId,
        transactionType: "ADJUSTMENT" as const,
        direction: item.direction,
        quantity: item.quantity,
        transactionDate: toDateInputValue(current.adjustmentDate),
        referenceType: "STOCK_ADJUSTMENT",
        referenceId: current.id,
      }));
      await inventoryEngine.recordMovements(user.companyId, stockLines, tx);

      const posted = await stockAdjustmentRepository.markPosted(tx, id, user.companyId, generated);
      if (!posted) {
        throw new AppError(CANNOT_POST_MESSAGE);
      }
      return posted;
    }, SERIALIZABLE_RETRY);
  },

  /**
   * `POSTED -> CANCELLED` only — reverses every line's stock movement (same
   * product/warehouse/quantity, opposite direction: an original IN line's
   * reversal is OUT, and vice versa) atomically via
   * `inventoryEngine.recordMovements`. Gated on "approve", mirroring Post.
   */
  async cancelStockAdjustment(id: string): Promise<StockAdjustmentDetail> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "inventory", "approve");

    const existing = await stockAdjustmentRepository.findById(id);
    if (!existing || existing.companyId !== user.companyId) {
      throw new AppError(NOT_FOUND_MESSAGE);
    }
    if (existing.status !== "POSTED") {
      throw new AppError(CANNOT_CANCEL_MESSAGE);
    }

    return runInTransaction(async (tx) => {
      const current = await stockAdjustmentRepository.findById(id, tx);
      if (!current || current.companyId !== user.companyId || current.status !== "POSTED") {
        throw new AppError(CANNOT_CANCEL_MESSAGE);
      }

      const reversalLines = current.items.map((item) => ({
        productId: item.productId,
        warehouseId: item.warehouseId,
        transactionType: "ADJUSTMENT" as const,
        direction: item.direction === "IN" ? ("OUT" as const) : ("IN" as const),
        quantity: item.quantity,
        transactionDate: toDateInputValue(current.adjustmentDate),
        referenceType: "STOCK_ADJUSTMENT",
        referenceId: current.id,
      }));
      await inventoryEngine.recordMovements(user.companyId, reversalLines, tx);

      const count = await stockAdjustmentRepository.updateStatus(tx, id, user.companyId, ["POSTED"], "CANCELLED");
      if (count === 0) {
        throw new AppError(CANNOT_CANCEL_MESSAGE);
      }

      const updated = await stockAdjustmentRepository.findById(id, tx);
      if (!updated) {
        throw new AppError(NOT_FOUND_MESSAGE);
      }
      return updated;
    }, SERIALIZABLE_RETRY);
  },
};
