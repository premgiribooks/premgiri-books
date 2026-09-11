import { Prisma, type StockAdjustmentStatus, type StockDirection } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { GeneratedNumber } from "@/engines/document-number/types";
import type {
  StockAdjustmentDetail,
  StockAdjustmentItemDetail,
  StockAdjustmentListFilters,
  StockAdjustmentListRow,
  StockAdjustmentProductOption,
  StockAdjustmentWarehouseOption,
} from "@/types/stock-adjustment";

type PrismaClientOrTransaction = typeof prisma | Prisma.TransactionClient;

const ITEM_INCLUDE = {
  items: {
    include: {
      product: { select: { name: true, productCode: true, unit: { select: { symbol: true, decimalPlaces: true } } } },
      warehouse: { select: { name: true } },
    },
  },
} as const;

type StockAdjustmentListRowRaw = Prisma.StockAdjustmentGetPayload<{ include: { _count: { select: { items: true } } } }>;
type StockAdjustmentDetailRaw = Prisma.StockAdjustmentGetPayload<{ include: typeof ITEM_INCLUDE }>;

function toStockAdjustmentListRow(raw: StockAdjustmentListRowRaw): StockAdjustmentListRow {
  const { _count, ...header } = raw;
  return { ...header, lineCount: _count.items };
}

function toStockAdjustmentDetail(raw: StockAdjustmentDetailRaw): StockAdjustmentDetail {
  const { items, ...header } = raw;
  // Re-sorted by lineNumber — Prisma's `include` does not guarantee row
  // order (purchase-return-repository.ts's identical note).
  const normalizedItems: StockAdjustmentItemDetail[] = items
    .slice()
    .sort((a, b) => a.lineNumber - b.lineNumber)
    .map((item) => ({
      id: item.id,
      stockAdjustmentId: item.stockAdjustmentId,
      lineNumber: item.lineNumber,
      productId: item.productId,
      productName: item.product.name,
      productCode: item.product.productCode,
      warehouseId: item.warehouseId,
      warehouseName: item.warehouse.name,
      unitSymbol: item.product.unit.symbol,
      unitDecimalPlaces: item.product.unit.decimalPlaces,
      direction: item.direction,
      quantity: item.quantity.toNumber(),
      narration: item.narration,
    }));

  return { ...header, items: normalizedItems };
}

function buildWhere(
  companyId: string,
  financialYearId: string,
  filters: StockAdjustmentListFilters
): Prisma.StockAdjustmentWhereInput {
  const where: Prisma.StockAdjustmentWhereInput = { companyId, financialYearId };

  if (filters.status) {
    where.status = filters.status;
  }
  if (filters.fromDate || filters.toDate) {
    where.adjustmentDate = {
      ...(filters.fromDate ? { gte: filters.fromDate } : {}),
      ...(filters.toDate ? { lte: filters.toDate } : {}),
    };
  }
  if (filters.search) {
    where.OR = [
      { adjustmentNumber: { contains: filters.search, mode: "insensitive" } },
      { reason: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  return where;
}

export interface StockAdjustmentHeaderPersistData {
  adjustmentDate: Date;
  reason: string;
}

export interface StockAdjustmentLinePersistData {
  productId: string;
  warehouseId: string;
  direction: StockDirection;
  quantity: number;
  narration: string | null;
}

export const stockAdjustmentRepository = {
  async findMany(
    companyId: string,
    financialYearId: string,
    filters: StockAdjustmentListFilters = {}
  ): Promise<StockAdjustmentListRow[]> {
    const rows = await prisma.stockAdjustment.findMany({
      where: buildWhere(companyId, financialYearId, filters),
      include: { _count: { select: { items: true } } },
      orderBy: [{ adjustmentDate: "desc" }, { createdAt: "desc" }],
    });
    return rows.map(toStockAdjustmentListRow);
  },

  async findById(id: string, client: PrismaClientOrTransaction = prisma): Promise<StockAdjustmentDetail | null> {
    const row = await client.stockAdjustment.findUnique({ where: { id }, include: ITEM_INCLUDE });
    return row ? toStockAdjustmentDetail(row) : null;
  },

  async create(
    tx: Prisma.TransactionClient,
    companyId: string,
    financialYearId: string,
    header: StockAdjustmentHeaderPersistData,
    lines: StockAdjustmentLinePersistData[],
    createdByUserId: string
  ): Promise<StockAdjustmentDetail> {
    const created = await tx.stockAdjustment.create({
      data: {
        companyId,
        financialYearId,
        createdByUserId,
        ...header,
        items: { create: lines.map((line, index) => ({ ...line, lineNumber: index + 1 })) },
      },
      include: ITEM_INCLUDE,
    });
    return toStockAdjustmentDetail(created);
  },

  /** Delete-all-then-recreate the line set inside the caller's transaction —
   * mirrors purchase-return-repository.ts's replaceItemsAndUpdate. The
   * `allowedStatuses` guard is re-checked atomically here so a concurrent
   * status transition landing between the service's own check and this
   * write loses cleanly. */
  async replaceItemsAndUpdate(
    tx: Prisma.TransactionClient,
    id: string,
    companyId: string,
    allowedStatuses: readonly StockAdjustmentStatus[],
    header: StockAdjustmentHeaderPersistData,
    lines: StockAdjustmentLinePersistData[]
  ): Promise<StockAdjustmentDetail | null> {
    const existing = await tx.stockAdjustment.findUnique({ where: { id } });
    if (!existing || existing.companyId !== companyId || !allowedStatuses.includes(existing.status)) {
      return null;
    }

    await tx.stockAdjustmentItem.deleteMany({ where: { stockAdjustmentId: id } });
    const updated = await tx.stockAdjustment.update({
      where: { id },
      data: {
        ...header,
        items: { create: lines.map((line, index) => ({ ...line, lineNumber: index + 1 })) },
      },
      include: ITEM_INCLUDE,
    });
    return toStockAdjustmentDetail(updated);
  },

  /** Posting's own write — unlike Purchase Return, Stock Adjustment's lines
   * carry no computed fields to refresh at posting time, so nothing here
   * replaces the item set; it only assigns `adjustmentNumber` and flips
   * `status`, guarded by `WHERE status = 'DRAFT'` so a concurrent status
   * change loses cleanly. */
  async markPosted(
    tx: Prisma.TransactionClient,
    id: string,
    companyId: string,
    generated: GeneratedNumber
  ): Promise<StockAdjustmentDetail | null> {
    const existing = await tx.stockAdjustment.findUnique({ where: { id } });
    if (!existing || existing.companyId !== companyId || existing.status !== "DRAFT") {
      return null;
    }

    const updated = await tx.stockAdjustment.update({
      where: { id },
      data: { adjustmentNumber: generated.formatted, status: "POSTED" },
      include: ITEM_INCLUDE,
    });
    return toStockAdjustmentDetail(updated);
  },

  /** Guarded status transition — mirrors purchase-return-repository.ts's
   * updateStatus exactly. Drives Cancel (`POSTED -> CANCELLED`) only. */
  async updateStatus(
    client: PrismaClientOrTransaction,
    id: string,
    companyId: string,
    from: readonly StockAdjustmentStatus[],
    to: StockAdjustmentStatus
  ): Promise<number> {
    const result = await client.stockAdjustment.updateMany({
      where: { id, companyId, status: { in: [...from] } },
      data: { status: to },
    });
    return result.count;
  },

  /** The line editor's product picker — active TRADING products only, since
   * only TRADING products may carry stock (mirrors
   * stock-transaction-repository.ts's findOpeningStockEligibleProducts). */
  async findSelectableProducts(companyId: string): Promise<StockAdjustmentProductOption[]> {
    const rows = await prisma.product.findMany({
      where: { companyId, isActive: true, productType: "TRADING" },
      select: {
        id: true,
        name: true,
        productCode: true,
        isActive: true,
        defaultWarehouseId: true,
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
      defaultWarehouseId: row.defaultWarehouseId,
    }));
  },

  /** The line editor's warehouse picker — mirrors
   * purchase-invoice-repository.ts's findSelectableWarehouses. */
  async findSelectableWarehouses(companyId: string): Promise<StockAdjustmentWarehouseOption[]> {
    return prisma.warehouse.findMany({
      where: { companyId, isActive: true },
      select: { id: true, name: true, code: true, isActive: true },
      orderBy: { name: "asc" },
    });
  },

  /** Company-scoped existence check for the ids a create/update draft
   * submission references — deliberately NOT filtered by isActive/
   * productType (that re-validation is deferred to Posting, per
   * 47-stock-adjustment.md's Business Rules), only by companyId, so a
   * cross-tenant id can never be persisted into a draft (mirrors
   * purchase-invoice-service.ts's loadProductsMap/findProductsForLines
   * pattern). */
  async findProductsForLines(
    client: PrismaClientOrTransaction,
    companyId: string,
    productIds: readonly string[]
  ): Promise<{ id: string }[]> {
    if (productIds.length === 0) {
      return [];
    }
    return client.product.findMany({ where: { companyId, id: { in: [...productIds] } }, select: { id: true } });
  },

  /** Company-scoped existence check for warehouse ids — see
   * findProductsForLines's identical reasoning. */
  async findWarehousesForLines(
    client: PrismaClientOrTransaction,
    companyId: string,
    warehouseIds: readonly string[]
  ): Promise<{ id: string }[]> {
    if (warehouseIds.length === 0) {
      return [];
    }
    return client.warehouse.findMany({ where: { companyId, id: { in: [...warehouseIds] } }, select: { id: true } });
  },
};
