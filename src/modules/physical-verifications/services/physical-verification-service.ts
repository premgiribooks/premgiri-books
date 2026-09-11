import { Prisma } from "@prisma/client";

import { AppError } from "@/lib/app-error";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { getCurrentFinancialYear } from "@/lib/current-financial-year";
import { assertPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { isRetryableTransactionError } from "@/lib/prisma-errors";
import { runInTransaction } from "@/lib/transaction";
import { documentNumberEngine } from "@/engines/document-number/document-number-engine";
import { inventoryEngine } from "@/engines/inventory/inventory-engine";
import {
  physicalVerificationRepository,
  type PhysicalVerificationHeaderPersistData,
  type PhysicalVerificationLinePersistData,
} from "@/modules/physical-verifications/repositories/physical-verification-repository";
import {
  createPhysicalVerificationSchema,
  toUtcDate,
  updatePhysicalVerificationSchema,
  type CreatePhysicalVerificationInput,
  type UpdatePhysicalVerificationInput,
} from "@/modules/physical-verifications/validation/physical-verification-schema";
import type {
  PhysicalVerificationDetail,
  PhysicalVerificationFormOptions,
  PhysicalVerificationListFilters,
  PhysicalVerificationListRow,
} from "@/types/physical-verification";

const NOT_FOUND_MESSAGE = "Physical verification not found.";
const NO_FINANCIAL_YEAR_MESSAGE = "Select a financial year before working with physical verifications.";
const CANNOT_CHANGE_MESSAGE =
  "This physical verification can no longer be changed — it may have been completed or cancelled. Please refresh.";
const CANNOT_COMPLETE_MESSAGE =
  "This physical verification can no longer be completed — it may have already been completed or cancelled. Please refresh.";
const CANNOT_CANCEL_MESSAGE = "Only a draft physical verification can be cancelled.";

// Completion may post a batch of mixed IN/OUT variance lines
// (49-physical-verification.md's Business Rules: "this transaction runs at
// Serializable isolation with bounded P2034 retry, the same contract Stock
// Adjustment's posting uses" — the Inventory Engine's own isolation
// contract requires the CALLER to open a Serializable transaction with
// bounded retry whenever a batch it hands to recordMovements contains an
// OUT line, since only the caller can retry a transaction it owns).
const SERIALIZABLE_RETRY = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  retryable: isRetryableTransactionError,
  conflictMessage: "Stock levels changed due to another request. Please try again.",
};

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Half-up rounding at the quantity storage precision (4dp) — the same
 * convention inventory-queries.ts's own `round` helper uses, applied here
 * since variance is a plain subtraction the service performs itself
 * (49-physical-verification.md's Code Standards: "variance subtraction is
 * simple enough to live in the service... the engine still owns all actual
 * stock-quantity aggregation via getCurrentStock"). */
function round4(value: number): number {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

async function requireFinancialYear(): Promise<{ id: string }> {
  const financialYear = await getCurrentFinancialYear();
  if (!financialYear) {
    throw new AppError(NO_FINANCIAL_YEAR_MESSAGE);
  }
  return financialYear;
}

/**
 * A client-supplied productId (per line) or warehouseId (header) must
 * belong to the caller's company before a draft is allowed to reference it
 * — checked at create/update time (not deferred to completion, unlike
 * active/TRADING-ness, which is re-validated at completion below), since a
 * DRAFT's detail (product name/code, warehouse name) is rendered on the
 * detail/edit pages immediately, before any completion ever happens.
 * Mirrors stock-transfer-service.ts's assertReferencesBelongToCompany.
 */
async function assertReferencesBelongToCompany(
  companyId: string,
  productIds: readonly string[],
  warehouseId: string
): Promise<void> {
  const uniqueProductIds = [...new Set(productIds)];

  const [products, warehouses] = await Promise.all([
    physicalVerificationRepository.findProductsForLines(prisma, companyId, uniqueProductIds),
    physicalVerificationRepository.findWarehousesForLines(prisma, companyId, [warehouseId]),
  ]);
  const productIdSet = new Set(products.map((product) => product.id));

  for (const productId of uniqueProductIds) {
    if (!productIdSet.has(productId)) {
      throw new AppError("One or more products were not found.");
    }
  }
  if (warehouses.length === 0) {
    throw new AppError("Warehouse not found.");
  }
}

/**
 * Completion-time re-validation of the header's warehouse and every line's
 * product (active, company-owned, TRADING) — 49-physical-verification.md's
 * Business Rules item 1. Unlike Stock Adjustment/Transfer, this cannot be
 * left entirely to inventoryEngine.recordMovements's own re-validation,
 * since a zero-variance line never reaches that call (it posts no
 * movement) yet the spec still requires its product to be re-checked.
 */
async function assertCompletableReferences(
  tx: Prisma.TransactionClient,
  companyId: string,
  warehouseId: string,
  productIds: readonly string[]
): Promise<void> {
  const warehouse = await physicalVerificationRepository.findWarehouseForCompletion(tx, companyId, warehouseId);
  if (!warehouse) {
    throw new AppError("Warehouse not found.");
  }
  if (!warehouse.isActive) {
    throw new AppError(`Warehouse "${warehouse.name}" is inactive and cannot be used for a physical verification.`);
  }

  const products = await physicalVerificationRepository.findProductsForCompletion(tx, companyId, [
    ...new Set(productIds),
  ]);
  const productById = new Map(products.map((product) => [product.id, product]));

  for (const productId of productIds) {
    const product = productById.get(productId);
    if (!product) {
      throw new AppError("One or more products were not found.");
    }
    if (!product.isActive) {
      throw new AppError(`Product "${product.name}" is inactive and cannot be used for a physical verification.`);
    }
    if (product.productType !== "TRADING") {
      throw new AppError(`Product "${product.name}" is not a trading product and cannot carry stock.`);
    }
  }
}

function toHeaderPersistData(data: {
  verificationDate: string;
  warehouseId: string;
  narration?: string;
}): PhysicalVerificationHeaderPersistData {
  return {
    verificationDate: toUtcDate(data.verificationDate),
    warehouseId: data.warehouseId,
    narration: data.narration ?? null,
  };
}

// systemQuantity/varianceQuantity are always persisted as 0 placeholders at
// draft-creation/update time, regardless of what the submitted payload
// might have carried (the schema doesn't even accept those fields) — see
// the repository's PhysicalVerificationLinePersistData doc comment.
function toLinePersistData(
  lines: readonly { productId: string; countedQuantity: number }[]
): PhysicalVerificationLinePersistData[] {
  return lines.map((line) => ({
    productId: line.productId,
    countedQuantity: line.countedQuantity,
    systemQuantity: 0,
    varianceQuantity: 0,
  }));
}

export const physicalVerificationService = {
  async listPhysicalVerifications(filters: PhysicalVerificationListFilters = {}): Promise<PhysicalVerificationListRow[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "inventory", "view");

    const financialYear = await getCurrentFinancialYear();
    if (!financialYear) {
      return [];
    }
    return physicalVerificationRepository.findMany(user.companyId, financialYear.id, filters);
  },

  async getPhysicalVerification(id: string): Promise<PhysicalVerificationDetail | null> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "inventory", "view");

    const verification = await physicalVerificationRepository.findById(id);
    if (!verification || verification.companyId !== user.companyId) {
      return null;
    }
    return verification;
  },

  async listFormOptions(): Promise<PhysicalVerificationFormOptions> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "inventory", "view");
    const financialYear = await requireFinancialYear();

    const [products, warehouses, preview] = await Promise.all([
      physicalVerificationRepository.findSelectableProducts(user.companyId),
      physicalVerificationRepository.findSelectableWarehouses(user.companyId),
      documentNumberEngine.previewNextNumber({
        companyId: user.companyId,
        financialYearId: financialYear.id,
        documentType: "PHYSICAL_VERIFICATION",
      }),
    ]);

    return { products, warehouses, nextVerificationNumber: preview.formatted };
  },

  /**
   * The line editor's live system-quantity preview column
   * (49-physical-verification.md's UI: "a live system-quantity preview
   * column"), keyed by productId for the given warehouse — a plain read via
   * inventoryEngine.getCurrentStock, never persisted. Company-scoped: an
   * out-of-tenant warehouseId resolves as not-found, the standing
   * cross-tenant-reference convention.
   */
  async getWarehouseStockPreview(warehouseId: string): Promise<Record<string, number>> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "inventory", "view");

    const warehouses = await physicalVerificationRepository.findWarehousesForLines(prisma, user.companyId, [warehouseId]);
    if (warehouses.length === 0) {
      throw new AppError("Warehouse not found.");
    }

    const rows = await inventoryEngine.getCurrentStock(user.companyId, { warehouseId });
    const preview: Record<string, number> = {};
    for (const row of rows) {
      preview[row.productId] = row.quantity;
    }
    return preview;
  },

  async createDraft(input: CreatePhysicalVerificationInput): Promise<PhysicalVerificationDetail> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "inventory", "create");
    const financialYear = await requireFinancialYear();

    const data = createPhysicalVerificationSchema.parse(input);
    await assertReferencesBelongToCompany(user.companyId, data.lines.map((line) => line.productId), data.warehouseId);
    const header = toHeaderPersistData(data);
    const lines = toLinePersistData(data.lines);

    return runInTransaction((tx) =>
      physicalVerificationRepository.create(tx, user.companyId, financialYear.id, header, lines, user.id)
    );
  },

  // Only reachable while DRAFT (49-physical-verification.md: "Editable
  // while DRAFT") — checked before AND, atomically, inside the write
  // transaction, the stock-transfer-service.ts double-check pattern.
  async updateDraft(id: string, input: UpdatePhysicalVerificationInput): Promise<PhysicalVerificationDetail> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "inventory", "edit");

    const existing = await physicalVerificationRepository.findById(id);
    if (!existing || existing.companyId !== user.companyId) {
      throw new AppError(NOT_FOUND_MESSAGE);
    }
    if (existing.status !== "DRAFT") {
      throw new AppError(CANNOT_CHANGE_MESSAGE);
    }

    const data = updatePhysicalVerificationSchema.parse(input);
    await assertReferencesBelongToCompany(user.companyId, data.lines.map((line) => line.productId), data.warehouseId);
    const header = toHeaderPersistData(data);
    const lines = toLinePersistData(data.lines);

    const updated = await runInTransaction((tx) =>
      physicalVerificationRepository.replaceItemsAndUpdate(tx, id, user.companyId, ["DRAFT"], header, lines)
    );
    if (!updated) {
      throw new AppError(CANNOT_CHANGE_MESSAGE);
    }
    return updated;
  },

  /**
   * Completion (49-physical-verification.md's Business Rules):
   * re-validates the warehouse and every line's product, re-reads current
   * stock fresh inside this transaction via inventoryEngine.getCurrentStock
   * (never the draft-time preview), overwrites systemQuantity/
   * varianceQuantity per line, generates `verificationNumber`, then posts
   * one StockTransactionType.PHYSICAL_VERIFICATION movement per non-zero-
   * variance line (direction IN when counted > system, OUT when counted <
   * system) via inventoryEngine.recordMovements — zero-variance lines post
   * no movement but remain on the record. Gated on "approve"
   * unconditionally, mirroring Stock Adjustment/Transfer's Complete/Post
   * gate.
   */
  async completePhysicalVerification(id: string): Promise<PhysicalVerificationDetail> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "inventory", "approve");

    const existing = await physicalVerificationRepository.findById(id);
    if (!existing || existing.companyId !== user.companyId) {
      throw new AppError(NOT_FOUND_MESSAGE);
    }
    if (existing.status !== "DRAFT") {
      throw new AppError(CANNOT_COMPLETE_MESSAGE);
    }

    await documentNumberEngine.ensureSequence(user.companyId, existing.financialYearId, "PHYSICAL_VERIFICATION");

    return runInTransaction(async (tx) => {
      const current = await physicalVerificationRepository.findById(id, tx);
      if (!current || current.companyId !== user.companyId || current.status !== "DRAFT") {
        throw new AppError(CANNOT_COMPLETE_MESSAGE);
      }

      await assertCompletableReferences(
        tx,
        user.companyId,
        current.warehouseId,
        current.items.map((item) => item.productId)
      );

      const stockRows = await inventoryEngine.getCurrentStock(user.companyId, { warehouseId: current.warehouseId }, tx);
      const systemQuantityByProduct = new Map(stockRows.map((row) => [row.productId, row.quantity]));

      const computedItems = current.items.map((item) => {
        const systemQuantity = systemQuantityByProduct.get(item.productId) ?? 0;
        const varianceQuantity = round4(item.countedQuantity - systemQuantity);
        return { id: item.id, productId: item.productId, systemQuantity, varianceQuantity };
      });

      const generated = await documentNumberEngine.generateNumber(tx, {
        companyId: user.companyId,
        financialYearId: current.financialYearId,
        documentType: "PHYSICAL_VERIFICATION",
      });

      const movementLines = computedItems
        .filter((item) => item.varianceQuantity !== 0)
        .map((item) => ({
          productId: item.productId,
          warehouseId: current.warehouseId,
          transactionType: "PHYSICAL_VERIFICATION" as const,
          direction: item.varianceQuantity > 0 ? ("IN" as const) : ("OUT" as const),
          quantity: Math.abs(item.varianceQuantity),
          transactionDate: toDateInputValue(current.verificationDate),
          referenceType: "PHYSICAL_VERIFICATION",
          referenceId: current.id,
        }));
      if (movementLines.length > 0) {
        await inventoryEngine.recordMovements(user.companyId, movementLines, tx);
      }

      const completed = await physicalVerificationRepository.completeWithComputedItems(
        tx,
        id,
        user.companyId,
        generated,
        computedItems.map(({ id: itemId, systemQuantity, varianceQuantity }) => ({
          id: itemId,
          systemQuantity,
          varianceQuantity,
        }))
      );
      if (!completed) {
        throw new AppError(CANNOT_COMPLETE_MESSAGE);
      }
      return completed;
    }, SERIALIZABLE_RETRY);
  },

  /**
   * `DRAFT -> CANCELLED` only — no reversal, since nothing was ever posted
   * for a DRAFT. No cancellation path exists for a COMPLETED verification
   * (49-physical-verification.md's Business Rules: "correct via a
   * subsequent Stock Adjustment document instead"). Gated on "approve",
   * mirroring Complete.
   */
  async cancelPhysicalVerification(id: string): Promise<PhysicalVerificationDetail> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "inventory", "approve");

    const existing = await physicalVerificationRepository.findById(id);
    if (!existing || existing.companyId !== user.companyId) {
      throw new AppError(NOT_FOUND_MESSAGE);
    }
    if (existing.status !== "DRAFT") {
      throw new AppError(CANNOT_CANCEL_MESSAGE);
    }

    const count = await physicalVerificationRepository.updateStatus(prisma, id, user.companyId, ["DRAFT"], "CANCELLED");
    if (count === 0) {
      throw new AppError(CANNOT_CANCEL_MESSAGE);
    }

    const updated = await physicalVerificationRepository.findById(id);
    if (!updated) {
      throw new AppError(NOT_FOUND_MESSAGE);
    }
    return updated;
  },
};
