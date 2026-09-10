import type { Prisma, PurchaseOrderStatus } from "@prisma/client";

import { AppError } from "@/lib/app-error";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { getCurrentFinancialYear } from "@/lib/current-financial-year";
import { assertPermission } from "@/lib/permissions";
import { isUniqueConstraintError } from "@/lib/prisma-errors";
import { prisma } from "@/lib/prisma";
import { runInTransaction } from "@/lib/transaction";
import { documentNumberEngine } from "@/engines/document-number/document-number-engine";
import { gstEngine } from "@/engines/gst/gst-engine";
import type { CalculateLineInput, DocumentGroupResult, SupplyType } from "@/engines/gst/types";
import { supplierService } from "@/modules/suppliers/services/supplier-service";
import {
  purchaseOrderRepository,
  type PurchaseOrderHeaderPersistData,
  type PurchaseOrderLinePersistData,
  type ReceiptLine,
} from "@/modules/purchase-orders/repositories/purchase-order-repository";
import {
  computeTaxableAmountPre,
  sumHeaderGrossTotals,
} from "@/modules/purchase-orders/utils/purchase-order-calculations";
import {
  createPurchaseOrderSchema,
  previewPurchaseOrderSchema,
  toUtcDate,
  updatePurchaseOrderSchema,
  type CreatePurchaseOrderInput,
  type PreviewPurchaseOrderInput,
  type PurchaseOrderLineInput,
  type UpdatePurchaseOrderInput,
} from "@/modules/purchase-orders/validation/purchase-order-schema";
import type {
  PurchaseOrderDetail,
  PurchaseOrderFormOptions,
  PurchaseOrderLineComputation,
  PurchaseOrderListFilters,
  PurchaseOrderListRow,
  PurchaseOrderPreview,
  PurchaseOrderProductOption,
  PurchaseOrderTotals,
} from "@/types/purchase-order";

type PrismaClientOrTransaction = typeof prisma | Prisma.TransactionClient;

const NOT_FOUND_MESSAGE = "Purchase order not found.";
const SUPPLIER_NOT_FOUND_MESSAGE = "Supplier not found.";
const SUPPLIER_INACTIVE_MESSAGE = "Selected supplier is inactive.";
const NO_FINANCIAL_YEAR_MESSAGE = "Select a financial year before working with purchase orders.";
const NO_COMPANY_STATE_MESSAGE =
  "Set your company's GST state before creating a purchase order (Company > Edit Profile).";
// One message for every rejected status transition — mirrors
// sales-order-service.ts's CANNOT_CHANGE_MESSAGE.
const CANNOT_CHANGE_MESSAGE =
  "This purchase order can no longer be changed — it may have been confirmed, received against, closed, or cancelled. Please refresh.";
const RECEIPT_NOT_APPLICABLE_MESSAGE =
  "A receipt can only be applied to a confirmed purchase order that is not yet fully received.";
const RECEIPT_LINE_NOT_FOUND_MESSAGE = "One or more received lines do not belong to this purchase order.";
const RECEIPT_QUANTITY_INVALID_MESSAGE = "Received quantity must be greater than zero.";
const RECEIPT_CONFLICT_MESSAGE =
  "This purchase order was updated by another receipt while applying this one. Please retry.";

// Tolerance-based comparison — the gst-calculation.ts/sales-order-service.ts
// float-drift idiom, reused here for the receivedQuantity <= quantity guard.
const QUANTITY_TOLERANCE = 1e-6;

const ZERO_TOTALS: PurchaseOrderTotals = {
  subtotal: 0,
  totalDiscount: 0,
  taxableAmount: 0,
  totalCgst: 0,
  totalSgst: 0,
  totalIgst: 0,
  totalCess: 0,
  grandTotal: 0,
};

// Unit-dependent, so enforced here (after the product/unit row loads) rather
// than as a static Zod bound — mirrors sales-order-service.ts's identical
// helper.
function assertQuantityPrecision(quantity: number, decimalPlaces: number): void {
  const factor = 10 ** decimalPlaces;
  if (Math.abs(quantity * factor - Math.round(quantity * factor)) >= 1e-6) {
    throw new AppError(
      decimalPlaces === 0
        ? "Quantity must be a whole number — the selected product's unit has 0 decimal places."
        : `Quantity can have at most ${decimalPlaces} decimal places — the selected product's unit's limit.`
    );
  }
}

interface BuiltLine {
  persist: PurchaseOrderLinePersistData;
  computation: Omit<PurchaseOrderLineComputation, "lineNumber">;
  calcInput: CalculateLineInput | null;
}

/**
 * Builds one line's persisted fields and display computation — mirrors
 * sales-order-service.ts's buildLine, minus the below-cost check (a
 * selling-side-only concept per code-standards.md's Pricing Rules: a
 * Purchase Order is negotiating what WE pay, so `rate` is never compared
 * against the product's own purchase cost).
 */
function buildLine(
  input: PurchaseOrderLineInput,
  product: PurchaseOrderProductOption,
  supplyType: SupplyType
): BuiltLine {
  assertQuantityPrecision(input.quantity, product.unitDecimalPlaces);

  const discountPercent = input.discountPercent ?? 0;
  const discountAmount = input.discountAmount ?? 0;
  const taxableAmountPre = computeTaxableAmountPre(input.quantity, input.rate, discountPercent, discountAmount);
  const isTaxedLine = taxableAmountPre > 0;

  const calcInput: CalculateLineInput | null = isTaxedLine
    ? {
        amount: taxableAmountPre,
        isInclusive: false,
        ratePercent: product.ratePercent,
        cessPercent: product.cessPercent,
        supplyType,
        isReverseCharge: false,
      }
    : null;

  const result = calcInput ? gstEngine.calculateLine(calcInput) : null;

  const persist: PurchaseOrderLinePersistData = {
    productId: product.id,
    quantity: input.quantity,
    rate: input.rate,
    discountPercent,
    discountAmount,
    ratePercent: product.ratePercent,
    cessPercent: product.cessPercent,
    taxableAmount: result?.taxableAmount ?? 0,
    cgst: result?.cgst ?? 0,
    sgst: result?.sgst ?? 0,
    igst: result?.igst ?? 0,
    cess: result?.cess ?? 0,
    totalAmount: result?.totalAmount ?? 0,
  };

  const computation: Omit<PurchaseOrderLineComputation, "lineNumber"> = {
    taxableAmount: persist.taxableAmount,
    cgst: persist.cgst,
    sgst: persist.sgst,
    igst: persist.igst,
    cess: persist.cess,
    totalAmount: persist.totalAmount,
    isHsnMissing: gstEngine.isHsnRequired(isTaxedLine, product.hsnCode),
    isGstRateMissing: isTaxedLine && !product.hasGstRate,
  };

  return { persist, computation, calcInput };
}

interface BuiltPurchaseOrder {
  lines: BuiltLine[];
  header: PurchaseOrderTotals;
  groups: DocumentGroupResult[];
}

/**
 * Composes every line via `buildLine`, then calls the GST Engine's
 * calculateDocument ONCE over every taxed line for the header totals —
 * mirrors sales-order-service.ts's buildSalesOrder exactly, including the
 * `strict` create-vs-preview distinction.
 */
function buildPurchaseOrder(
  lineInputs: readonly PurchaseOrderLineInput[],
  productsById: ReadonlyMap<string, PurchaseOrderProductOption>,
  supplyType: SupplyType,
  strict: boolean
): BuiltPurchaseOrder {
  if (lineInputs.length === 0) {
    return { lines: [], header: ZERO_TOTALS, groups: [] };
  }

  const lines = lineInputs.map((input) => {
    const product = productsById.get(input.productId);
    if (!product) {
      throw new AppError("One or more products were not found.");
    }
    return buildLine(input, product, supplyType);
  });

  const grossTotals = sumHeaderGrossTotals(
    lineInputs.map((input) => ({
      quantity: input.quantity,
      rate: input.rate,
      discountPercent: input.discountPercent ?? 0,
      discountAmount: input.discountAmount ?? 0,
    }))
  );

  const taxedInputs = lines
    .map((line) => line.calcInput)
    .filter((calcInput): calcInput is CalculateLineInput => calcInput !== null);

  if (taxedInputs.length === 0) {
    if (strict) {
      throw new AppError("A purchase order cannot consist entirely of zero-value lines.");
    }
    return {
      lines,
      header: { ...ZERO_TOTALS, subtotal: grossTotals.subtotal, totalDiscount: grossTotals.totalDiscount },
      groups: [],
    };
  }

  const documentResult = gstEngine.calculateDocument(taxedInputs);

  return {
    lines,
    header: {
      subtotal: grossTotals.subtotal,
      totalDiscount: grossTotals.totalDiscount,
      taxableAmount: documentResult.taxableAmount,
      totalCgst: documentResult.cgst,
      totalSgst: documentResult.sgst,
      totalIgst: documentResult.igst,
      totalCess: documentResult.cess,
      grandTotal: documentResult.totalAmount,
    },
    groups: documentResult.groups,
  };
}

async function loadProductsMap(
  client: PrismaClientOrTransaction,
  companyId: string,
  lineInputs: readonly PurchaseOrderLineInput[]
): Promise<Map<string, PurchaseOrderProductOption>> {
  const productIds = [...new Set(lineInputs.map((line) => line.productId))];
  const products = await purchaseOrderRepository.findProductsForLines(client, companyId, productIds);
  return new Map(products.map((product) => [product.id, product]));
}

async function verifySupplier(companyId: string, supplierId: string): Promise<void> {
  const supplier = await purchaseOrderRepository.findSupplierForOrder(prisma, companyId, supplierId);
  if (!supplier) {
    throw new AppError(SUPPLIER_NOT_FOUND_MESSAGE);
  }
  if (!supplier.isActive) {
    throw new AppError(SUPPLIER_INACTIVE_MESSAGE);
  }
}

/**
 * `determineSupplyType` computed ONCE per document — mirrors
 * sales-order-service.ts's resolveSupplyType exactly.
 */
async function resolveSupplyType(companyId: string, placeOfSupplyStateCode: string): Promise<SupplyType> {
  const companyStateCode = await purchaseOrderRepository.findCompanyStateCode(companyId);
  if (!companyStateCode) {
    throw new AppError(NO_COMPANY_STATE_MESSAGE);
  }
  return gstEngine.determineSupplyType(companyStateCode, placeOfSupplyStateCode);
}

function toHeaderPersistData(
  data: { supplierId: string; orderDate: string; expectedDeliveryDate?: string; placeOfSupplyStateCode: string; narration?: string },
  totals: PurchaseOrderTotals
): PurchaseOrderHeaderPersistData {
  return {
    supplierId: data.supplierId,
    orderDate: toUtcDate(data.orderDate),
    expectedDeliveryDate: data.expectedDeliveryDate ? toUtcDate(data.expectedDeliveryDate) : null,
    placeOfSupplyStateCode: data.placeOfSupplyStateCode,
    narration: data.narration ?? null,
    ...totals,
  };
}

async function requireFinancialYear(): Promise<{ id: string }> {
  const financialYear = await getCurrentFinancialYear();
  if (!financialYear) {
    throw new AppError(NO_FINANCIAL_YEAR_MESSAGE);
  }
  return financialYear;
}

async function afterTransition(id: string, count: number): Promise<PurchaseOrderDetail> {
  if (count === 0) {
    throw new AppError(CANNOT_CHANGE_MESSAGE);
  }
  const updated = await purchaseOrderRepository.findById(id);
  if (!updated) {
    throw new AppError(NOT_FOUND_MESSAGE);
  }
  return updated;
}

export const purchaseOrderService = {
  // Scoped to the active financial year — orderNumber is only unique per
  // (company, financial year) — mirrors salesOrderService.listSalesOrders.
  async listPurchaseOrders(filters: PurchaseOrderListFilters = {}): Promise<PurchaseOrderListRow[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "purchase", "view");

    const financialYear = await getCurrentFinancialYear();
    if (!financialYear) {
      return [];
    }

    return purchaseOrderRepository.findMany(user.companyId, financialYear.id, filters);
  },

  // Company-scoped only (not FY-scoped) — mirrors salesOrderService.getSalesOrder.
  // Accepts an optional transaction client so a posting-time caller (e.g.
  // purchaseInvoiceService.postPurchaseInvoice) can re-verify this row
  // through its own Serializable transaction's snapshot rather than the
  // global `prisma` singleton (code review finding on purchase-invoice-service.ts).
  async getPurchaseOrder(id: string, client: PrismaClientOrTransaction = prisma): Promise<PurchaseOrderDetail | null> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "purchase", "view");

    const purchaseOrder = await purchaseOrderRepository.findById(id, client);
    if (!purchaseOrder || purchaseOrder.companyId !== user.companyId) {
      return null;
    }
    return purchaseOrder;
  },

  /** `CONFIRMED`/`PARTIALLY_RECEIVED` orders for a supplier — the lookup
   * Goods Receipt Notes (feature-spec 43) read from. */
  async listOpenForSupplier(supplierId: string): Promise<PurchaseOrderListRow[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "purchase", "view");

    const financialYear = await getCurrentFinancialYear();
    if (!financialYear) {
      return [];
    }

    return purchaseOrderRepository.findOpenForSupplier(user.companyId, financialYear.id, supplierId);
  },

  async listPurchaseOrderFormOptions(): Promise<PurchaseOrderFormOptions> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "purchase", "view");

    const financialYear = await requireFinancialYear();

    const [suppliers, products, companyStateCode, preview] = await Promise.all([
      supplierService.listSelectableSuppliers(),
      purchaseOrderRepository.findOrderableProducts(user.companyId),
      purchaseOrderRepository.findCompanyStateCode(user.companyId),
      documentNumberEngine.previewNextNumber({
        companyId: user.companyId,
        financialYearId: financialYear.id,
        documentType: "PURCHASE_ORDER",
      }),
    ]);

    return {
      suppliers: suppliers.map((supplier) => ({
        id: supplier.id,
        name: supplier.ledger.name,
        isActive: supplier.isActive,
      })),
      products,
      companyStateCode,
      nextOrderNumber: preview.formatted,
    };
  },

  /** The live-editing preview — mirrors salesOrderService.previewSalesOrder. */
  async previewPurchaseOrder(input: PreviewPurchaseOrderInput): Promise<PurchaseOrderPreview> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "purchase", "view");

    const data = previewPurchaseOrderSchema.parse(input);
    if (data.lines.length === 0) {
      return { lines: [], totals: ZERO_TOTALS, groups: [] };
    }

    const supplyType = await resolveSupplyType(user.companyId, data.placeOfSupplyStateCode);
    const productsById = await loadProductsMap(prisma, user.companyId, data.lines);
    const built = buildPurchaseOrder(data.lines, productsById, supplyType, false);

    return {
      lines: built.lines.map((line, index) => ({ lineNumber: index + 1, ...line.computation })),
      totals: built.header,
      groups: built.groups,
    };
  },

  async createPurchaseOrder(input: CreatePurchaseOrderInput): Promise<PurchaseOrderDetail> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "purchase", "create");

    const financialYear = await requireFinancialYear();
    const data = createPurchaseOrderSchema.parse(input);

    await verifySupplier(user.companyId, data.supplierId);
    const supplyType = await resolveSupplyType(user.companyId, data.placeOfSupplyStateCode);
    const productsById = await loadProductsMap(prisma, user.companyId, data.lines);
    const built = buildPurchaseOrder(data.lines, productsById, supplyType, true);

    const header = toHeaderPersistData(data, built.header);
    const lines = built.lines.map((line) => line.persist);

    // ensureSequence must run in its own short-lived statement BEFORE the
    // posting transaction opens — the Document Number Engine's documented
    // contract, sales-order-service.ts's createSalesOrder precedent.
    await documentNumberEngine.ensureSequence(user.companyId, financialYear.id, "PURCHASE_ORDER");

    try {
      return await runInTransaction(async (tx) => {
        const generated = await documentNumberEngine.generateNumber(tx, {
          companyId: user.companyId,
          financialYearId: financialYear.id,
          documentType: "PURCHASE_ORDER",
        });

        return purchaseOrderRepository.create(tx, user.companyId, financialYear.id, header, lines, generated, user.id);
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      if (isUniqueConstraintError(error)) {
        throw new AppError("A purchase order with this number already exists for this financial year.");
      }
      throw error;
    }
  },

  // Only reachable while DRAFT (42-purchase-orders.md: "Confirming... freezes
  // the header and line quantities/pricing") — checked before AND, atomically,
  // inside the write transaction, the sales-order-service.ts double-check
  // pattern. Never regenerates orderNumber.
  async updatePurchaseOrder(id: string, input: UpdatePurchaseOrderInput): Promise<PurchaseOrderDetail> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "purchase", "edit");

    const existing = await purchaseOrderRepository.findById(id);
    if (!existing || existing.companyId !== user.companyId) {
      throw new AppError(NOT_FOUND_MESSAGE);
    }
    if (existing.status !== "DRAFT") {
      throw new AppError(CANNOT_CHANGE_MESSAGE);
    }

    const data = updatePurchaseOrderSchema.parse(input);
    await verifySupplier(user.companyId, data.supplierId);
    const supplyType = await resolveSupplyType(user.companyId, data.placeOfSupplyStateCode);
    const productsById = await loadProductsMap(prisma, user.companyId, data.lines);
    const built = buildPurchaseOrder(data.lines, productsById, supplyType, true);

    const updated = await runInTransaction((tx) =>
      purchaseOrderRepository.replaceItemsAndUpdate(
        tx,
        id,
        user.companyId,
        ["DRAFT"],
        toHeaderPersistData(data, built.header),
        built.lines.map((line) => line.persist)
      )
    );
    if (!updated) {
      throw new AppError(CANNOT_CHANGE_MESSAGE);
    }
    return updated;
  },

  async confirmPurchaseOrder(id: string): Promise<PurchaseOrderDetail> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "purchase", "edit");
    const count = await purchaseOrderRepository.updateStatus(prisma, id, user.companyId, ["DRAFT"], "CONFIRMED");
    return afterTransition(id, count);
  },

  // Manual staff action confirming no further fulfillment is expected —
  // 42-purchase-orders.md's Business Rules.
  async closePurchaseOrder(id: string): Promise<PurchaseOrderDetail> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "purchase", "edit");
    const count = await purchaseOrderRepository.updateStatus(prisma, id, user.companyId, ["RECEIVED"], "CLOSED");
    return afterTransition(id, count);
  },

  /**
   * `DRAFT`/`CONFIRMED` -> `CANCELLED` only — once any receipt has been
   * applied, `applyReceipt` has already moved the order to
   * `PARTIALLY_RECEIVED`/`RECEIVED`, so restricting the `from` set to
   * `["DRAFT", "CONFIRMED"]` is itself sufficient to enforce
   * 42-purchase-orders.md's "only while no Goods Receipt Note has been posted
   * against it" rule — no separate receipt-existence check is needed. The
   * permission tier steps up from "edit" to "approve" once a supplier
   * commitment (CONFIRMED) is being reversed, mirroring
   * sales-order-service.ts's identical posture.
   */
  async cancelPurchaseOrder(id: string): Promise<PurchaseOrderDetail> {
    const user = await getCurrentCompanyUser();

    const existing = await purchaseOrderRepository.findById(id);
    if (!existing || existing.companyId !== user.companyId) {
      throw new AppError(NOT_FOUND_MESSAGE);
    }

    await assertPermission(user, "purchase", existing.status === "CONFIRMED" ? "approve" : "edit");

    const count = await purchaseOrderRepository.updateStatus(
      prisma,
      id,
      user.companyId,
      ["DRAFT", "CONFIRMED"],
      "CANCELLED"
    );
    return afterTransition(id, count);
  },

  /**
   * The only entry point that increments `receivedQuantity` and recomputes
   * status — called exclusively by Goods Receipt Note's posting flow
   * (feature-spec 43), which does not exist yet; this method has no caller
   * within this spec's own scope beyond its own tests, matching the
   * forward-infrastructure pattern feature-spec 36 established for
   * Sales Order's own `applyDelivery`. Accepts an optional transaction client
   * so a future caller can participate in its own posting transaction (the
   * Voucher Engine `tx?` convention).
   *
   * `CONFIRMED -> PARTIALLY_RECEIVED` fires whenever ANY line has
   * `receivedQuantity > 0` while the order is not yet fully received —
   * order-wide progress, not a single line's own partial state.
   * `-> RECEIVED` fires only when EVERY line's `receivedQuantity ===
   * quantity`. An order can never remain `CONFIRMED` once any receipt has
   * been applied.
   */
  async applyReceipt(
    purchaseOrderId: string,
    lines: readonly ReceiptLine[],
    tx?: Prisma.TransactionClient
  ): Promise<PurchaseOrderDetail> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "purchase", "edit");

    const run = async (client: Prisma.TransactionClient): Promise<PurchaseOrderDetail> => {
      const existing = await purchaseOrderRepository.findById(purchaseOrderId, client);
      if (!existing || existing.companyId !== user.companyId) {
        throw new AppError(NOT_FOUND_MESSAGE);
      }
      if (existing.status !== "CONFIRMED" && existing.status !== "PARTIALLY_RECEIVED") {
        throw new AppError(RECEIPT_NOT_APPLICABLE_MESSAGE);
      }

      const itemsById = new Map(existing.items.map((item) => [item.id, item]));
      const nextReceived = new Map(existing.items.map((item) => [item.id, item.receivedQuantity]));

      for (const line of lines) {
        const item = itemsById.get(line.purchaseOrderItemId);
        if (!item) {
          throw new AppError(RECEIPT_LINE_NOT_FOUND_MESSAGE);
        }
        if (line.quantity <= 0) {
          throw new AppError(RECEIPT_QUANTITY_INVALID_MESSAGE);
        }
        const updatedQuantity = (nextReceived.get(item.id) ?? 0) + line.quantity;
        if (updatedQuantity > item.quantity + QUANTITY_TOLERANCE) {
          throw new AppError(
            `Received quantity for ${item.product.name} cannot exceed the ordered quantity.`
          );
        }
        nextReceived.set(item.id, updatedQuantity);
      }

      await purchaseOrderRepository.incrementReceivedQuantities(client, lines);

      const isFullyReceived = existing.items.every(
        (item) => (nextReceived.get(item.id) ?? 0) >= item.quantity - QUANTITY_TOLERANCE
      );
      const nextStatus: PurchaseOrderStatus = isFullyReceived ? "RECEIVED" : "PARTIALLY_RECEIVED";

      if (nextStatus !== existing.status) {
        // Guarded (WHERE status = existing.status) — a concurrent applyReceipt
        // call against a different line of the SAME order could have already
        // advanced the status between this transaction's read above and this
        // write, in which case this transaction's `nextReceived` snapshot is
        // stale. A lost race here must abort the WHOLE transaction —
        // including the receivedQuantity increments just applied above —
        // rather than silently commit line-level progress under a status
        // computed from stale data. Throwing here rolls back everything in
        // this transaction; the caller retries with a fresh read.
        const count = await purchaseOrderRepository.updateStatus(
          client,
          purchaseOrderId,
          user.companyId,
          [existing.status],
          nextStatus
        );
        if (count === 0) {
          throw new AppError(RECEIPT_CONFLICT_MESSAGE);
        }
      }

      const updated = await purchaseOrderRepository.findById(purchaseOrderId, client);
      if (!updated) {
        throw new AppError(NOT_FOUND_MESSAGE);
      }
      return updated;
    };

    if (tx) {
      return run(tx);
    }
    return runInTransaction(run);
  },
};
