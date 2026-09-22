import { Prisma, type PurchaseOrderStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { fetchPage, type Page, type PageParams } from "@/lib/pagination";
import type { GeneratedNumber } from "@/engines/document-number/types";
import type {
  PurchaseOrderDetail,
  PurchaseOrderListFilters,
  PurchaseOrderListRow,
  PurchaseOrderProductOption,
  PurchaseOrderSupplierOption,
} from "@/types/purchase-order";

type PrismaClientOrTransaction = typeof prisma | Prisma.TransactionClient;

const SUPPLIER_INCLUDE = {
  supplier: { select: { id: true, isActive: true, ledger: { select: { name: true } } } },
} as const;

const ITEM_INCLUDE = {
  items: {
    include: { product: { select: { id: true, name: true, productCode: true, isActive: true } } },
  },
} as const;

// A narrow items select for the list screen's "3/5 lines received"
// indicator — cheaper than pulling the full item detail every row
// (sales-order-repository.ts's ITEM_PROGRESS_INCLUDE-only findMany
// convention, extended with the two columns this list needs).
const ITEM_PROGRESS_INCLUDE = {
  items: { select: { quantity: true, receivedQuantity: true } },
} as const;

type PurchaseOrderListRowRaw = Prisma.PurchaseOrderGetPayload<{
  include: typeof SUPPLIER_INCLUDE & typeof ITEM_PROGRESS_INCLUDE;
}>;
type PurchaseOrderDetailRaw = Prisma.PurchaseOrderGetPayload<{
  include: typeof SUPPLIER_INCLUDE & typeof ITEM_INCLUDE;
}>;

const PURCHASE_ORDER_ITEM_DECIMAL_FIELDS = [
  "quantity",
  "receivedQuantity",
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

const PURCHASE_ORDER_DECIMAL_FIELDS = [
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
// (sales-order-repository.ts's toSalesOrderListRow/toSalesOrderDetail convention).
function toSupplierOption(raw: { id: string; isActive: boolean; ledger: { name: string } }): PurchaseOrderSupplierOption {
  return { id: raw.id, name: raw.ledger.name, isActive: raw.isActive };
}

function toPurchaseOrderListRow(raw: PurchaseOrderListRowRaw): PurchaseOrderListRow {
  const header: Record<string, unknown> = { ...raw };
  for (const field of PURCHASE_ORDER_DECIMAL_FIELDS) {
    header[field] = (raw as unknown as Record<string, Prisma.Decimal>)[field].toNumber();
  }

  const totalLineCount = raw.items.length;
  const receivedLineCount = raw.items.filter((item) => item.receivedQuantity.gte(item.quantity)).length;

  return {
    ...(header as unknown as PurchaseOrderListRow),
    supplier: toSupplierOption(raw.supplier),
    receivedLineCount,
    totalLineCount,
  };
}

function toPurchaseOrderDetail(raw: PurchaseOrderDetailRaw): PurchaseOrderDetail {
  const header: Record<string, unknown> = { ...raw };
  for (const field of PURCHASE_ORDER_DECIMAL_FIELDS) {
    header[field] = (raw as unknown as Record<string, Prisma.Decimal>)[field].toNumber();
  }

  // Re-sorted by lineNumber — Prisma's `include` does not guarantee row order
  // (sales-order-repository.ts's identical note).
  const items = raw.items
    .slice()
    .sort((a, b) => a.lineNumber - b.lineNumber)
    .map((item) => {
      const line: Record<string, unknown> = { ...item };
      for (const field of PURCHASE_ORDER_ITEM_DECIMAL_FIELDS) {
        line[field] = (item as unknown as Record<string, Prisma.Decimal>)[field].toNumber();
      }
      return { ...(line as unknown as PurchaseOrderDetail["items"][number]), product: item.product };
    });

  return { ...(header as unknown as PurchaseOrderDetail), supplier: toSupplierOption(raw.supplier), items };
}

function buildWhere(
  companyId: string,
  financialYearId: string,
  filters: PurchaseOrderListFilters
): Prisma.PurchaseOrderWhereInput {
  const where: Prisma.PurchaseOrderWhereInput = { companyId, financialYearId };

  if (filters.status) {
    where.status = filters.status;
  }
  if (filters.supplierId) {
    where.supplierId = filters.supplierId;
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
      { supplier: { ledger: { name: { contains: filters.search, mode: "insensitive" } } } },
    ];
  }

  return where;
}

export interface PurchaseOrderLinePersistData {
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

export interface PurchaseOrderHeaderPersistData {
  supplierId: string;
  orderDate: Date;
  expectedDeliveryDate: Date | null;
  placeOfSupplyStateCode: string;
  narration: string | null;
  subtotal: number;
  totalDiscount: number;
  taxableAmount: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalCess: number;
  grandTotal: number;
}

export interface ReceiptLine {
  purchaseOrderItemId: string;
  quantity: number;
}

export const purchaseOrderRepository = {
  async findMany(
    companyId: string,
    financialYearId: string,
    filters: PurchaseOrderListFilters = {}
  ): Promise<PurchaseOrderListRow[]> {
    const rows = await prisma.purchaseOrder.findMany({
      where: buildWhere(companyId, financialYearId, filters),
      include: { ...SUPPLIER_INCLUDE, ...ITEM_PROGRESS_INCLUDE },
      orderBy: [{ orderDate: "desc" }, { orderNumber: "desc" }],
    });
    return rows.map(toPurchaseOrderListRow);
  },

  /** Infinite-scroll page for the Purchase Orders list — same filters/
   * ordering as `findMany`, just `skip`/`take`-bounded. */
  async findManyPage(
    companyId: string,
    financialYearId: string,
    filters: PurchaseOrderListFilters,
    page: PageParams
  ): Promise<Page<PurchaseOrderListRow>> {
    const result = await fetchPage(
      (args) =>
        prisma.purchaseOrder.findMany({
          where: buildWhere(companyId, financialYearId, filters),
          include: { ...SUPPLIER_INCLUDE, ...ITEM_PROGRESS_INCLUDE },
          orderBy: [{ orderDate: "desc" }, { orderNumber: "desc" }],
          ...args,
        }),
      page
    );
    return { items: result.items.map(toPurchaseOrderListRow), hasMore: result.hasMore };
  },

  async findById(id: string, client: PrismaClientOrTransaction = prisma): Promise<PurchaseOrderDetail | null> {
    const row = await client.purchaseOrder.findUnique({
      where: { id },
      include: { ...SUPPLIER_INCLUDE, ...ITEM_INCLUDE },
    });
    return row ? toPurchaseOrderDetail(row) : null;
  },

  /** `CONFIRMED`/`PARTIALLY_RECEIVED` orders for a supplier — the lookup
   * Goods Receipt Notes (feature-spec 43) read from. */
  async findOpenForSupplier(
    companyId: string,
    financialYearId: string,
    supplierId: string
  ): Promise<PurchaseOrderListRow[]> {
    const rows = await prisma.purchaseOrder.findMany({
      where: {
        companyId,
        financialYearId,
        supplierId,
        status: { in: ["CONFIRMED", "PARTIALLY_RECEIVED"] },
      },
      include: { ...SUPPLIER_INCLUDE, ...ITEM_PROGRESS_INCLUDE },
      orderBy: [{ orderDate: "desc" }, { orderNumber: "desc" }],
    });
    return rows.map(toPurchaseOrderListRow);
  },

  async create(
    tx: Prisma.TransactionClient,
    companyId: string,
    financialYearId: string,
    header: PurchaseOrderHeaderPersistData,
    lines: PurchaseOrderLinePersistData[],
    generated: GeneratedNumber,
    createdByUserId: string
  ): Promise<PurchaseOrderDetail> {
    const created = await tx.purchaseOrder.create({
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
      include: { ...SUPPLIER_INCLUDE, ...ITEM_INCLUDE },
    });
    return toPurchaseOrderDetail(created);
  },

  /**
   * Delete-all-then-recreate the line set inside the caller's transaction —
   * mirrors sales-order-repository.ts's replaceItemsAndUpdate. `orderNumber`
   * is never touched here (edit never regenerates it). The `allowedStatuses`
   * guard is re-checked atomically here so a concurrent status transition
   * landing between the service's own check and this write loses cleanly.
   */
  async replaceItemsAndUpdate(
    tx: Prisma.TransactionClient,
    id: string,
    companyId: string,
    allowedStatuses: readonly PurchaseOrderStatus[],
    header: PurchaseOrderHeaderPersistData,
    lines: PurchaseOrderLinePersistData[]
  ): Promise<PurchaseOrderDetail | null> {
    const existing = await tx.purchaseOrder.findUnique({ where: { id } });
    if (!existing || existing.companyId !== companyId || !allowedStatuses.includes(existing.status)) {
      return null;
    }

    await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } });
    const updated = await tx.purchaseOrder.update({
      where: { id },
      data: {
        ...header,
        items: {
          create: lines.map((line, index) => ({ ...line, lineNumber: index + 1 })),
        },
      },
      include: { ...SUPPLIER_INCLUDE, ...ITEM_INCLUDE },
    });
    return toPurchaseOrderDetail(updated);
  },

  /**
   * Guarded status transition: only succeeds when the row's current status is
   * still one of `from` at write time — mirrors
   * sales-order-repository.ts's updateStatus exactly.
   */
  async updateStatus(
    client: PrismaClientOrTransaction,
    id: string,
    companyId: string,
    from: readonly PurchaseOrderStatus[],
    to: PurchaseOrderStatus
  ): Promise<number> {
    const result = await client.purchaseOrder.updateMany({
      where: { id, companyId, status: { in: [...from] } },
      data: { status: to },
    });
    return result.count;
  },

  /**
   * Atomically increments each named line's `receivedQuantity` — the only
   * write path onto that column (purchaseOrderService.applyReceipt, called
   * exclusively from Goods Receipt Note's posting flow, feature-spec 43).
   * Bounds checking (0 <= receivedQuantity <= quantity) and the resulting
   * header status recomputation both happen in the service, before this is
   * called — this method is a mechanical batch increment only.
   */
  async incrementReceivedQuantities(tx: Prisma.TransactionClient, lines: readonly ReceiptLine[]): Promise<void> {
    for (const line of lines) {
      await tx.purchaseOrderItem.update({
        where: { id: line.purchaseOrderItemId },
        data: { receivedQuantity: { increment: line.quantity } },
      });
    }
  },

  /** The product picker's options — mirrors
   * sales-order-repository.ts's findOrderableProducts, reading `purchasePrice`
   * (this document's cost basis) instead of `sellingPrice`. */
  async findOrderableProducts(companyId: string): Promise<PurchaseOrderProductOption[]> {
    const rows = await prisma.product.findMany({
      where: { companyId, isActive: true },
      select: {
        id: true,
        name: true,
        productCode: true,
        isActive: true,
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
      purchasePrice: row.purchasePrice?.toNumber() ?? null,
    }));
  },

  /** Batched lookup for every distinct productId referenced by a
   * create/update payload — mirrors
   * sales-order-repository.ts's findProductsForLines exactly (inactive
   * products allowed through; the picker itself only offers active ones). */
  async findProductsForLines(
    client: PrismaClientOrTransaction,
    companyId: string,
    productIds: readonly string[]
  ): Promise<PurchaseOrderProductOption[]> {
    const rows = await client.product.findMany({
      where: { id: { in: [...productIds] }, companyId },
      select: {
        id: true,
        name: true,
        productCode: true,
        isActive: true,
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
      purchasePrice: row.purchasePrice?.toNumber() ?? null,
    }));
  },

  async findSupplierForOrder(
    client: PrismaClientOrTransaction,
    companyId: string,
    supplierId: string
  ): Promise<{ id: string; companyId: string; isActive: boolean } | null> {
    const supplier = await client.supplier.findUnique({
      where: { id: supplierId },
      select: { id: true, companyId: true, isActive: true },
    });
    if (!supplier || supplier.companyId !== companyId) {
      return null;
    }
    return supplier;
  },

  async findCompanyStateCode(companyId: string): Promise<string | null> {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { stateCode: true },
    });
    return company?.stateCode ?? null;
  },
};
