import { Prisma, type SalesOrderStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { GeneratedNumber } from "@/engines/document-number/types";
import type {
  SalesOrderCustomerOption,
  SalesOrderDetail,
  SalesOrderItemDetail,
  SalesOrderListFilters,
  SalesOrderListRow,
  SalesOrderProductOption,
} from "@/types/sales-order";

type PrismaClientOrTransaction = typeof prisma | Prisma.TransactionClient;

const CUSTOMER_INCLUDE = {
  customer: { select: { id: true, isActive: true, ledger: { select: { name: true } } } },
} as const;

const ITEM_INCLUDE = {
  items: {
    include: { product: { select: { id: true, name: true, productCode: true, isActive: true } } },
  },
} as const;

// A narrow items select for the list screen's "3/5 lines delivered"
// indicator — cheaper than pulling the full item detail every row
// (quotation-repository.ts's CUSTOMER_INCLUDE-only findMany convention,
// extended with the two columns this list needs).
const ITEM_PROGRESS_INCLUDE = {
  items: { select: { quantity: true, deliveredQuantity: true } },
} as const;

type SalesOrderListRowRaw = Prisma.SalesOrderGetPayload<{
  include: typeof CUSTOMER_INCLUDE & typeof ITEM_PROGRESS_INCLUDE;
}>;
type SalesOrderDetailRaw = Prisma.SalesOrderGetPayload<{
  include: typeof CUSTOMER_INCLUDE & typeof ITEM_INCLUDE;
}>;

const SALES_ORDER_ITEM_DECIMAL_FIELDS = [
  "quantity",
  "deliveredQuantity",
  "rate",
  "discountPercent",
  "discountAmount",
  "ratePercent",
  "cessPercent",
  "taxableAmount",
  "cgst",
  "sgst",
  "igst",
  "cess",
  "totalAmount",
] as const;

const SALES_ORDER_DECIMAL_FIELDS = [
  "subtotal",
  "totalDiscount",
  "taxableAmount",
  "totalCgst",
  "totalSgst",
  "totalIgst",
  "totalCess",
  "grandTotal",
] as const;

// Decimal -> number normalization at the repository boundary
// (quotation-repository.ts's toQuotationListRow/toQuotationDetail convention).
function toCustomerOption(raw: { id: string; isActive: boolean; ledger: { name: string } }): SalesOrderCustomerOption {
  return { id: raw.id, name: raw.ledger.name, isActive: raw.isActive };
}

function toSalesOrderListRow(raw: SalesOrderListRowRaw): SalesOrderListRow {
  const header: Record<string, unknown> = { ...raw };
  for (const field of SALES_ORDER_DECIMAL_FIELDS) {
    header[field] = (raw as unknown as Record<string, Prisma.Decimal>)[field].toNumber();
  }

  const totalLineCount = raw.items.length;
  const deliveredLineCount = raw.items.filter((item) => item.deliveredQuantity.gte(item.quantity)).length;

  return {
    ...(header as unknown as SalesOrderListRow),
    customer: toCustomerOption(raw.customer),
    deliveredLineCount,
    totalLineCount,
  };
}

function toSalesOrderDetail(raw: SalesOrderDetailRaw): SalesOrderDetail {
  const header: Record<string, unknown> = { ...raw };
  for (const field of SALES_ORDER_DECIMAL_FIELDS) {
    header[field] = (raw as unknown as Record<string, Prisma.Decimal>)[field].toNumber();
  }

  // Re-sorted by lineNumber — Prisma's `include` does not guarantee row order
  // (quotation-repository.ts's identical note).
  const items: SalesOrderItemDetail[] = raw.items
    .slice()
    .sort((a, b) => a.lineNumber - b.lineNumber)
    .map((item) => {
      const line: Record<string, unknown> = { ...item };
      for (const field of SALES_ORDER_ITEM_DECIMAL_FIELDS) {
        line[field] = (item as unknown as Record<string, Prisma.Decimal>)[field].toNumber();
      }
      return { ...(line as unknown as SalesOrderItemDetail), product: item.product };
    });

  return { ...(header as unknown as SalesOrderDetail), customer: toCustomerOption(raw.customer), items };
}

function buildWhere(
  companyId: string,
  financialYearId: string,
  filters: SalesOrderListFilters
): Prisma.SalesOrderWhereInput {
  const where: Prisma.SalesOrderWhereInput = { companyId, financialYearId };

  if (filters.status) {
    where.status = filters.status;
  }
  if (filters.customerId) {
    where.customerId = filters.customerId;
  }
  if (filters.fromDate || filters.toDate) {
    where.orderDate = {
      ...(filters.fromDate ? { gte: filters.fromDate } : {}),
      ...(filters.toDate ? { lte: filters.toDate } : {}),
    };
  }
  if (filters.search) {
    where.OR = [
      { orderNumber: { contains: filters.search, mode: "insensitive" } },
      { customer: { ledger: { name: { contains: filters.search, mode: "insensitive" } } } },
    ];
  }

  return where;
}

export interface SalesOrderLinePersistData {
  productId: string;
  quantity: number;
  rate: number;
  discountPercent: number;
  discountAmount: number;
  ratePercent: number;
  cessPercent: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  totalAmount: number;
}

export interface SalesOrderHeaderPersistData {
  customerId: string;
  orderDate: Date;
  expectedDeliveryDate: Date | null;
  placeOfSupplyStateCode: string;
  narration: string | null;
  quotationId: string | null;
  subtotal: number;
  totalDiscount: number;
  taxableAmount: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalCess: number;
  grandTotal: number;
}

export interface DeliveryLine {
  salesOrderItemId: string;
  quantity: number;
}

export const salesOrderRepository = {
  async findMany(
    companyId: string,
    financialYearId: string,
    filters: SalesOrderListFilters = {}
  ): Promise<SalesOrderListRow[]> {
    const rows = await prisma.salesOrder.findMany({
      where: buildWhere(companyId, financialYearId, filters),
      include: { ...CUSTOMER_INCLUDE, ...ITEM_PROGRESS_INCLUDE },
      orderBy: [{ orderDate: "desc" }, { orderNumber: "desc" }],
    });
    return rows.map(toSalesOrderListRow);
  },

  async findById(id: string, client: PrismaClientOrTransaction = prisma): Promise<SalesOrderDetail | null> {
    const row = await client.salesOrder.findUnique({
      where: { id },
      include: { ...CUSTOMER_INCLUDE, ...ITEM_INCLUDE },
    });
    return row ? toSalesOrderDetail(row) : null;
  },

  /** `CONFIRMED`/`PARTIALLY_DELIVERED` orders for a customer — the lookup
   * Delivery Challans (feature-spec 37) reads from. */
  async findOpenForCustomer(
    companyId: string,
    financialYearId: string,
    customerId: string
  ): Promise<SalesOrderListRow[]> {
    const rows = await prisma.salesOrder.findMany({
      where: {
        companyId,
        financialYearId,
        customerId,
        status: { in: ["CONFIRMED", "PARTIALLY_DELIVERED"] },
      },
      include: { ...CUSTOMER_INCLUDE, ...ITEM_PROGRESS_INCLUDE },
      orderBy: [{ orderDate: "desc" }, { orderNumber: "desc" }],
    });
    return rows.map(toSalesOrderListRow);
  },

  async create(
    tx: Prisma.TransactionClient,
    companyId: string,
    financialYearId: string,
    header: SalesOrderHeaderPersistData,
    lines: SalesOrderLinePersistData[],
    generated: GeneratedNumber,
    createdByUserId: string
  ): Promise<SalesOrderDetail> {
    const created = await tx.salesOrder.create({
      data: {
        companyId,
        financialYearId,
        orderNumber: generated.formatted,
        createdByUserId,
        ...header,
        items: {
          create: lines.map((line, index) => ({ ...line, lineNumber: index + 1 })),
        },
      },
      include: { ...CUSTOMER_INCLUDE, ...ITEM_INCLUDE },
    });
    return toSalesOrderDetail(created);
  },

  /**
   * Delete-all-then-recreate the line set inside the caller's transaction —
   * mirrors quotation-repository.ts's replaceItemsAndUpdate. `orderNumber` is
   * never touched here (edit never regenerates it). The `allowedStatuses`
   * guard is re-checked atomically here so a concurrent status transition
   * landing between the service's own check and this write loses cleanly.
   */
  async replaceItemsAndUpdate(
    tx: Prisma.TransactionClient,
    id: string,
    companyId: string,
    allowedStatuses: readonly SalesOrderStatus[],
    header: SalesOrderHeaderPersistData,
    lines: SalesOrderLinePersistData[]
  ): Promise<SalesOrderDetail | null> {
    const existing = await tx.salesOrder.findUnique({ where: { id } });
    if (!existing || existing.companyId !== companyId || !allowedStatuses.includes(existing.status)) {
      return null;
    }

    await tx.salesOrderItem.deleteMany({ where: { salesOrderId: id } });
    const updated = await tx.salesOrder.update({
      where: { id },
      data: {
        ...header,
        items: {
          create: lines.map((line, index) => ({ ...line, lineNumber: index + 1 })),
        },
      },
      include: { ...CUSTOMER_INCLUDE, ...ITEM_INCLUDE },
    });
    return toSalesOrderDetail(updated);
  },

  /**
   * Guarded status transition: only succeeds when the row's current status is
   * still one of `from` at write time — mirrors
   * quotation-repository.ts's updateStatus exactly.
   */
  async updateStatus(
    client: PrismaClientOrTransaction,
    id: string,
    companyId: string,
    from: readonly SalesOrderStatus[],
    to: SalesOrderStatus
  ): Promise<number> {
    const result = await client.salesOrder.updateMany({
      where: { id, companyId, status: { in: [...from] } },
      data: { status: to },
    });
    return result.count;
  },

  /**
   * Atomically increments each named line's `deliveredQuantity` — the only
   * write path onto that column (salesOrderService.applyDelivery, called
   * exclusively from Delivery Challan's posting flow, feature-spec 37).
   * Bounds checking (0 <= deliveredQuantity <= quantity) and the resulting
   * header status recomputation both happen in the service, before this is
   * called — this method is a mechanical batch increment only.
   */
  async incrementDeliveredQuantities(tx: Prisma.TransactionClient, lines: readonly DeliveryLine[]): Promise<void> {
    for (const line of lines) {
      await tx.salesOrderItem.update({
        where: { id: line.salesOrderItemId },
        data: { deliveredQuantity: { increment: line.quantity } },
      });
    }
  },

  /** The product picker's options — mirrors
   * quotation-repository.ts's findQuotableProducts exactly. */
  async findOrderableProducts(companyId: string): Promise<SalesOrderProductOption[]> {
    const rows = await prisma.product.findMany({
      where: { companyId, isActive: true },
      select: {
        id: true,
        name: true,
        productCode: true,
        isActive: true,
        sellingPrice: true,
        purchasePrice: true,
        unit: { select: { symbol: true, decimalPlaces: true } },
        hsnCode: { select: { code: true } },
        gstRate: { select: { ratePercent: true, cessPercent: true } },
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
      hsnCode: row.hsnCode?.code ?? null,
      hasGstRate: row.gstRate !== null,
      ratePercent: row.gstRate?.ratePercent.toNumber() ?? 0,
      cessPercent: row.gstRate?.cessPercent.toNumber() ?? 0,
      sellingPrice: row.sellingPrice?.toNumber() ?? null,
      purchasePrice: row.purchasePrice?.toNumber() ?? null,
    }));
  },

  /** Batched lookup for every distinct productId referenced by a
   * create/update/convert payload — mirrors
   * quotation-repository.ts's findProductsForLines exactly (inactive
   * products allowed through; the picker itself only offers active ones). */
  async findProductsForLines(
    client: PrismaClientOrTransaction,
    companyId: string,
    productIds: readonly string[]
  ): Promise<SalesOrderProductOption[]> {
    const rows = await client.product.findMany({
      where: { id: { in: [...productIds] }, companyId },
      select: {
        id: true,
        name: true,
        productCode: true,
        isActive: true,
        sellingPrice: true,
        purchasePrice: true,
        unit: { select: { symbol: true, decimalPlaces: true } },
        hsnCode: { select: { code: true } },
        gstRate: { select: { ratePercent: true, cessPercent: true } },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      productCode: row.productCode,
      isActive: row.isActive,
      unitSymbol: row.unit.symbol,
      unitDecimalPlaces: row.unit.decimalPlaces,
      hsnCode: row.hsnCode?.code ?? null,
      hasGstRate: row.gstRate !== null,
      ratePercent: row.gstRate?.ratePercent.toNumber() ?? 0,
      cessPercent: row.gstRate?.cessPercent.toNumber() ?? 0,
      sellingPrice: row.sellingPrice?.toNumber() ?? null,
      purchasePrice: row.purchasePrice?.toNumber() ?? null,
    }));
  },

  async findCustomerForOrder(
    client: PrismaClientOrTransaction,
    companyId: string,
    customerId: string
  ): Promise<{ id: string; companyId: string; isActive: boolean; priceListId: string | null } | null> {
    const customer = await client.customer.findUnique({
      where: { id: customerId },
      select: { id: true, companyId: true, isActive: true, priceListId: true },
    });
    if (!customer || customer.companyId !== companyId) {
      return null;
    }
    return customer;
  },

  async findCompanyStateCode(companyId: string): Promise<string | null> {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { stateCode: true },
    });
    return company?.stateCode ?? null;
  },
};
