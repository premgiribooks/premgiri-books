import { Prisma } from "@prisma/client";

import { AppError } from "@/lib/app-error";
import { getCurrentCompanyUser } from "@/lib/current-user";
import { getCurrentFinancialYear } from "@/lib/current-financial-year";
import { assertPermission } from "@/lib/permissions";
import { isRetryableTransactionError, isUniqueConstraintError } from "@/lib/prisma-errors";
import { prisma } from "@/lib/prisma";
import { runInTransaction } from "@/lib/transaction";
import { documentNumberEngine } from "@/engines/document-number/document-number-engine";
import { customerService } from "@/modules/customers/services/customer-service";
import {
  deliveryChallanRepository,
  type DeliveryChallanHeaderPersistData,
  type DeliveryChallanLinePersistData,
} from "@/modules/delivery-challans/repositories/delivery-challan-repository";
import {
  createDeliveryChallanSchema,
  toUtcDate,
  updateDeliveryChallanSchema,
  type CreateDeliveryChallanInput,
  type DeliveryChallanLineInput,
  type UpdateDeliveryChallanInput,
} from "@/modules/delivery-challans/validation/delivery-challan-schema";
import type { DeliveryLine } from "@/modules/sales-orders/repositories/sales-order-repository";
import { salesOrderService } from "@/modules/sales-orders/services/sales-order-service";
import type {
  DeliveryChallanDetail,
  DeliveryChallanFormOptions,
  DeliveryChallanListFilters,
  DeliveryChallanListRow,
  DeliveryChallanProductOption,
  DeliveryChallanWarehouseOption,
  OpenSalesOrderLineOption,
  SalesOrderPrefill,
} from "@/types/delivery-challan";
import type { SalesOrderDetail } from "@/types/sales-order";

// 37-delivery-challans.md lists a `createFromSalesOrder(salesOrderId, lines)`
// service method. Deliberately NOT implemented as a separate persist path:
// unlike Quotation -> Sales Order (spec 36's createFromQuotation, which
// copies/re-resolves everything needed to persist immediately, no further
// user input required), a Delivery Challan line needs a per-line WAREHOUSE
// no prior document can supply — so "convert from a Sales Order" is
// inherently a form-fill step here, not a one-click persist-then-edit.
// `getSalesOrderPrefill` below is the read-only lookup the "New Delivery
// Challan" page uses (via ?salesOrderId=) to pre-fill that form; the actual
// write always goes through the single `createDeliveryChallan` below, whose
// schema already supports an optional `salesOrderId` + per-line
// `salesOrderItemId`. Recorded in progress-tracker.md.

type PrismaClientOrTransaction = typeof prisma | Prisma.TransactionClient;

const NOT_FOUND_MESSAGE = "Delivery challan not found.";
const CUSTOMER_NOT_FOUND_MESSAGE = "Customer not found.";
const CUSTOMER_INACTIVE_MESSAGE = "Selected customer is inactive.";
const NO_FINANCIAL_YEAR_MESSAGE = "Select a financial year before working with delivery challans.";
const CANNOT_CHANGE_MESSAGE =
  "This delivery challan can no longer be changed — it may have been dispatched, invoiced, or cancelled. Please refresh.";
const SALES_ORDER_NOT_FOUND_MESSAGE = "Sales order not found.";
const SALES_ORDER_NOT_OPEN_MESSAGE =
  "Only a confirmed or partially delivered sales order can be linked to a delivery challan.";
const SALES_ORDER_CUSTOMER_MISMATCH_MESSAGE = "The linked sales order does not belong to the selected customer.";
const LINE_ITEM_NOT_FOUND_MESSAGE = "One or more lines reference an item that does not belong to the linked sales order.";
const LINE_PRODUCT_MISMATCH_MESSAGE = "One or more lines' product does not match the linked sales order item.";
const LINE_EXCEEDS_REMAINING_MESSAGE = "One or more lines exceed the remaining quantity on the linked sales order.";
const PRODUCT_NOT_FOUND_MESSAGE = "One or more products were not found.";
const WAREHOUSE_NOT_FOUND_MESSAGE = "One or more warehouses were not found.";
const DISPATCH_CONFLICT_MESSAGE =
  "This delivery challan's linked sales order changed due to another request. Please try again.";

// Tolerance-based comparison — the sales-order-service.ts float-drift idiom,
// reused here for the remainingQuantity <= quantity guard.
const QUANTITY_TOLERANCE = 1e-6;

// Dispatching a linked challan runs Serializable + bounded retry, the same
// contract the Inventory Engine's OUT-batch posting and Sales Order's own
// applyDelivery race guard use — two concurrent dispatches against the same
// order line cannot both observe the same pre-update remaining quantity and
// both succeed (37-delivery-challans.md's Business Rules).
const SERIALIZABLE_RETRY = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  retryable: isRetryableTransactionError,
  conflictMessage: DISPATCH_CONFLICT_MESSAGE,
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

async function loadProductsMap(
  client: PrismaClientOrTransaction,
  companyId: string,
  lineInputs: readonly DeliveryChallanLineInput[]
): Promise<Map<string, DeliveryChallanProductOption>> {
  const productIds = [...new Set(lineInputs.map((line) => line.productId))];
  const products = await deliveryChallanRepository.findProductsForLines(client, companyId, productIds);
  return new Map(products.map((product) => [product.id, product]));
}

async function loadWarehousesMap(
  client: PrismaClientOrTransaction,
  companyId: string,
  lineInputs: readonly DeliveryChallanLineInput[]
): Promise<Map<string, DeliveryChallanWarehouseOption>> {
  const warehouseIds = [...new Set(lineInputs.map((line) => line.warehouseId))];
  const warehouses = await deliveryChallanRepository.findWarehousesForLines(client, companyId, warehouseIds);
  return new Map(warehouses.map((warehouse) => [warehouse.id, warehouse]));
}

async function verifyCustomer(companyId: string, customerId: string): Promise<void> {
  const customer = await deliveryChallanRepository.findCustomerForChallan(prisma, companyId, customerId);
  if (!customer) {
    throw new AppError(CUSTOMER_NOT_FOUND_MESSAGE);
  }
  if (!customer.isActive) {
    throw new AppError(CUSTOMER_INACTIVE_MESSAGE);
  }
}

async function resolveLinkedSalesOrder(
  salesOrderId: string | undefined,
  customerId: string
): Promise<SalesOrderDetail | null> {
  if (!salesOrderId) {
    return null;
  }
  const salesOrder = await salesOrderService.getSalesOrder(salesOrderId);
  if (!salesOrder) {
    throw new AppError(SALES_ORDER_NOT_FOUND_MESSAGE);
  }
  if (salesOrder.status !== "CONFIRMED" && salesOrder.status !== "PARTIALLY_DELIVERED") {
    throw new AppError(SALES_ORDER_NOT_OPEN_MESSAGE);
  }
  if (salesOrder.customerId !== customerId) {
    throw new AppError(SALES_ORDER_CUSTOMER_MISMATCH_MESSAGE);
  }
  return salesOrder;
}

/**
 * Validates and builds every line's persisted fields. When `salesOrder` is
 * given, each line's (schema-guaranteed-present) `salesOrderItemId` must
 * belong to that order, match the line's own `productId`, and stay within
 * the item's remaining quantity — a soft, friendly-error check; the
 * authoritative, race-safe re-check happens inside dispatchDeliveryChallan's
 * Serializable transaction via salesOrderService.applyDelivery.
 */
function buildLines(
  lineInputs: readonly DeliveryChallanLineInput[],
  productsById: ReadonlyMap<string, DeliveryChallanProductOption>,
  warehousesById: ReadonlyMap<string, DeliveryChallanWarehouseOption>,
  salesOrder: SalesOrderDetail | null
): DeliveryChallanLinePersistData[] {
  const salesOrderItemsById = salesOrder ? new Map(salesOrder.items.map((item) => [item.id, item])) : null;

  return lineInputs.map((input) => {
    const product = productsById.get(input.productId);
    if (!product) {
      throw new AppError(PRODUCT_NOT_FOUND_MESSAGE);
    }
    const warehouse = warehousesById.get(input.warehouseId);
    if (!warehouse) {
      throw new AppError(WAREHOUSE_NOT_FOUND_MESSAGE);
    }
    assertQuantityPrecision(input.quantity, product.unitDecimalPlaces);

    if (salesOrderItemsById) {
      const item = salesOrderItemsById.get(input.salesOrderItemId as string);
      if (!item) {
        throw new AppError(LINE_ITEM_NOT_FOUND_MESSAGE);
      }
      if (item.productId !== input.productId) {
        throw new AppError(LINE_PRODUCT_MISMATCH_MESSAGE);
      }
      const remaining = item.quantity - item.deliveredQuantity;
      if (input.quantity > remaining + QUANTITY_TOLERANCE) {
        throw new AppError(LINE_EXCEEDS_REMAINING_MESSAGE);
      }
    }

    return {
      productId: input.productId,
      warehouseId: input.warehouseId,
      quantity: input.quantity,
      salesOrderItemId: input.salesOrderItemId ?? null,
    };
  });
}

function toHeaderPersistData(data: {
  customerId: string;
  challanDate: string;
  narration?: string;
  salesOrderId?: string;
}): DeliveryChallanHeaderPersistData {
  return {
    customerId: data.customerId,
    challanDate: toUtcDate(data.challanDate),
    salesOrderId: data.salesOrderId ?? null,
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

async function afterTransition(id: string, count: number): Promise<DeliveryChallanDetail> {
  if (count === 0) {
    throw new AppError(CANNOT_CHANGE_MESSAGE);
  }
  const updated = await deliveryChallanRepository.findById(id);
  if (!updated) {
    throw new AppError(NOT_FOUND_MESSAGE);
  }
  return updated;
}

async function persistNewDeliveryChallan(
  companyId: string,
  financialYearId: string,
  header: DeliveryChallanHeaderPersistData,
  lines: DeliveryChallanLinePersistData[],
  createdByUserId: string
): Promise<DeliveryChallanDetail> {
  // ensureSequence must run in its own short-lived statement BEFORE the
  // posting transaction opens — the Document Number Engine's documented
  // contract, sales-order-service.ts's persistNewSalesOrder precedent.
  await documentNumberEngine.ensureSequence(companyId, financialYearId, "DELIVERY_CHALLAN");

  try {
    return await runInTransaction(async (tx) => {
      const generated = await documentNumberEngine.generateNumber(tx, {
        companyId,
        financialYearId,
        documentType: "DELIVERY_CHALLAN",
      });

      return deliveryChallanRepository.create(tx, companyId, financialYearId, header, lines, generated, createdByUserId);
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    if (isUniqueConstraintError(error)) {
      throw new AppError("A delivery challan with this number already exists for this financial year.");
    }
    throw error;
  }
}

export const deliveryChallanService = {
  // Scoped to the active financial year — challanNumber is only unique per
  // (company, financial year) — mirrors salesOrderService.listSalesOrders.
  async listDeliveryChallans(filters: DeliveryChallanListFilters = {}): Promise<DeliveryChallanListRow[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "sales", "view");

    const financialYear = await getCurrentFinancialYear();
    if (!financialYear) {
      return [];
    }

    return deliveryChallanRepository.findMany(user.companyId, financialYear.id, filters);
  },

  // Company-scoped only (not FY-scoped) — mirrors salesOrderService.getSalesOrder.
  async getDeliveryChallan(id: string): Promise<DeliveryChallanDetail | null> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "sales", "view");

    const challan = await deliveryChallanRepository.findById(id);
    if (!challan || challan.companyId !== user.companyId) {
      return null;
    }
    return challan;
  },

  /** "Dispatched, not yet invoiced" — the lookup Sales Invoice (feature-spec
   * 38) reads from via `markInvoiced`. */
  async listDispatchedNotInvoiced(customerId: string): Promise<DeliveryChallanListRow[]> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "sales", "view");

    const financialYear = await getCurrentFinancialYear();
    if (!financialYear) {
      return [];
    }

    return deliveryChallanRepository.findDispatchedNotInvoiced(user.companyId, financialYear.id, customerId);
  },

  async listDeliveryChallanFormOptions(): Promise<DeliveryChallanFormOptions> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "sales", "view");

    const financialYear = await requireFinancialYear();

    const [customers, products, warehouses, preview] = await Promise.all([
      customerService.listSelectableCustomers(),
      deliveryChallanRepository.findDispatchableProducts(user.companyId),
      deliveryChallanRepository.findSelectableWarehouses(user.companyId),
      documentNumberEngine.previewNextNumber({
        companyId: user.companyId,
        financialYearId: financialYear.id,
        documentType: "DELIVERY_CHALLAN",
      }),
    ]);

    return {
      customers: customers.map((customer) => ({
        id: customer.id,
        name: customer.ledger.name,
        isActive: customer.isActive,
      })),
      products,
      warehouses,
      nextChallanNumber: preview.formatted,
    };
  },

  /** Read-only prefill lookup for "New Delivery Challan" reached via
   * `?salesOrderId=` — see this file's header comment for why this replaces
   * a dedicated `createFromSalesOrder` persist method. Returns null when the
   * order doesn't exist, isn't open, or belongs to another company. */
  async getSalesOrderPrefill(salesOrderId: string): Promise<SalesOrderPrefill | null> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "sales", "view");

    const salesOrder = await salesOrderService.getSalesOrder(salesOrderId);
    if (!salesOrder || (salesOrder.status !== "CONFIRMED" && salesOrder.status !== "PARTIALLY_DELIVERED")) {
      return null;
    }

    const openItems = salesOrder.items.filter(
      (item) => item.deliveredQuantity < item.quantity - QUANTITY_TOLERANCE
    );
    const productIds = [...new Set(openItems.map((item) => item.productId))];
    const products = await deliveryChallanRepository.findProductsForLines(prisma, user.companyId, productIds);
    const productsById = new Map(products.map((product) => [product.id, product]));

    const lines: OpenSalesOrderLineOption[] = openItems.map((item) => {
      const product = productsById.get(item.productId);
      return {
        salesOrderItemId: item.id,
        productId: item.productId,
        productName: item.product.name,
        productCode: item.product.productCode,
        unitSymbol: product?.unitSymbol ?? "",
        unitDecimalPlaces: product?.unitDecimalPlaces ?? 4,
        orderedQuantity: item.quantity,
        deliveredQuantity: item.deliveredQuantity,
        remainingQuantity: item.quantity - item.deliveredQuantity,
      };
    });

    return {
      salesOrderId: salesOrder.id,
      orderNumber: salesOrder.orderNumber,
      customerId: salesOrder.customerId,
      lines,
    };
  },

  async createDeliveryChallan(input: CreateDeliveryChallanInput): Promise<DeliveryChallanDetail> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "sales", "create");

    const financialYear = await requireFinancialYear();
    const data = createDeliveryChallanSchema.parse(input);

    await verifyCustomer(user.companyId, data.customerId);
    const salesOrder = await resolveLinkedSalesOrder(data.salesOrderId, data.customerId);

    const productsById = await loadProductsMap(prisma, user.companyId, data.lines);
    const warehousesById = await loadWarehousesMap(prisma, user.companyId, data.lines);
    const lines = buildLines(data.lines, productsById, warehousesById, salesOrder);

    return persistNewDeliveryChallan(user.companyId, financialYear.id, toHeaderPersistData(data), lines, user.id);
  },

  // Only reachable while DRAFT (37-delivery-challans.md: "Editable while
  // DRAFT") — checked before AND, atomically, inside the write transaction,
  // the sales-order-service.ts double-check pattern. Never regenerates
  // challanNumber.
  async updateDeliveryChallan(id: string, input: UpdateDeliveryChallanInput): Promise<DeliveryChallanDetail> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "sales", "edit");

    const existing = await deliveryChallanRepository.findById(id);
    if (!existing || existing.companyId !== user.companyId) {
      throw new AppError(NOT_FOUND_MESSAGE);
    }
    if (existing.status !== "DRAFT") {
      throw new AppError(CANNOT_CHANGE_MESSAGE);
    }

    const data = updateDeliveryChallanSchema.parse(input);
    await verifyCustomer(user.companyId, data.customerId);
    const salesOrder = await resolveLinkedSalesOrder(data.salesOrderId, data.customerId);

    const productsById = await loadProductsMap(prisma, user.companyId, data.lines);
    const warehousesById = await loadWarehousesMap(prisma, user.companyId, data.lines);
    const lines = buildLines(data.lines, productsById, warehousesById, salesOrder);

    const updated = await runInTransaction((tx) =>
      deliveryChallanRepository.replaceItemsAndUpdate(
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
   * `DRAFT -> DISPATCHED`, in one Serializable + bounded-retry transaction
   * (37-delivery-challans.md's Business Rules): re-validates every line's
   * product/warehouse are active, applies delivery to the linked Sales
   * Order (if any) atomically with this challan's own status flip, and
   * never touches the Inventory Engine (see that spec's Goal — Sales
   * Invoice, feature-spec 38, is the sole stock-out point in this phase).
   */
  async dispatchDeliveryChallan(id: string): Promise<DeliveryChallanDetail> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "sales", "edit");

    return runInTransaction(async (tx) => {
      const existing = await deliveryChallanRepository.findById(id, tx);
      if (!existing || existing.companyId !== user.companyId) {
        throw new AppError(NOT_FOUND_MESSAGE);
      }
      if (existing.status !== "DRAFT") {
        throw new AppError(CANNOT_CHANGE_MESSAGE);
      }

      const productIds = [...new Set(existing.items.map((item) => item.productId))];
      const warehouseIds = [...new Set(existing.items.map((item) => item.warehouseId))];
      const [products, warehouses] = await Promise.all([
        deliveryChallanRepository.findProductsForLines(tx, user.companyId, productIds),
        deliveryChallanRepository.findWarehousesForLines(tx, user.companyId, warehouseIds),
      ]);
      const productsById = new Map(products.map((product) => [product.id, product]));
      const warehousesById = new Map(warehouses.map((warehouse) => [warehouse.id, warehouse]));

      for (const item of existing.items) {
        const product = productsById.get(item.productId);
        if (!product || !product.isActive) {
          throw new AppError(`${item.product.name} is inactive and cannot be dispatched.`);
        }
        const warehouse = warehousesById.get(item.warehouseId);
        if (!warehouse || !warehouse.isActive) {
          throw new AppError(`${item.warehouse.name} is inactive and cannot be dispatched from.`);
        }
      }

      if (existing.salesOrderId) {
        const deliveryLines: DeliveryLine[] = existing.items
          .filter((item) => item.salesOrderItemId !== null)
          .map((item) => ({ salesOrderItemId: item.salesOrderItemId as string, quantity: item.quantity }));

        // Participates in THIS transaction (already Serializable) — the
        // remaining-quantity check and deliveredQuantity increment run
        // atomically with this challan's own status flip below.
        await salesOrderService.applyDelivery(existing.salesOrderId, deliveryLines, tx);
      }

      const count = await deliveryChallanRepository.updateStatus(tx, id, user.companyId, ["DRAFT"], "DISPATCHED");
      if (count === 0) {
        throw new AppError(CANNOT_CHANGE_MESSAGE);
      }

      const updated = await deliveryChallanRepository.findById(id, tx);
      if (!updated) {
        throw new AppError(NOT_FOUND_MESSAGE);
      }
      return updated;
    }, SERIALIZABLE_RETRY);
  },

  // DRAFT -> CANCELLED only — a DISPATCHED challan represents goods that
  // have physically left the building and cannot be silently un-dispatched
  // (37-delivery-challans.md's Business Rules).
  async cancelDeliveryChallan(id: string): Promise<DeliveryChallanDetail> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "sales", "edit");

    const count = await deliveryChallanRepository.updateStatus(prisma, id, user.companyId, ["DRAFT"], "CANCELLED");
    return afterTransition(id, count);
  },

  /**
   * `DISPATCHED -> INVOICED`, called exclusively by Sales Invoice's posting
   * flow (feature-spec 38, not yet implemented — this method has no caller
   * within this spec's own scope beyond its own tests, the forward-
   * infrastructure pattern feature-spec 36 established for
   * salesOrderService.applyDelivery). Idempotent: a second call once already
   * INVOICED is a defensive no-op rather than an error, since a Sales
   * Invoice cancel/retry path could otherwise double-call it. Accepts an
   * optional transaction client so the caller can participate in its own
   * posting transaction (the Voucher Engine `tx?` convention).
   */
  async markInvoiced(deliveryChallanId: string, tx?: Prisma.TransactionClient): Promise<void> {
    const user = await getCurrentCompanyUser();
    await assertPermission(user, "sales", "edit");

    const client = tx ?? prisma;
    const existing = await deliveryChallanRepository.findById(deliveryChallanId, client);
    if (!existing || existing.companyId !== user.companyId) {
      throw new AppError(NOT_FOUND_MESSAGE);
    }
    if (existing.status === "INVOICED") {
      return;
    }

    const count = await deliveryChallanRepository.updateStatus(
      client,
      deliveryChallanId,
      user.companyId,
      ["DISPATCHED"],
      "INVOICED"
    );
    if (count === 0) {
      // The guarded write can also lose to a genuinely concurrent markInvoiced
      // call rather than an invalid state — re-check before rejecting, so two
      // truly simultaneous calls are both idempotent no-ops (code review
      // finding: the sequential check above only catches the non-concurrent
      // case).
      const current = await deliveryChallanRepository.findById(deliveryChallanId, client);
      if (current?.status === "INVOICED") {
        return;
      }
      throw new AppError(CANNOT_CHANGE_MESSAGE);
    }
  },
};
