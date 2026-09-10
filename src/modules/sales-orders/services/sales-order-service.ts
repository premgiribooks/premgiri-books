import type { Prisma, SalesOrderStatus } from "@prisma/client";

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
import { pricingEngine } from "@/engines/pricing/pricing-engine";
import { customerService } from "@/modules/customers/services/customer-service";
import { quotationService } from "@/modules/quotations/services/quotation-service";
import {
  salesOrderRepository,
  type DeliveryLine,
  type SalesOrderHeaderPersistData,
  type SalesOrderLinePersistData,
} from "@/modules/sales-orders/repositories/sales-order-repository";
import {
  computeTaxableAmountPre,
  sumHeaderGrossTotals,
} from "@/modules/sales-orders/utils/sales-order-calculations";
import {
  createSalesOrderSchema,
  previewSalesOrderSchema,
  toUtcDate,
  updateSalesOrderSchema,
  type CreateSalesOrderInput,
  type PreviewSalesOrderInput,
  type SalesOrderLineInput,
  type UpdateSalesOrderInput,
} from "@/modules/sales-orders/validation/sales-order-schema";
import type {
  ResolvedSalesOrderLinePrice,
  SalesOrderDetail,
  SalesOrderFormOptions,
  SalesOrderLineComputation,
  SalesOrderListFilters,
  SalesOrderListRow,
  SalesOrderPreview,
  SalesOrderProductOption,
  SalesOrderTotals,
} from "@/types/sales-order";

type PrismaClientOrTransaction = typeof prisma | Prisma.TransactionClient;

const NOT_FOUND_MESSAGE = "Sales order not found.";
const CUSTOMER_NOT_FOUND_MESSAGE = "Customer not found.";
const CUSTOMER_INACTIVE_MESSAGE = "Selected customer is inactive.";
const NO_FINANCIAL_YEAR_MESSAGE = "Select a financial year before working with sales orders.";
const NO_COMPANY_STATE_MESSAGE =
  "Set your company's GST state before creating a sales order (Company > Edit Profile).";
// One message for every rejected status transition — mirrors
// quotation-service.ts's CANNOT_CHANGE_MESSAGE.
const CANNOT_CHANGE_MESSAGE =
  "This sales order can no longer be changed — it may have been confirmed, delivered against, closed, or cancelled. Please refresh.";
const QUOTATION_NOT_CONVERTIBLE_MESSAGE =
  "Only a sent or accepted quotation can be converted to a sales order.";
const DELIVERY_NOT_APPLICABLE_MESSAGE =
  "Delivery can only be applied to a confirmed sales order that is not yet fully delivered.";
const DELIVERY_LINE_NOT_FOUND_MESSAGE = "One or more delivered lines do not belong to this sales order.";
const DELIVERY_QUANTITY_INVALID_MESSAGE = "Delivered quantity must be greater than zero.";
const DELIVERY_CONFLICT_MESSAGE =
  "This sales order was updated by another delivery while applying this one. Please retry.";

// Tolerance-based comparison — the gst-calculation.ts/pricing-engine.ts
// float-drift idiom, reused here for the deliveredQuantity <= quantity guard.
const QUANTITY_TOLERANCE = 1e-6;

const ZERO_TOTALS: SalesOrderTotals = {
  subtotal: 0,
  totalDiscount: 0,
  taxableAmount: 0,
  totalCgst: 0,
  totalSgst: 0,
  totalIgst: 0,
  totalCess: 0,
  grandTotal: 0,
};

function todayUtcDate(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

// Unit-dependent, so enforced here (after the product/unit row loads) rather
// than as a static Zod bound — mirrors quotation-service.ts's identical
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
  persist: SalesOrderLinePersistData;
  computation: Omit<SalesOrderLineComputation, "lineNumber">;
  calcInput: CalculateLineInput | null;
}

/**
 * Builds one line's persisted fields and display computation — mirrors
 * quotation-service.ts's buildLine exactly (36-sales-orders.md: "Line
 * calculation... identical to 35-quotations.md's rules").
 */
function buildLine(
  input: SalesOrderLineInput,
  product: SalesOrderProductOption,
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

  const persist: SalesOrderLinePersistData = {
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

  const computation: Omit<SalesOrderLineComputation, "lineNumber"> = {
    taxableAmount: persist.taxableAmount,
    cgst: persist.cgst,
    sgst: persist.sgst,
    igst: persist.igst,
    cess: persist.cess,
    totalAmount: persist.totalAmount,
    isBelowCost: product.purchasePrice !== null && input.rate < product.purchasePrice,
    isHsnMissing: gstEngine.isHsnRequired(isTaxedLine, product.hsnCode),
    isGstRateMissing: isTaxedLine && !product.hasGstRate,
  };

  return { persist, computation, calcInput };
}

interface BuiltSalesOrder {
  lines: BuiltLine[];
  header: SalesOrderTotals;
  groups: DocumentGroupResult[];
}

/**
 * Composes every line via `buildLine`, then calls the GST Engine's
 * calculateDocument ONCE over every taxed line for the header totals —
 * mirrors quotation-service.ts's buildQuotation exactly, including the
 * `strict` create-vs-preview distinction.
 */
function buildSalesOrder(
  lineInputs: readonly SalesOrderLineInput[],
  productsById: ReadonlyMap<string, SalesOrderProductOption>,
  supplyType: SupplyType,
  strict: boolean
): BuiltSalesOrder {
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
      throw new AppError("A sales order cannot consist entirely of zero-value lines.");
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
  lineInputs: readonly SalesOrderLineInput[]
): Promise<Map<string, SalesOrderProductOption>> {
  const productIds = [...new Set(lineInputs.map((line) => line.productId))];
  const products = await salesOrderRepository.findProductsForLines(client, companyId, productIds);
  return new Map(products.map((product) => [product.id, product]));
}

async function verifyCustomer(companyId: string, customerId: string): Promise<void> {
  const customer = await salesOrderRepository.findCustomerForOrder(prisma, companyId, customerId);
  if (!customer) {
    throw new AppError(CUSTOMER_NOT_FOUND_MESSAGE);
  }
  if (!customer.isActive) {
    throw new AppError(CUSTOMER_INACTIVE_MESSAGE);
  }
}

/**
 * `determineSupplyType` computed ONCE per document — mirrors
 * quotation-service.ts's resolveSupplyType exactly.
 */
async function resolveSupplyType(companyId: string, placeOfSupplyStateCode: string): Promise<SupplyType> {
  const companyStateCode = await salesOrderRepository.findCompanyStateCode(companyId);
  if (!companyStateCode) {
    throw new AppError(NO_COMPANY_STATE_MESSAGE);
  }
  return gstEngine.determineSupplyType(companyStateCode, placeOfSupplyStateCode);
}

function toHeaderPersistData(
  data: { customerId: string; orderDate: string; expectedDeliveryDate?: string; placeOfSupplyStateCode: string; narration?: string },
  totals: SalesOrderTotals,
  quotationId: string | null
): SalesOrderHeaderPersistData {
  return {
    customerId: data.customerId,
    orderDate: toUtcDate(data.orderDate),
    expectedDeliveryDate: data.expectedDeliveryDate ? toUtcDate(data.expectedDeliveryDate) : null,
    placeOfSupplyStateCode: data.placeOfSupplyStateCode,
    narration: data.narration ?? null,
    quotationId,
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

async function afterTransition(id: string, count: number): Promise<SalesOrderDetail> {
  if (count === 0) {
    throw new AppError(CANNOT_CHANGE_MESSAGE);
  }
  const updated = await salesOrderRepository.findById(id);
  if (!updated) {
    throw new AppError(NOT_FOUND_MESSAGE);
  }
  return updated;
}

/** Shared create path for both `createSalesOrder` (manual) and
 * `createFromQuotation` (converted) — everything past "I already have a
 * header + line inputs + optional quotationId" is identical. */
async function persistNewSalesOrder(
  companyId: string,
  financialYearId: string,
  header: SalesOrderHeaderPersistData,
  lines: SalesOrderLinePersistData[],
  createdByUserId: string
): Promise<SalesOrderDetail> {
  // ensureSequence must run in its own short-lived statement BEFORE the
  // posting transaction opens — the Document Number Engine's documented
  // contract, quotation-service.ts's createQuotation precedent.
  await documentNumberEngine.ensureSequence(companyId, financialYearId, "SALES_ORDER");

  try {
    return await runInTransaction(async (tx) => {
      const generated = await documentNumberEngine.generateNumber(tx, {
        companyId,
        financialYearId,
        documentType: "SALES_ORDER",
      });

      return salesOrderRepository.create(tx, companyId, financialYearId, header, lines, generated, createdByUserId);
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    if (isUniqueConstraintError(error)) {
      throw new AppError("A sales order with this number already exists for this financial year.");
    }
    throw error;
  }
}

export const salesOrderService = {
  // Scoped to the active financial year — orderNumber is only unique per
  // (company, financial year) — mirrors quotationService.listQuotations.
  async listSalesOrders(filters: SalesOrderListFilters = {}): Promise<SalesOrderListRow[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "sales", "view");

    const financialYear = await getCurrentFinancialYear();
    if (!financialYear) {
      return [];
    }

    return salesOrderRepository.findMany(user.companyId, financialYear.id, filters);
  },

  // Company-scoped only (not FY-scoped) — mirrors quotationService.getQuotation.
  async getSalesOrder(id: string): Promise<SalesOrderDetail | null> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "sales", "view");

    const salesOrder = await salesOrderRepository.findById(id);
    if (!salesOrder || salesOrder.companyId !== user.companyId) {
      return null;
    }
    return salesOrder;
  },

  /** `CONFIRMED`/`PARTIALLY_DELIVERED` orders for a customer — the lookup
   * Delivery Challans (feature-spec 37) reads from. */
  async listOpenForCustomer(customerId: string): Promise<SalesOrderListRow[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "sales", "view");

    const financialYear = await getCurrentFinancialYear();
    if (!financialYear) {
      return [];
    }

    return salesOrderRepository.findOpenForCustomer(user.companyId, financialYear.id, customerId);
  },

  async listSalesOrderFormOptions(): Promise<SalesOrderFormOptions> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "sales", "view");

    const financialYear = await requireFinancialYear();

    const [customers, products, companyStateCode, preview] = await Promise.all([
      customerService.listSelectableCustomers(),
      salesOrderRepository.findOrderableProducts(user.companyId),
      salesOrderRepository.findCompanyStateCode(user.companyId),
      documentNumberEngine.previewNextNumber({
        companyId: user.companyId,
        financialYearId: financialYear.id,
        documentType: "SALES_ORDER",
      }),
    ]);

    return {
      customers: customers.map((customer) => ({
        id: customer.id,
        name: customer.ledger.name,
        isActive: customer.isActive,
      })),
      products,
      companyStateCode,
      nextOrderNumber: preview.formatted,
    };
  },

  /** Read-only pass-through to the Pricing Engine — mirrors
   * quotationService.resolveLinePrice. */
  async resolveLinePrice(input: {
    productId: string;
    quantity: number;
    customerId?: string;
    asOfDate?: string;
  }): Promise<ResolvedSalesOrderLinePrice> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "sales", "view");

    const result = await pricingEngine.resolvePrice({
      companyId: user.companyId,
      productId: input.productId,
      quantity: input.quantity,
      customerId: input.customerId,
      asOfDate: input.asOfDate ? toUtcDate(input.asOfDate) : undefined,
    });

    return {
      price: result.price,
      source: result.source,
      isBelowCost: result.isBelowCost,
      purchaseCost: result.purchaseCost,
    };
  },

  /** The live-editing preview — mirrors quotationService.previewQuotation. */
  async previewSalesOrder(input: PreviewSalesOrderInput): Promise<SalesOrderPreview> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "sales", "view");

    const data = previewSalesOrderSchema.parse(input);
    if (data.lines.length === 0) {
      return { lines: [], totals: ZERO_TOTALS, groups: [] };
    }

    const supplyType = await resolveSupplyType(user.companyId, data.placeOfSupplyStateCode);
    const productsById = await loadProductsMap(prisma, user.companyId, data.lines);
    const built = buildSalesOrder(data.lines, productsById, supplyType, false);

    return {
      lines: built.lines.map((line, index) => ({ lineNumber: index + 1, ...line.computation })),
      totals: built.header,
      groups: built.groups,
    };
  },

  async createSalesOrder(input: CreateSalesOrderInput): Promise<SalesOrderDetail> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "sales", "create");

    const financialYear = await requireFinancialYear();
    const data = createSalesOrderSchema.parse(input);

    await verifyCustomer(user.companyId, data.customerId);
    const supplyType = await resolveSupplyType(user.companyId, data.placeOfSupplyStateCode);
    const productsById = await loadProductsMap(prisma, user.companyId, data.lines);
    const built = buildSalesOrder(data.lines, productsById, supplyType, true);

    return persistNewSalesOrder(
      user.companyId,
      financialYear.id,
      toHeaderPersistData(data, built.header, null),
      built.lines.map((line) => line.persist),
      user.id
    );
  },

  /**
   * Converts an ACCEPTED/SENT Quotation into a new DRAFT Sales Order — the
   * "Convert to Sales Order" action Quotation's detail page calls
   * (36-sales-orders.md's Business Rules). Copies customerId,
   * placeOfSupplyStateCode, and each line's productId/quantity/
   * discountPercent/discountAmount; rate and GST are RE-RESOLVED fresh
   * (a new resolvePrice + buildSalesOrder pass) rather than copied from the
   * quotation's stored snapshot, since prices may have moved since the
   * quotation was made. The source quotation's own snapshot is read-only
   * here and stays untouched.
   */
  async createFromQuotation(quotationId: string): Promise<SalesOrderDetail> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "sales", "create");

    const financialYear = await requireFinancialYear();

    const quotation = await quotationService.getQuotation(quotationId);
    if (!quotation) {
      throw new AppError("Quotation not found.");
    }
    if (quotation.status !== "ACCEPTED" && quotation.status !== "SENT") {
      throw new AppError(QUOTATION_NOT_CONVERTIBLE_MESSAGE);
    }

    await verifyCustomer(user.companyId, quotation.customerId);
    const supplyType = await resolveSupplyType(user.companyId, quotation.placeOfSupplyStateCode);

    const productIds = [...new Set(quotation.items.map((item) => item.productId))];
    const products = await salesOrderRepository.findProductsForLines(prisma, user.companyId, productIds);
    const productsById = new Map(products.map((product) => [product.id, product]));

    // Fresh price resolution per line — never the quotation's stored `rate`.
    // Falls back to the product's own recorded selling price when the
    // Pricing Engine has no applicable rule (source "NONE"), rather than a
    // silent 0 — the order stays DRAFT and reviewable/editable before
    // Confirm, so a fallback price is a safe, visible starting point, not a
    // silently posted one.
    const lineInputs: SalesOrderLineInput[] = [];
    for (const item of quotation.items) {
      const product = productsById.get(item.productId);
      if (!product) {
        throw new AppError("One or more products were not found.");
      }
      const resolved = await pricingEngine.resolvePrice({
        companyId: user.companyId,
        productId: item.productId,
        quantity: item.quantity,
        customerId: quotation.customerId,
      });
      lineInputs.push({
        productId: item.productId,
        quantity: item.quantity,
        rate: resolved.price ?? product.sellingPrice ?? 0,
        discountPercent: item.discountPercent || undefined,
        discountAmount: item.discountAmount || undefined,
      });
    }

    const built = buildSalesOrder(lineInputs, productsById, supplyType, true);

    const header = toHeaderPersistData(
      {
        customerId: quotation.customerId,
        orderDate: todayUtcDate().toISOString().slice(0, 10),
        placeOfSupplyStateCode: quotation.placeOfSupplyStateCode,
      },
      built.header,
      quotation.id
    );

    return persistNewSalesOrder(user.companyId, financialYear.id, header, built.lines.map((line) => line.persist), user.id);
  },

  // Only reachable while DRAFT (36-sales-orders.md: "Confirming... freezes
  // the header and line quantities/pricing") — checked before AND, atomically,
  // inside the write transaction, the quotation-service.ts double-check
  // pattern. Never regenerates orderNumber.
  async updateSalesOrder(id: string, input: UpdateSalesOrderInput): Promise<SalesOrderDetail> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "sales", "edit");

    const existing = await salesOrderRepository.findById(id);
    if (!existing || existing.companyId !== user.companyId) {
      throw new AppError(NOT_FOUND_MESSAGE);
    }
    if (existing.status !== "DRAFT") {
      throw new AppError(CANNOT_CHANGE_MESSAGE);
    }

    const data = updateSalesOrderSchema.parse(input);
    await verifyCustomer(user.companyId, data.customerId);
    const supplyType = await resolveSupplyType(user.companyId, data.placeOfSupplyStateCode);
    const productsById = await loadProductsMap(prisma, user.companyId, data.lines);
    const built = buildSalesOrder(data.lines, productsById, supplyType, true);

    const updated = await runInTransaction((tx) =>
      salesOrderRepository.replaceItemsAndUpdate(
        tx,
        id,
        user.companyId,
        ["DRAFT"],
        toHeaderPersistData(data, built.header, existing.quotationId),
        built.lines.map((line) => line.persist)
      )
    );
    if (!updated) {
      throw new AppError(CANNOT_CHANGE_MESSAGE);
    }
    return updated;
  },

  async confirmSalesOrder(id: string): Promise<SalesOrderDetail> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "sales", "edit");
    const count = await salesOrderRepository.updateStatus(prisma, id, user.companyId, ["DRAFT"], "CONFIRMED");
    return afterTransition(id, count);
  },

  // Manual staff action confirming no further fulfillment is expected —
  // 36-sales-orders.md's Business Rules.
  async closeSalesOrder(id: string): Promise<SalesOrderDetail> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "sales", "edit");
    const count = await salesOrderRepository.updateStatus(prisma, id, user.companyId, ["DELIVERED"], "CLOSED");
    return afterTransition(id, count);
  },

  /**
   * `DRAFT`/`CONFIRMED` -> `CANCELLED` only — once any delivery has been
   * applied, `applyDelivery` has already moved the order to
   * `PARTIALLY_DELIVERED`/`DELIVERED`, so restricting the `from` set to
   * `["DRAFT", "CONFIRMED"]` is itself sufficient to enforce
   * 36-sales-orders.md's "only while no Delivery Challan has been posted
   * against it" rule — no separate delivery-existence check is needed. The
   * permission tier steps up from "edit" to "approve" once a customer
   * commitment (CONFIRMED) is being reversed, mirroring 35-quotations.md's
   * Accept/Reject posture. The spec's "friendly error naming the challan" is
   * unreachable within this spec's own scope (no code path here can create a
   * delivery yet) — revisit the message once feature-spec 37 exists.
   */
  async cancelSalesOrder(id: string): Promise<SalesOrderDetail> {
    const user = await getCurrentCompanyUser();

    const existing = await salesOrderRepository.findById(id);
    if (!existing || existing.companyId !== user.companyId) {
      throw new AppError(NOT_FOUND_MESSAGE);
    }

    await assertPermission(user, "sales", existing.status === "CONFIRMED" ? "approve" : "edit");

    const count = await salesOrderRepository.updateStatus(
      prisma,
      id,
      user.companyId,
      ["DRAFT", "CONFIRMED"],
      "CANCELLED"
    );
    return afterTransition(id, count);
  },

  /**
   * The only entry point that increments `deliveredQuantity` and recomputes
   * status — called exclusively by Delivery Challan's posting flow
   * (feature-spec 37), which does not exist yet; this method has no caller
   * within this spec's own scope beyond its own tests, matching the
   * forward-infrastructure pattern feature-spec 34 established for
   * branch-less documents. Accepts an optional transaction client so a
   * future caller can participate in its own posting transaction (the
   * Voucher Engine `tx?` convention).
   *
   * `CONFIRMED -> PARTIALLY_DELIVERED` fires whenever ANY line has
   * `deliveredQuantity > 0` while the order is not yet fully delivered —
   * order-wide progress, not a single line's own partial state.
   * `-> DELIVERED` fires only when EVERY line's `deliveredQuantity ===
   * quantity`. An order can never remain `CONFIRMED` once any delivery has
   * been applied.
   */
  async applyDelivery(
    salesOrderId: string,
    lines: readonly DeliveryLine[],
    tx?: Prisma.TransactionClient
  ): Promise<SalesOrderDetail> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "sales", "edit");

    const run = async (client: Prisma.TransactionClient): Promise<SalesOrderDetail> => {
      const existing = await salesOrderRepository.findById(salesOrderId, client);
      if (!existing || existing.companyId !== user.companyId) {
        throw new AppError(NOT_FOUND_MESSAGE);
      }
      if (existing.status !== "CONFIRMED" && existing.status !== "PARTIALLY_DELIVERED") {
        throw new AppError(DELIVERY_NOT_APPLICABLE_MESSAGE);
      }

      const itemsById = new Map(existing.items.map((item) => [item.id, item]));
      const nextDelivered = new Map(existing.items.map((item) => [item.id, item.deliveredQuantity]));

      for (const line of lines) {
        const item = itemsById.get(line.salesOrderItemId);
        if (!item) {
          throw new AppError(DELIVERY_LINE_NOT_FOUND_MESSAGE);
        }
        if (line.quantity <= 0) {
          throw new AppError(DELIVERY_QUANTITY_INVALID_MESSAGE);
        }
        const updatedQuantity = (nextDelivered.get(item.id) ?? 0) + line.quantity;
        if (updatedQuantity > item.quantity + QUANTITY_TOLERANCE) {
          throw new AppError(
            `Delivered quantity for ${item.product.name} cannot exceed the ordered quantity.`
          );
        }
        nextDelivered.set(item.id, updatedQuantity);
      }

      await salesOrderRepository.incrementDeliveredQuantities(client, lines);

      const isFullyDelivered = existing.items.every(
        (item) => (nextDelivered.get(item.id) ?? 0) >= item.quantity - QUANTITY_TOLERANCE
      );
      const nextStatus: SalesOrderStatus = isFullyDelivered ? "DELIVERED" : "PARTIALLY_DELIVERED";

      if (nextStatus !== existing.status) {
        // Guarded (WHERE status = existing.status) — a concurrent applyDelivery
        // call against a different line of the SAME order could have already
        // advanced the status between this transaction's read above and this
        // write, in which case this transaction's `nextDelivered` snapshot is
        // stale. Unlike confirmSalesOrder/closeSalesOrder/cancelSalesOrder
        // (which surface a lost race to the caller via afterTransition), a
        // lost race here must abort the WHOLE transaction — including the
        // deliveredQuantity increments just applied above — rather than
        // silently commit line-level progress under a status computed from
        // stale data. Throwing here rolls back everything in this
        // transaction; the caller retries with a fresh read.
        const count = await salesOrderRepository.updateStatus(
          client,
          salesOrderId,
          user.companyId,
          [existing.status],
          nextStatus
        );
        if (count === 0) {
          throw new AppError(DELIVERY_CONFLICT_MESSAGE);
        }
      }

      const updated = await salesOrderRepository.findById(salesOrderId, client);
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
