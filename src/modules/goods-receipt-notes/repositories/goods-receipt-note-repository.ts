import { Prisma, type GoodsReceiptNoteStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { fetchPage, type Page, type PageParams } from "@/lib/pagination";
import type { GeneratedNumber } from "@/engines/document-number/types";
import type {
  GoodsReceiptNoteDetail,
  GoodsReceiptNoteItemDetail,
  GoodsReceiptNoteListFilters,
  GoodsReceiptNoteListRow,
  GoodsReceiptNoteProductOption,
  GoodsReceiptNoteSupplierOption,
  GoodsReceiptNoteWarehouseOption,
} from "@/types/goods-receipt-note";

type PrismaClientOrTransaction = typeof prisma | Prisma.TransactionClient;

const SUPPLIER_INCLUDE = {
  supplier: { select: { id: true, isActive: true, ledger: { select: { name: true } } } },
} as const;

const PURCHASE_ORDER_INCLUDE = {
  purchaseOrder: { select: { id: true, orderNumber: true } },
} as const;

const ITEM_INCLUDE = {
  items: {
    include: {
      product: { select: { id: true, name: true, productCode: true, isActive: true } },
      warehouse: { select: { id: true, name: true, code: true, isActive: true } },
    },
  },
} as const;

type GoodsReceiptNoteListRowRaw = Prisma.GoodsReceiptNoteGetPayload<{
  include: typeof SUPPLIER_INCLUDE & typeof PURCHASE_ORDER_INCLUDE & { items: { select: { id: true } } };
}>;
type GoodsReceiptNoteDetailRaw = Prisma.GoodsReceiptNoteGetPayload<{
  include: typeof SUPPLIER_INCLUDE & typeof PURCHASE_ORDER_INCLUDE & typeof ITEM_INCLUDE;
}>;

// Decimal -> number normalization at the repository boundary — the
// delivery-challan-repository.ts convention.
function toSupplierOption(raw: { id: string; isActive: boolean; ledger: { name: string } }): GoodsReceiptNoteSupplierOption {
  return { id: raw.id, name: raw.ledger.name, isActive: raw.isActive };
}

function toGoodsReceiptNoteListRow(raw: GoodsReceiptNoteListRowRaw): GoodsReceiptNoteListRow {
  const { items, supplier, purchaseOrder, ...header } = raw;
  return {
    ...header,
    supplier: toSupplierOption(supplier),
    purchaseOrder,
    lineCount: items.length,
  };
}

function toGoodsReceiptNoteDetail(raw: GoodsReceiptNoteDetailRaw): GoodsReceiptNoteDetail {
  const { items, supplier, purchaseOrder, ...header } = raw;

  // Re-sorted by lineNumber — Prisma's `include` does not guarantee row
  // order (delivery-challan-repository.ts's identical note).
  const sortedItems: GoodsReceiptNoteItemDetail[] = items
    .slice()
    .sort((a, b) => a.lineNumber - b.lineNumber)
    .map((item) => ({
      ...item,
      quantity: item.quantity.toNumber(),
      rejectedQuantity: item.rejectedQuantity.toNumber(),
    }));

  return {
    ...header,
    supplier: toSupplierOption(supplier),
    purchaseOrder,
    items: sortedItems,
  };
}

function buildWhere(
  companyId: string,
  financialYearId: string,
  filters: GoodsReceiptNoteListFilters
): Prisma.GoodsReceiptNoteWhereInput {
  const where: Prisma.GoodsReceiptNoteWhereInput = { companyId, financialYearId };

  if (filters.status) {
    where.status = filters.status;
  }
  if (filters.supplierId) {
    where.supplierId = filters.supplierId;
  }
  if (filters.fromDate || filters.toDate) {
    where.grnDate = {
      ...(filters.fromDate ? { gte: filters.fromDate } : {}),
      ...(filters.toDate ? { lte: filters.toDate } : {}),
    };
  }
  if (filters.search) {
    where.OR = [
      { grnNumber: { contains: filters.search, mode: "insensitive" } },
      { supplier: { ledger: { name: { contains: filters.search, mode: "insensitive" } } } },
    ];
  }

  return where;
}

export interface GoodsReceiptNoteLinePersistData {
  productId: string;
  warehouseId: string;
  quantity: number;
  rejectedQuantity: number;
  purchaseOrderItemId: string | null;
}

export interface GoodsReceiptNoteHeaderPersistData {
  supplierId: string;
  grnDate: Date;
  purchaseOrderId: string | null;
  narration: string | null;
}

export const goodsReceiptNoteRepository = {
  async findMany(
    companyId: string,
    financialYearId: string,
    filters: GoodsReceiptNoteListFilters = {}
  ): Promise<GoodsReceiptNoteListRow[]> {
    const rows = await prisma.goodsReceiptNote.findMany({
      where: buildWhere(companyId, financialYearId, filters),
      include: { ...SUPPLIER_INCLUDE, ...PURCHASE_ORDER_INCLUDE, items: { select: { id: true } } },
      orderBy: [{ grnDate: "desc" }, { grnNumber: "desc" }],
    });
    return rows.map(toGoodsReceiptNoteListRow);
  },

  /** Infinite-scroll page for the Goods Receipt Notes list — same filters/
   * ordering as `findMany`, just `skip`/`take`-bounded. */
  async findManyPage(
    companyId: string,
    financialYearId: string,
    filters: GoodsReceiptNoteListFilters,
    page: PageParams
  ): Promise<Page<GoodsReceiptNoteListRow>> {
    const result = await fetchPage(
      (args) =>
        prisma.goodsReceiptNote.findMany({
          where: buildWhere(companyId, financialYearId, filters),
          include: { ...SUPPLIER_INCLUDE, ...PURCHASE_ORDER_INCLUDE, items: { select: { id: true } } },
          orderBy: [{ grnDate: "desc" }, { grnNumber: "desc" }],
          ...args,
        }),
      page
    );
    return { items: result.items.map(toGoodsReceiptNoteListRow), hasMore: result.hasMore };
  },

  async findById(id: string, client: PrismaClientOrTransaction = prisma): Promise<GoodsReceiptNoteDetail | null> {
    const row = await client.goodsReceiptNote.findUnique({
      where: { id },
      include: { ...SUPPLIER_INCLUDE, ...PURCHASE_ORDER_INCLUDE, ...ITEM_INCLUDE },
    });
    return row ? toGoodsReceiptNoteDetail(row) : null;
  },

  /** "Received, not yet invoiced" — the lookup Purchase Invoice (feature-spec
   * 44) reads from. Status RECEIVED already excludes INVOICED, so no
   * separate purchaseInvoice-null check is needed. */
  async findReceivedNotInvoiced(
    companyId: string,
    financialYearId: string,
    supplierId: string
  ): Promise<GoodsReceiptNoteListRow[]> {
    const rows = await prisma.goodsReceiptNote.findMany({
      where: { companyId, financialYearId, supplierId, status: "RECEIVED" },
      include: { ...SUPPLIER_INCLUDE, ...PURCHASE_ORDER_INCLUDE, items: { select: { id: true } } },
      orderBy: [{ grnDate: "desc" }, { grnNumber: "desc" }],
    });
    return rows.map(toGoodsReceiptNoteListRow);
  },

  async create(
    tx: Prisma.TransactionClient,
    companyId: string,
    financialYearId: string,
    header: GoodsReceiptNoteHeaderPersistData,
    lines: GoodsReceiptNoteLinePersistData[],
    generated: GeneratedNumber,
    createdByUserId: string
  ): Promise<GoodsReceiptNoteDetail> {
    const created = await tx.goodsReceiptNote.create({
      data: {
        companyId,
        financialYearId,
        grnNumber: generated.formatted,
        createdByUserId,
        ...header,
        items: {
          create: lines.map((line, index) => ({ ...line, lineNumber: index + 1 })),
        },
      },
      include: { ...SUPPLIER_INCLUDE, ...PURCHASE_ORDER_INCLUDE, ...ITEM_INCLUDE },
    });
    return toGoodsReceiptNoteDetail(created);
  },

  /**
   * Delete-all-then-recreate the line set inside the caller's transaction —
   * mirrors delivery-challan-repository.ts's replaceItemsAndUpdate.
   * `grnNumber` is never touched here (edit never regenerates it). The
   * `allowedStatuses` guard is re-checked atomically here so a concurrent
   * status transition landing between the service's own check and this
   * write loses cleanly.
   */
  async replaceItemsAndUpdate(
    tx: Prisma.TransactionClient,
    id: string,
    companyId: string,
    allowedStatuses: readonly GoodsReceiptNoteStatus[],
    header: GoodsReceiptNoteHeaderPersistData,
    lines: GoodsReceiptNoteLinePersistData[]
  ): Promise<GoodsReceiptNoteDetail | null> {
    const existing = await tx.goodsReceiptNote.findUnique({ where: { id } });
    if (!existing || existing.companyId !== companyId || !allowedStatuses.includes(existing.status)) {
      return null;
    }

    await tx.goodsReceiptNoteItem.deleteMany({ where: { goodsReceiptNoteId: id } });
    const updated = await tx.goodsReceiptNote.update({
      where: { id },
      data: {
        ...header,
        items: {
          create: lines.map((line, index) => ({ ...line, lineNumber: index + 1 })),
        },
      },
      include: { ...SUPPLIER_INCLUDE, ...PURCHASE_ORDER_INCLUDE, ...ITEM_INCLUDE },
    });
    return toGoodsReceiptNoteDetail(updated);
  },

  /**
   * Guarded status transition: only succeeds when the row's current status
   * is still one of `from` at write time — mirrors
   * delivery-challan-repository.ts's updateStatus exactly.
   */
  async updateStatus(
    client: PrismaClientOrTransaction,
    id: string,
    companyId: string,
    from: readonly GoodsReceiptNoteStatus[],
    to: GoodsReceiptNoteStatus
  ): Promise<number> {
    const result = await client.goodsReceiptNote.updateMany({
      where: { id, companyId, status: { in: [...from] } },
      data: { status: to },
    });
    return result.count;
  },

  async findSupplierForGrn(
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

  /** Batched lookup for every distinct productId referenced by a
   * create/update payload — mirrors delivery-challan-repository.ts's
   * findProductsForLines (inactive products allowed through; the picker
   * itself only offers active ones; receiving re-checks isActive itself). */
  async findProductsForLines(
    client: PrismaClientOrTransaction,
    companyId: string,
    productIds: readonly string[]
  ): Promise<GoodsReceiptNoteProductOption[]> {
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

  /** Batched lookup for every distinct warehouseId referenced by a
   * create/update payload — same inactive-allowed-through-at-create,
   * re-checked-at-receive convention as findProductsForLines. */
  async findWarehousesForLines(
    client: PrismaClientOrTransaction,
    companyId: string,
    warehouseIds: readonly string[]
  ): Promise<GoodsReceiptNoteWarehouseOption[]> {
    const rows = await client.warehouse.findMany({
      where: { id: { in: [...warehouseIds] }, companyId },
      select: { id: true, name: true, code: true, isActive: true },
    });
    return rows;
  },

  /** The product picker's options for the manual (no linked order) create
   * form — mirrors delivery-challan-repository.ts's findDispatchableProducts. */
  async findReceivableProducts(companyId: string): Promise<GoodsReceiptNoteProductOption[]> {
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

  async findSelectableWarehouses(companyId: string): Promise<GoodsReceiptNoteWarehouseOption[]> {
    const rows = await prisma.warehouse.findMany({
      where: { companyId, isActive: true },
      select: { id: true, name: true, code: true, isActive: true },
      orderBy: { name: "asc" },
    });
    return rows;
  },
};
