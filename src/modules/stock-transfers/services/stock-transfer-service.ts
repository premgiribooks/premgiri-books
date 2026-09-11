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
  stockTransferRepository,
  type StockTransferHeaderPersistData,
  type StockTransferLinePersistData,
} from "@/modules/stock-transfers/repositories/stock-transfer-repository";
import {
  createStockTransferSchema,
  toUtcDate,
  updateStockTransferSchema,
  type CreateStockTransferInput,
  type UpdateStockTransferInput,
} from "@/modules/stock-transfers/validation/stock-transfer-schema";
import type {
  StockTransferDetail,
  StockTransferFormOptions,
  StockTransferListFilters,
  StockTransferListRow,
} from "@/types/stock-transfer";

const NOT_FOUND_MESSAGE = "Stock transfer not found.";
const NO_FINANCIAL_YEAR_MESSAGE = "Select a financial year before working with stock transfers.";
const CANNOT_CHANGE_MESSAGE =
  "This stock transfer can no longer be changed — it may have been posted or cancelled. Please refresh.";
const CANNOT_POST_MESSAGE =
  "This stock transfer can no longer be posted — it may have already been posted or cancelled. Please refresh.";
const CANNOT_CANCEL_MESSAGE = "Only a posted stock transfer can be cancelled.";

// Both posting and cancellation call inventoryEngine.transferStock once per
// line, and every call transferStock makes contains an OUT-side movement
// (48-stock-transfer.md's Business Rules: "this document owns that retry,
// not the engine" — the Inventory Engine's own isolation contract requires
// the CALLER to open a Serializable transaction with bounded P2034 retry
// whenever the batch it hands to the engine contains an OUT line, since only
// the caller can retry a transaction it owns).
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
 * A client-supplied productId (per line) or sourceWarehouseId/
 * destinationWarehouseId (header) must belong to the caller's company
 * before a draft is allowed to reference it — checked at create/update time
 * (not deferred to Posting, unlike active/TRADING-ness, which the Inventory
 * Engine re-validates at Post) since a DRAFT's detail (product name/code,
 * warehouse name) is rendered on the detail/edit pages immediately, before
 * any posting ever happens. Without this check a cross-company id would
 * persist and leak another tenant's product/warehouse names on every view
 * of this draft — mirrors stock-adjustment-service.ts's
 * assertLineReferencesBelongToCompany.
 */
async function assertReferencesBelongToCompany(
  companyId: string,
  productIds: readonly string[],
  warehouseIds: readonly string[]
): Promise<void> {
  const uniqueProductIds = [...new Set(productIds)];
  const uniqueWarehouseIds = [...new Set(warehouseIds)];

  const [products, warehouses] = await Promise.all([
    stockTransferRepository.findProductsForLines(prisma, companyId, uniqueProductIds),
    stockTransferRepository.findWarehousesForLines(prisma, companyId, uniqueWarehouseIds),
  ]);
  const productIdSet = new Set(products.map((product) => product.id));
  const warehouseIdSet = new Set(warehouses.map((warehouse) => warehouse.id));

  for (const productId of uniqueProductIds) {
    if (!productIdSet.has(productId)) {
      throw new AppError("One or more products were not found.");
    }
  }
  for (const warehouseId of uniqueWarehouseIds) {
    if (!warehouseIdSet.has(warehouseId)) {
      throw new AppError("One or more warehouses were not found.");
    }
  }
}

function toHeaderPersistData(data: {
  transferDate: string;
  sourceWarehouseId: string;
  destinationWarehouseId: string;
  narration?: string;
}): StockTransferHeaderPersistData {
  return {
    transferDate: toUtcDate(data.transferDate),
    sourceWarehouseId: data.sourceWarehouseId,
    destinationWarehouseId: data.destinationWarehouseId,
    narration: data.narration ?? null,
  };
}

function toLinePersistData(lines: readonly { productId: string; quantity: number }[]): StockTransferLinePersistData[] {
  return lines.map((line) => ({ productId: line.productId, quantity: line.quantity }));
}

export const stockTransferService = {
  async listStockTransfers(filters: StockTransferListFilters = {}): Promise<StockTransferListRow[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "inventory", "view");

    const financialYear = await getCurrentFinancialYear();
    if (!financialYear) {
      return [];
    }
    return stockTransferRepository.findMany(user.companyId, financialYear.id, filters);
  },

  async getStockTransfer(id: string): Promise<StockTransferDetail | null> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "inventory", "view");

    const transfer = await stockTransferRepository.findById(id);
    if (!transfer || transfer.companyId !== user.companyId) {
      return null;
    }
    return transfer;
  },

  async listFormOptions(): Promise<StockTransferFormOptions> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "inventory", "view");
    const financialYear = await requireFinancialYear();

    const [products, warehouses, preview] = await Promise.all([
      stockTransferRepository.findSelectableProducts(user.companyId),
      stockTransferRepository.findSelectableWarehouses(user.companyId),
      documentNumberEngine.previewNextNumber({
        companyId: user.companyId,
        financialYearId: financialYear.id,
        documentType: "STOCK_TRANSFER",
      }),
    ]);

    return { products, warehouses, nextTransferNumber: preview.formatted };
  },

  async createDraft(input: CreateStockTransferInput): Promise<StockTransferDetail> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "inventory", "create");
    const financialYear = await requireFinancialYear();

    const data = createStockTransferSchema.parse(input);
    await assertReferencesBelongToCompany(
      user.companyId,
      data.lines.map((line) => line.productId),
      [data.sourceWarehouseId, data.destinationWarehouseId]
    );
    const header = toHeaderPersistData(data);
    const lines = toLinePersistData(data.lines);

    return runInTransaction((tx) =>
      stockTransferRepository.create(tx, user.companyId, financialYear.id, header, lines, user.id)
    );
  },

  // Only reachable while DRAFT (48-stock-transfer.md: "Editable while
  // DRAFT") — checked before AND, atomically, inside the write transaction,
  // the stock-adjustment-service.ts double-check pattern.
  async updateDraft(id: string, input: UpdateStockTransferInput): Promise<StockTransferDetail> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "inventory", "edit");

    const existing = await stockTransferRepository.findById(id);
    if (!existing || existing.companyId !== user.companyId) {
      throw new AppError(NOT_FOUND_MESSAGE);
    }
    if (existing.status !== "DRAFT") {
      throw new AppError(CANNOT_CHANGE_MESSAGE);
    }

    const data = updateStockTransferSchema.parse(input);
    await assertReferencesBelongToCompany(
      user.companyId,
      data.lines.map((line) => line.productId),
      [data.sourceWarehouseId, data.destinationWarehouseId]
    );
    const header = toHeaderPersistData(data);
    const lines = toLinePersistData(data.lines);

    const updated = await runInTransaction((tx) =>
      stockTransferRepository.replaceItemsAndUpdate(tx, id, user.companyId, ["DRAFT"], header, lines)
    );
    if (!updated) {
      throw new AppError(CANNOT_CHANGE_MESSAGE);
    }
    return updated;
  },

  /**
   * Posting (48-stock-transfer.md's Business Rules): generates
   * `transferNumber`, then calls `inventoryEngine.transferStock` once per
   * line — each call writes its own linked OUT (source)/IN (destination)
   * row pair with its own `transferGroupId` — sequentially, inside this
   * document's one Serializable transaction (all-or-nothing across lines).
   * Every other business rule (TRADING-only, active/company-scoped,
   * quantity precision, source-side availability against
   * `allowNegativeStock`, future-date rejection) is the engine's own
   * re-validation, never duplicated in this service. Gated on "approve"
   * unconditionally, mirroring Stock Adjustment's Post-gate.
   */
  async postStockTransfer(id: string): Promise<StockTransferDetail> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "inventory", "approve");

    const existing = await stockTransferRepository.findById(id);
    if (!existing || existing.companyId !== user.companyId) {
      throw new AppError(NOT_FOUND_MESSAGE);
    }
    if (existing.status !== "DRAFT") {
      throw new AppError(CANNOT_POST_MESSAGE);
    }

    await documentNumberEngine.ensureSequence(user.companyId, existing.financialYearId, "STOCK_TRANSFER");

    return runInTransaction(async (tx) => {
      const current = await stockTransferRepository.findById(id, tx);
      if (!current || current.companyId !== user.companyId || current.status !== "DRAFT") {
        throw new AppError(CANNOT_POST_MESSAGE);
      }

      const generated = await documentNumberEngine.generateNumber(tx, {
        companyId: user.companyId,
        financialYearId: current.financialYearId,
        documentType: "STOCK_TRANSFER",
      });

      // Sequential, not Promise.all — a later line's failure must not race
      // ahead of an earlier line's write within the same transaction.
      for (const item of current.items) {
        await inventoryEngine.transferStock(
          user.companyId,
          {
            productId: item.productId,
            sourceWarehouseId: current.sourceWarehouseId,
            destinationWarehouseId: current.destinationWarehouseId,
            quantity: item.quantity,
            transactionDate: toDateInputValue(current.transferDate),
            narration: current.narration ?? undefined,
          },
          tx
        );
      }

      const posted = await stockTransferRepository.markPosted(tx, id, user.companyId, generated);
      if (!posted) {
        throw new AppError(CANNOT_POST_MESSAGE);
      }
      return posted;
    }, SERIALIZABLE_RETRY);
  },

  /**
   * `POSTED -> CANCELLED` only — reverses every line's transfer (same
   * product/quantity, source and destination swapped) atomically via
   * `inventoryEngine.transferStock`. Gated on "approve", mirroring Post.
   */
  async cancelStockTransfer(id: string): Promise<StockTransferDetail> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "inventory", "approve");

    const existing = await stockTransferRepository.findById(id);
    if (!existing || existing.companyId !== user.companyId) {
      throw new AppError(NOT_FOUND_MESSAGE);
    }
    if (existing.status !== "POSTED") {
      throw new AppError(CANNOT_CANCEL_MESSAGE);
    }

    return runInTransaction(async (tx) => {
      const current = await stockTransferRepository.findById(id, tx);
      if (!current || current.companyId !== user.companyId || current.status !== "POSTED") {
        throw new AppError(CANNOT_CANCEL_MESSAGE);
      }

      for (const item of current.items) {
        await inventoryEngine.transferStock(
          user.companyId,
          {
            productId: item.productId,
            sourceWarehouseId: current.destinationWarehouseId,
            destinationWarehouseId: current.sourceWarehouseId,
            quantity: item.quantity,
            transactionDate: toDateInputValue(current.transferDate),
            narration: current.narration ?? undefined,
          },
          tx
        );
      }

      const count = await stockTransferRepository.updateStatus(tx, id, user.companyId, ["POSTED"], "CANCELLED");
      if (count === 0) {
        throw new AppError(CANNOT_CANCEL_MESSAGE);
      }

      const updated = await stockTransferRepository.findById(id, tx);
      if (!updated) {
        throw new AppError(NOT_FOUND_MESSAGE);
      }
      return updated;
    }, SERIALIZABLE_RETRY);
  },
};
