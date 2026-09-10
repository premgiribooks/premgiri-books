import { Prisma } from "@prisma/client";

import { AppError } from "@/lib/app-error";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { getCurrentFinancialYear } from "@/lib/current-financial-year";
import { assertPermission } from "@/lib/permissions";
import { isUniqueConstraintError } from "@/lib/prisma-errors";
import { prisma } from "@/lib/prisma";
import { runInTransaction } from "@/lib/transaction";
import { documentNumberEngine } from "@/engines/document-number/document-number-engine";
import {
  goodsReceiptNoteRepository,
  type GoodsReceiptNoteHeaderPersistData,
  type GoodsReceiptNoteLinePersistData,
} from "@/modules/goods-receipt-notes/repositories/goods-receipt-note-repository";
import {
  createGoodsReceiptNoteSchema,
  toUtcDate,
  updateGoodsReceiptNoteSchema,
  type CreateGoodsReceiptNoteInput,
  type GoodsReceiptNoteLineInput,
  type UpdateGoodsReceiptNoteInput,
} from "@/modules/goods-receipt-notes/validation/goods-receipt-note-schema";
import type { ReceiptLine } from "@/modules/purchase-orders/repositories/purchase-order-repository";
import { purchaseOrderService } from "@/modules/purchase-orders/services/purchase-order-service";
import { supplierService } from "@/modules/suppliers/services/supplier-service";
import type {
  GoodsReceiptNoteDetail,
  GoodsReceiptNoteFormOptions,
  GoodsReceiptNoteListFilters,
  GoodsReceiptNoteListRow,
  GoodsReceiptNoteProductOption,
  GoodsReceiptNoteWarehouseOption,
  PurchaseOrderPrefill,
} from "@/types/goods-receipt-note";
import type { PurchaseOrderDetail } from "@/types/purchase-order";

// 43-goods-receipt-note.md lists a `createFromPurchaseOrder(purchaseOrderId,
// lines)` service method. Deliberately NOT implemented as a separate persist
// path: unlike Quotation -> Sales Order (spec 36's createFromQuotation,
// which copies/re-resolves everything needed to persist immediately, no
// further user input required), a Goods Receipt Note line needs a per-line
// WAREHOUSE no prior document can supply — so "convert from a Purchase
// Order" is inherently a form-fill step here, not a one-click
// persist-then-edit. `getPurchaseOrderPrefill` below is the read-only lookup
// the "New Goods Receipt Note" page uses (via ?purchaseOrderId=) to pre-fill
// that form; the actual write always goes through the single
// `createGoodsReceiptNote` below, whose schema already supports an optional
// `purchaseOrderId` + per-line `purchaseOrderItemId`. Mirrors
// delivery-challan-service.ts's identical file-comment convention.

type PrismaClientOrTransaction = typeof prisma | Prisma.TransactionClient;

const NOT_FOUND_MESSAGE = "Goods receipt note not found.";
const SUPPLIER_NOT_FOUND_MESSAGE = "Supplier not found.";
const SUPPLIER_INACTIVE_MESSAGE = "Selected supplier is inactive.";
const NO_FINANCIAL_YEAR_MESSAGE = "Select a financial year before working with goods receipt notes.";
const CANNOT_CHANGE_MESSAGE =
  "This goods receipt note can no longer be changed — it may have been received, invoiced, or cancelled. Please refresh.";
const PURCHASE_ORDER_NOT_FOUND_MESSAGE = "Purchase order not found.";
const PURCHASE_ORDER_NOT_OPEN_MESSAGE =
  "Only a confirmed or partially received purchase order can be linked to a goods receipt note.";
const PURCHASE_ORDER_SUPPLIER_MISMATCH_MESSAGE = "The linked purchase order does not belong to the selected supplier.";
const LINE_ITEM_NOT_FOUND_MESSAGE = "One or more lines reference an item that does not belong to the linked purchase order.";
const LINE_PRODUCT_MISMATCH_MESSAGE = "One or more lines' product does not match the linked purchase order item.";
const LINE_EXCEEDS_REMAINING_MESSAGE = "One or more lines exceed the remaining quantity on the linked purchase order.";
const PRODUCT_NOT_FOUND_MESSAGE = "One or more products were not found.";
const WAREHOUSE_NOT_FOUND_MESSAGE = "One or more warehouses were not found.";

// Tolerance-based comparison — the sales-order-service.ts/
// delivery-challan-service.ts float-drift idiom, reused here for the
// remainingQuantity <= (quantity + rejectedQuantity) guard.
const QUANTITY_TOLERANCE = 1e-6;

// Unit-dependent, so enforced here (after the product/unit row loads) rather
// than as a static Zod bound — mirrors delivery-challan-service.ts's
// identical helper.
function assertQuantityPrecision(quantity: number, decimalPlaces: number, label = "Quantity"): void {
  const factor = 10 ** decimalPlaces;
  if (Math.abs(quantity * factor - Math.round(quantity * factor)) >= 1e-6) {
    throw new AppError(
      decimalPlaces === 0
        ? `${label} must be a whole number — the selected product's unit has 0 decimal places.`
        : `${label} can have at most ${decimalPlaces} decimal places — the selected product's unit's limit.`
    );
  }
}

async function loadProductsMap(
  client: PrismaClientOrTransaction,
  companyId: string,
  lineInputs: readonly GoodsReceiptNoteLineInput[]
): Promise<Map<string, GoodsReceiptNoteProductOption>> {
  const productIds = [...new Set(lineInputs.map((line) => line.productId))];
  const products = await goodsReceiptNoteRepository.findProductsForLines(client, companyId, productIds);
  return new Map(products.map((product) => [product.id, product]));
}

async function loadWarehousesMap(
  client: PrismaClientOrTransaction,
  companyId: string,
  lineInputs: readonly GoodsReceiptNoteLineInput[]
): Promise<Map<string, GoodsReceiptNoteWarehouseOption>> {
  const warehouseIds = [...new Set(lineInputs.map((line) => line.warehouseId))];
  const warehouses = await goodsReceiptNoteRepository.findWarehousesForLines(client, companyId, warehouseIds);
  return new Map(warehouses.map((warehouse) => [warehouse.id, warehouse]));
}

async function verifySupplier(companyId: string, supplierId: string): Promise<void> {
  const supplier = await goodsReceiptNoteRepository.findSupplierForGrn(prisma, companyId, supplierId);
  if (!supplier) {
    throw new AppError(SUPPLIER_NOT_FOUND_MESSAGE);
  }
  if (!supplier.isActive) {
    throw new AppError(SUPPLIER_INACTIVE_MESSAGE);
  }
}

async function resolveLinkedPurchaseOrder(
  purchaseOrderId: string | undefined,
  supplierId: string
): Promise<PurchaseOrderDetail | null> {
  if (!purchaseOrderId) {
    return null;
  }
  const purchaseOrder = await purchaseOrderService.getPurchaseOrder(purchaseOrderId);
  if (!purchaseOrder) {
    throw new AppError(PURCHASE_ORDER_NOT_FOUND_MESSAGE);
  }
  if (purchaseOrder.status !== "CONFIRMED" && purchaseOrder.status !== "PARTIALLY_RECEIVED") {
    throw new AppError(PURCHASE_ORDER_NOT_OPEN_MESSAGE);
  }
  if (purchaseOrder.supplierId !== supplierId) {
    throw new AppError(PURCHASE_ORDER_SUPPLIER_MISMATCH_MESSAGE);
  }
  return purchaseOrder;
}

/**
 * Validates and builds every line's persisted fields. When `purchaseOrder`
 * is given, each line's (schema-guaranteed-present) `purchaseOrderItemId`
 * must belong to that order, match the line's own `productId`, and stay
 * within the item's remaining quantity (combined `quantity +
 * rejectedQuantity`, per 43-goods-receipt-note.md's Quantity rule) — a soft,
 * friendly-error check; the authoritative, race-safe re-check happens inside
 * receiveGoodsReceiptNote's transaction via purchaseOrderService.applyReceipt.
 */
function buildLines(
  lineInputs: readonly GoodsReceiptNoteLineInput[],
  productsById: ReadonlyMap<string, GoodsReceiptNoteProductOption>,
  warehousesById: ReadonlyMap<string, GoodsReceiptNoteWarehouseOption>,
  purchaseOrder: PurchaseOrderDetail | null
): GoodsReceiptNoteLinePersistData[] {
  const purchaseOrderItemsById = purchaseOrder ? new Map(purchaseOrder.items.map((item) => [item.id, item])) : null;

  return lineInputs.map((input) => {
    const product = productsById.get(input.productId);
    if (!product) {
      throw new AppError(PRODUCT_NOT_FOUND_MESSAGE);
    }
    const warehouse = warehousesById.get(input.warehouseId);
    if (!warehouse) {
      throw new AppError(WAREHOUSE_NOT_FOUND_MESSAGE);
    }
    assertQuantityPrecision(input.quantity, product.unitDecimalPlaces, "Quantity");
    assertQuantityPrecision(input.rejectedQuantity, product.unitDecimalPlaces, "Rejected quantity");

    if (purchaseOrderItemsById) {
      const item = purchaseOrderItemsById.get(input.purchaseOrderItemId as string);
      if (!item) {
        throw new AppError(LINE_ITEM_NOT_FOUND_MESSAGE);
      }
      if (item.productId !== input.productId) {
        throw new AppError(LINE_PRODUCT_MISMATCH_MESSAGE);
      }
      const remaining = item.quantity - item.receivedQuantity;
      const combined = input.quantity + input.rejectedQuantity;
      if (combined > remaining + QUANTITY_TOLERANCE) {
        throw new AppError(LINE_EXCEEDS_REMAINING_MESSAGE);
      }
    }

    return {
      productId: input.productId,
      warehouseId: input.warehouseId,
      quantity: input.quantity,
      rejectedQuantity: input.rejectedQuantity,
      purchaseOrderItemId: input.purchaseOrderItemId ?? null,
    };
  });
}

function toHeaderPersistData(data: {
  supplierId: string;
  grnDate: string;
  narration?: string;
  purchaseOrderId?: string;
}): GoodsReceiptNoteHeaderPersistData {
  return {
    supplierId: data.supplierId,
    grnDate: toUtcDate(data.grnDate),
    purchaseOrderId: data.purchaseOrderId ?? null,
    narration: data.narration ?? null,
  };
}

async function requireFinancialYear(): Promise<{ id: string }> {
  const financialYear = await getCurrentFinancialYear();
  if (!financialYear) {
    throw new AppError(NO_FINANCIAL_YEAR_MESSAGE);
  }
  return financialYear;
}

async function afterTransition(id: string, count: number): Promise<GoodsReceiptNoteDetail> {
  if (count === 0) {
    throw new AppError(CANNOT_CHANGE_MESSAGE);
  }
  const updated = await goodsReceiptNoteRepository.findById(id);
  if (!updated) {
    throw new AppError(NOT_FOUND_MESSAGE);
  }
  return updated;
}

async function persistNewGoodsReceiptNote(
  companyId: string,
  financialYearId: string,
  header: GoodsReceiptNoteHeaderPersistData,
  lines: GoodsReceiptNoteLinePersistData[],
  createdByUserId: string
): Promise<GoodsReceiptNoteDetail> {
  // ensureSequence must run in its own short-lived statement BEFORE the
  // posting transaction opens — the Document Number Engine's documented
  // contract, delivery-challan-service.ts's persistNewDeliveryChallan
  // precedent.
  await documentNumberEngine.ensureSequence(companyId, financialYearId, "GOODS_RECEIPT_NOTE");

  try {
    return await runInTransaction(async (tx) => {
      const generated = await documentNumberEngine.generateNumber(tx, {
        companyId,
        financialYearId,
        documentType: "GOODS_RECEIPT_NOTE",
      });

      return goodsReceiptNoteRepository.create(tx, companyId, financialYearId, header, lines, generated, createdByUserId);
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    if (isUniqueConstraintError(error)) {
      throw new AppError("A goods receipt note with this number already exists for this financial year.");
    }
    throw error;
  }
}

export const goodsReceiptNoteService = {
  // Scoped to the active financial year — grnNumber is only unique per
  // (company, financial year) — mirrors deliveryChallanService.listDeliveryChallans.
  async listGoodsReceiptNotes(filters: GoodsReceiptNoteListFilters = {}): Promise<GoodsReceiptNoteListRow[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "purchase", "view");

    const financialYear = await getCurrentFinancialYear();
    if (!financialYear) {
      return [];
    }

    return goodsReceiptNoteRepository.findMany(user.companyId, financialYear.id, filters);
  },

  // Company-scoped only (not FY-scoped) — mirrors deliveryChallanService.getDeliveryChallan.
  // Accepts an optional transaction client so a posting-time caller (e.g.
  // purchaseInvoiceService.postPurchaseInvoice) can re-verify this row
  // through its own Serializable transaction's snapshot rather than the
  // global `prisma` singleton (code review finding on purchase-invoice-service.ts).
  async getGoodsReceiptNote(id: string, client: PrismaClientOrTransaction = prisma): Promise<GoodsReceiptNoteDetail | null> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "purchase", "view");

    const grn = await goodsReceiptNoteRepository.findById(id, client);
    if (!grn || grn.companyId !== user.companyId) {
      return null;
    }
    return grn;
  },

  /** "Received, not yet invoiced" — the lookup Purchase Invoice (feature-spec
   * 44) reads from via `markInvoiced`. */
  async listReceivedNotInvoiced(supplierId: string): Promise<GoodsReceiptNoteListRow[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "purchase", "view");

    const financialYear = await getCurrentFinancialYear();
    if (!financialYear) {
      return [];
    }

    return goodsReceiptNoteRepository.findReceivedNotInvoiced(user.companyId, financialYear.id, supplierId);
  },

  async listGoodsReceiptNoteFormOptions(): Promise<GoodsReceiptNoteFormOptions> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "purchase", "view");

    const financialYear = await requireFinancialYear();

    const [suppliers, products, warehouses, preview] = await Promise.all([
      supplierService.listSelectableSuppliers(),
      goodsReceiptNoteRepository.findReceivableProducts(user.companyId),
      goodsReceiptNoteRepository.findSelectableWarehouses(user.companyId),
      documentNumberEngine.previewNextNumber({
        companyId: user.companyId,
        financialYearId: financialYear.id,
        documentType: "GOODS_RECEIPT_NOTE",
      }),
    ]);

    return {
      suppliers: suppliers.map((supplier) => ({ id: supplier.id, name: supplier.ledger.name, isActive: supplier.isActive })),
      products,
      warehouses,
      nextGrnNumber: preview.formatted,
    };
  },

  /** Read-only prefill lookup for "New Goods Receipt Note" reached via
   * `?purchaseOrderId=` — see this file's header comment for why this
   * replaces a dedicated `createFromPurchaseOrder` persist method. Returns
   * null when the order doesn't exist, isn't open, or belongs to another
   * company. */
  async getPurchaseOrderPrefill(purchaseOrderId: string): Promise<PurchaseOrderPrefill | null> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "purchase", "view");

    const purchaseOrder = await purchaseOrderService.getPurchaseOrder(purchaseOrderId);
    if (!purchaseOrder || (purchaseOrder.status !== "CONFIRMED" && purchaseOrder.status !== "PARTIALLY_RECEIVED")) {
      return null;
    }

    const openItems = purchaseOrder.items.filter(
      (item) => item.receivedQuantity < item.quantity - QUANTITY_TOLERANCE
    );
    const productIds = [...new Set(openItems.map((item) => item.productId))];
    const products = await goodsReceiptNoteRepository.findProductsForLines(prisma, user.companyId, productIds);
    const productsById = new Map(products.map((product) => [product.id, product]));

    const lines = openItems.map((item) => {
      const product = productsById.get(item.productId);
      return {
        purchaseOrderItemId: item.id,
        productId: item.productId,
        productName: item.product.name,
        productCode: item.product.productCode,
        unitSymbol: product?.unitSymbol ?? "",
        unitDecimalPlaces: product?.unitDecimalPlaces ?? 4,
        orderedQuantity: item.quantity,
        receivedQuantity: item.receivedQuantity,
        remainingQuantity: item.quantity - item.receivedQuantity,
      };
    });

    return {
      purchaseOrderId: purchaseOrder.id,
      orderNumber: purchaseOrder.orderNumber,
      supplierId: purchaseOrder.supplierId,
      lines,
    };
  },

  async createGoodsReceiptNote(input: CreateGoodsReceiptNoteInput): Promise<GoodsReceiptNoteDetail> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "purchase", "create");

    const financialYear = await requireFinancialYear();
    const data = createGoodsReceiptNoteSchema.parse(input);

    await verifySupplier(user.companyId, data.supplierId);
    const purchaseOrder = await resolveLinkedPurchaseOrder(data.purchaseOrderId, data.supplierId);

    const productsById = await loadProductsMap(prisma, user.companyId, data.lines);
    const warehousesById = await loadWarehousesMap(prisma, user.companyId, data.lines);
    const lines = buildLines(data.lines, productsById, warehousesById, purchaseOrder);

    return persistNewGoodsReceiptNote(user.companyId, financialYear.id, toHeaderPersistData(data), lines, user.id);
  },

  // Only reachable while DRAFT (43-goods-receipt-note.md: "Editable while
  // DRAFT") — checked before AND, atomically, inside the write transaction,
  // the delivery-challan-service.ts double-check pattern. Never regenerates
  // grnNumber.
  async updateGoodsReceiptNote(id: string, input: UpdateGoodsReceiptNoteInput): Promise<GoodsReceiptNoteDetail> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "purchase", "edit");

    const existing = await goodsReceiptNoteRepository.findById(id);
    if (!existing || existing.companyId !== user.companyId) {
      throw new AppError(NOT_FOUND_MESSAGE);
    }
    if (existing.status !== "DRAFT") {
      throw new AppError(CANNOT_CHANGE_MESSAGE);
    }

    const data = updateGoodsReceiptNoteSchema.parse(input);
    await verifySupplier(user.companyId, data.supplierId);
    const purchaseOrder = await resolveLinkedPurchaseOrder(data.purchaseOrderId, data.supplierId);

    const productsById = await loadProductsMap(prisma, user.companyId, data.lines);
    const warehousesById = await loadWarehousesMap(prisma, user.companyId, data.lines);
    const lines = buildLines(data.lines, productsById, warehousesById, purchaseOrder);

    const updated = await runInTransaction((tx) =>
      goodsReceiptNoteRepository.replaceItemsAndUpdate(
        tx,
        id,
        user.companyId,
        ["DRAFT"],
        toHeaderPersistData(data),
        lines
      )
    );
    if (!updated) {
      throw new AppError(CANNOT_CHANGE_MESSAGE);
    }
    return updated;
  },

  /**
   * `DRAFT -> RECEIVED`, in one transaction (43-goods-receipt-note.md's
   * Business Rules): re-validates every line's product/warehouse are
   * active, applies the receipt to the linked Purchase Order (if any)
   * atomically with this GRN's own status flip — passing each line's
   * combined `quantity + rejectedQuantity` as the fulfillment amount, per
   * that spec's Quantity rule — and never touches the Inventory Engine (see
   * that spec's Goal — Purchase Invoice, feature-spec 44, is the sole
   * stock-in point in this phase).
   */
  async receiveGoodsReceiptNote(id: string): Promise<GoodsReceiptNoteDetail> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "purchase", "edit");

    return runInTransaction(async (tx) => {
      const existing = await goodsReceiptNoteRepository.findById(id, tx);
      if (!existing || existing.companyId !== user.companyId) {
        throw new AppError(NOT_FOUND_MESSAGE);
      }
      if (existing.status !== "DRAFT") {
        throw new AppError(CANNOT_CHANGE_MESSAGE);
      }

      const productIds = [...new Set(existing.items.map((item) => item.productId))];
      const warehouseIds = [...new Set(existing.items.map((item) => item.warehouseId))];
      const [products, warehouses] = await Promise.all([
        goodsReceiptNoteRepository.findProductsForLines(tx, user.companyId, productIds),
        goodsReceiptNoteRepository.findWarehousesForLines(tx, user.companyId, warehouseIds),
      ]);
      const productsById = new Map(products.map((product) => [product.id, product]));
      const warehousesById = new Map(warehouses.map((warehouse) => [warehouse.id, warehouse]));

      for (const item of existing.items) {
        const product = productsById.get(item.productId);
        if (!product || !product.isActive) {
          throw new AppError(`${item.product.name} is inactive and cannot be received.`);
        }
        const warehouse = warehousesById.get(item.warehouseId);
        if (!warehouse || !warehouse.isActive) {
          throw new AppError(`${item.warehouse.name} is inactive and cannot receive stock.`);
        }
      }

      if (existing.purchaseOrderId) {
        const receiptLines: ReceiptLine[] = existing.items
          .filter((item) => item.purchaseOrderItemId !== null)
          .map((item) => ({
            purchaseOrderItemId: item.purchaseOrderItemId as string,
            quantity: item.quantity + item.rejectedQuantity,
          }));

        // Participates in THIS transaction — the remaining-quantity check
        // and receivedQuantity increment run atomically with this GRN's own
        // status flip below. A lost race inside applyReceipt's own guarded
        // write throws (its own RECEIPT_CONFLICT_MESSAGE), which rolls back
        // this entire transaction too.
        await purchaseOrderService.applyReceipt(existing.purchaseOrderId, receiptLines, tx);
      }

      const count = await goodsReceiptNoteRepository.updateStatus(tx, id, user.companyId, ["DRAFT"], "RECEIVED");
      if (count === 0) {
        throw new AppError(CANNOT_CHANGE_MESSAGE);
      }

      const updated = await goodsReceiptNoteRepository.findById(id, tx);
      if (!updated) {
        throw new AppError(NOT_FOUND_MESSAGE);
      }
      return updated;
    });
  },

  // DRAFT -> CANCELLED only — a RECEIVED GRN represents goods that have
  // physically entered the building and cannot be silently un-received
  // (43-goods-receipt-note.md's Business Rules).
  async cancelGoodsReceiptNote(id: string): Promise<GoodsReceiptNoteDetail> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "purchase", "edit");

    const count = await goodsReceiptNoteRepository.updateStatus(prisma, id, user.companyId, ["DRAFT"], "CANCELLED");
    return afterTransition(id, count);
  },

  /**
   * `RECEIVED -> INVOICED`, called exclusively by Purchase Invoice's posting
   * flow (feature-spec 44, not yet implemented — this method has no caller
   * within this spec's own scope beyond its own tests, the forward-
   * infrastructure pattern feature-spec 36 established for
   * salesOrderService.applyDelivery). Idempotent: a second call once already
   * INVOICED is a defensive no-op rather than an error, since a Purchase
   * Invoice cancel/retry path could otherwise double-call it. Accepts an
   * optional transaction client so the caller can participate in its own
   * posting transaction (the Voucher Engine `tx?` convention).
   */
  async markInvoiced(goodsReceiptNoteId: string, tx?: Prisma.TransactionClient): Promise<void> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "purchase", "edit");

    const client = tx ?? prisma;
    const existing = await goodsReceiptNoteRepository.findById(goodsReceiptNoteId, client);
    if (!existing || existing.companyId !== user.companyId) {
      throw new AppError(NOT_FOUND_MESSAGE);
    }
    if (existing.status === "INVOICED") {
      return;
    }

    const count = await goodsReceiptNoteRepository.updateStatus(
      client,
      goodsReceiptNoteId,
      user.companyId,
      ["RECEIVED"],
      "INVOICED"
    );
    if (count === 0) {
      // The guarded write can also lose to a genuinely concurrent
      // markInvoiced call rather than an invalid state — re-check before
      // rejecting, so two truly simultaneous calls are both idempotent
      // no-ops (delivery-challan-service.ts's identical review fix).
      const current = await goodsReceiptNoteRepository.findById(goodsReceiptNoteId, client);
      if (current?.status === "INVOICED") {
        return;
      }
      throw new AppError(CANNOT_CHANGE_MESSAGE);
    }
  },
};
