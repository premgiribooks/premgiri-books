import { Prisma, type DeliveryChallanStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { GeneratedNumber } from "@/engines/document-number/types";
import type {
  DeliveryChallanCustomerOption,
  DeliveryChallanDetail,
  DeliveryChallanItemDetail,
  DeliveryChallanListFilters,
  DeliveryChallanListRow,
  DeliveryChallanProductOption,
} from "@/types/delivery-challan";

type PrismaClientOrTransaction = typeof prisma | Prisma.TransactionClient;

const CUSTOMER_INCLUDE = {
  customer: { select: { id: true, isActive: true, ledger: { select: { name: true } } } },
} as const;

const SALES_ORDER_INCLUDE = {
  salesOrder: { select: { id: true, orderNumber: true } },
} as const;

const ITEM_INCLUDE = {
  items: {
    include: {
      product: { select: { id: true, name: true, productCode: true, isActive: true } },
    },
  },
} as const;

type DeliveryChallanListRowRaw = Prisma.DeliveryChallanGetPayload<{
  include: typeof CUSTOMER_INCLUDE & typeof SALES_ORDER_INCLUDE & { items: { select: { id: true } } };
}>;
type DeliveryChallanDetailRaw = Prisma.DeliveryChallanGetPayload<{
  include: typeof CUSTOMER_INCLUDE & typeof SALES_ORDER_INCLUDE & typeof ITEM_INCLUDE;
}>;

// Decimal -> number normalization at the repository boundary — the
// sales-order-repository.ts convention.
function toCustomerOption(raw: { id: string; isActive: boolean; ledger: { name: string } }): DeliveryChallanCustomerOption {
  return { id: raw.id, name: raw.ledger.name, isActive: raw.isActive };
}

function toDeliveryChallanListRow(raw: DeliveryChallanListRowRaw): DeliveryChallanListRow {
  const { items, customer, salesOrder, ...header } = raw;
  return {
    ...header,
    customer: toCustomerOption(customer),
    salesOrder,
    lineCount: items.length,
  };
}

function toDeliveryChallanDetail(raw: DeliveryChallanDetailRaw): DeliveryChallanDetail {
  const { items, customer, salesOrder, ...header } = raw;

  // Re-sorted by lineNumber — Prisma's `include` does not guarantee row
  // order (sales-order-repository.ts's identical note).
  const sortedItems: DeliveryChallanItemDetail[] = items
    .slice()
    .sort((a, b) => a.lineNumber - b.lineNumber)
    .map((item) => ({ ...item, quantity: item.quantity.toNumber() }));

  return {
    ...header,
    customer: toCustomerOption(customer),
    salesOrder,
    items: sortedItems,
  };
}

function buildWhere(
  companyId: string,
  financialYearId: string,
  filters: DeliveryChallanListFilters
): Prisma.DeliveryChallanWhereInput {
  const where: Prisma.DeliveryChallanWhereInput = { companyId, financialYearId };

  if (filters.status) {
    where.status = filters.status;
  }
  if (filters.customerId) {
    where.customerId = filters.customerId;
  }
  if (filters.fromDate || filters.toDate) {
    where.challanDate = {
      ...(filters.fromDate ? { gte: filters.fromDate } : {}),
      ...(filters.toDate ? { lte: filters.toDate } : {}),
    };
  }
  if (filters.search) {
    where.OR = [
      { challanNumber: { contains: filters.search, mode: "insensitive" } },
      { customer: { ledger: { name: { contains: filters.search, mode: "insensitive" } } } },
    ];
  }

  return where;
}

export interface DeliveryChallanLinePersistData {
  productId: string;
  quantity: number;
  salesOrderItemId: string | null;
}

export interface DeliveryChallanHeaderPersistData {
  customerId: string;
  challanDate: Date;
  salesOrderId: string | null;
  narration: string | null;
}

export const deliveryChallanRepository = {
  async findMany(
    companyId: string,
    financialYearId: string,
    filters: DeliveryChallanListFilters = {}
  ): Promise<DeliveryChallanListRow[]> {
    const rows = await prisma.deliveryChallan.findMany({
      where: buildWhere(companyId, financialYearId, filters),
      include: { ...CUSTOMER_INCLUDE, ...SALES_ORDER_INCLUDE, items: { select: { id: true } } },
      orderBy: [{ challanDate: "desc" }, { challanNumber: "desc" }],
    });
    return rows.map(toDeliveryChallanListRow);
  },

  async findById(id: string, client: PrismaClientOrTransaction = prisma): Promise<DeliveryChallanDetail | null> {
    const row = await client.deliveryChallan.findUnique({
      where: { id },
      include: { ...CUSTOMER_INCLUDE, ...SALES_ORDER_INCLUDE, ...ITEM_INCLUDE },
    });
    return row ? toDeliveryChallanDetail(row) : null;
  },

  /** "Dispatched, not yet invoiced" — the lookup Sales Invoice (feature-spec
   * 38) reads from. Status DISPATCHED already excludes INVOICED, so no
   * separate salesInvoice-null check is needed. */
  async findDispatchedNotInvoiced(
    companyId: string,
    financialYearId: string,
    customerId: string
  ): Promise<DeliveryChallanListRow[]> {
    const rows = await prisma.deliveryChallan.findMany({
      where: { companyId, financialYearId, customerId, status: "DISPATCHED" },
      include: { ...CUSTOMER_INCLUDE, ...SALES_ORDER_INCLUDE, items: { select: { id: true } } },
      orderBy: [{ challanDate: "desc" }, { challanNumber: "desc" }],
    });
    return rows.map(toDeliveryChallanListRow);
  },

  async create(
    tx: Prisma.TransactionClient,
    companyId: string,
    financialYearId: string,
    header: DeliveryChallanHeaderPersistData,
    lines: DeliveryChallanLinePersistData[],
    generated: GeneratedNumber,
    createdByUserId: string
  ): Promise<DeliveryChallanDetail> {
    const created = await tx.deliveryChallan.create({
      data: {
        companyId,
        financialYearId,
        challanNumber: generated.formatted,
        createdByUserId,
        ...header,
        items: {
          create: lines.map((line, index) => ({ ...line, lineNumber: index + 1 })),
        },
      },
      include: { ...CUSTOMER_INCLUDE, ...SALES_ORDER_INCLUDE, ...ITEM_INCLUDE },
    });
    return toDeliveryChallanDetail(created);
  },

  /**
   * Delete-all-then-recreate the line set inside the caller's transaction —
   * mirrors sales-order-repository.ts's replaceItemsAndUpdate.
   * `challanNumber` is never touched here (edit never regenerates it). The
   * `allowedStatuses` guard is re-checked atomically here so a concurrent
   * status transition landing between the service's own check and this
   * write loses cleanly.
   */
  async replaceItemsAndUpdate(
    tx: Prisma.TransactionClient,
    id: string,
    companyId: string,
    allowedStatuses: readonly DeliveryChallanStatus[],
    header: DeliveryChallanHeaderPersistData,
    lines: DeliveryChallanLinePersistData[]
  ): Promise<DeliveryChallanDetail | null> {
    const existing = await tx.deliveryChallan.findUnique({ where: { id } });
    if (!existing || existing.companyId !== companyId || !allowedStatuses.includes(existing.status)) {
      return null;
    }

    await tx.deliveryChallanItem.deleteMany({ where: { deliveryChallanId: id } });
    const updated = await tx.deliveryChallan.update({
      where: { id },
      data: {
        ...header,
        items: {
          create: lines.map((line, index) => ({ ...line, lineNumber: index + 1 })),
        },
      },
      include: { ...CUSTOMER_INCLUDE, ...SALES_ORDER_INCLUDE, ...ITEM_INCLUDE },
    });
    return toDeliveryChallanDetail(updated);
  },

  /**
   * Guarded status transition: only succeeds when the row's current status
   * is still one of `from` at write time — mirrors
   * sales-order-repository.ts's updateStatus exactly.
   */
  async updateStatus(
    client: PrismaClientOrTransaction,
    id: string,
    companyId: string,
    from: readonly DeliveryChallanStatus[],
    to: DeliveryChallanStatus
  ): Promise<number> {
    const result = await client.deliveryChallan.updateMany({
      where: { id, companyId, status: { in: [...from] } },
      data: { status: to },
    });
    return result.count;
  },

  async findCustomerForChallan(
    client: PrismaClientOrTransaction,
    companyId: string,
    customerId: string
  ): Promise<{ id: string; companyId: string; isActive: boolean } | null> {
    const customer = await client.customer.findUnique({
      where: { id: customerId },
      select: { id: true, companyId: true, isActive: true },
    });
    if (!customer || customer.companyId !== companyId) {
      return null;
    }
    return customer;
  },

  /** Batched lookup for every distinct productId referenced by a
   * create/update payload — mirrors sales-order-repository.ts's
   * findProductsForLines (inactive products allowed through; the picker
   * itself only offers active ones; dispatch re-checks isActive itself). */
  async findProductsForLines(
    client: PrismaClientOrTransaction,
    companyId: string,
    productIds: readonly string[]
  ): Promise<DeliveryChallanProductOption[]> {
    const rows = await client.product.findMany({
      where: { id: { in: [...productIds] }, companyId },
      select: {
        id: true,
        name: true,
        productCode: true,
        isActive: true,
        unit: { select: { symbol: true, decimalPlaces: true } },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      productCode: row.productCode,
      isActive: row.isActive,
      unitSymbol: row.unit.symbol,
      unitDecimalPlaces: row.unit.decimalPlaces,
    }));
  },

  /** The product picker's options for the manual (no linked order) create
   * form — mirrors sales-order-repository.ts's findOrderableProducts. */
  async findDispatchableProducts(companyId: string): Promise<DeliveryChallanProductOption[]> {
    const rows = await prisma.product.findMany({
      where: { companyId, isActive: true },
      select: {
        id: true,
        name: true,
        productCode: true,
        isActive: true,
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
    }));
  },
};
