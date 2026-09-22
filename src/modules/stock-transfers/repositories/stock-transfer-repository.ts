import { Prisma, type StockTransferStatus } from "@prisma/client";

import { fetchPage, type Page, type PageParams } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import type { GeneratedNumber } from "@/engines/document-number/types";
import type {
  StockTransferDetail,
  StockTransferItemDetail,
  StockTransferListFilters,
  StockTransferListRow,
  StockTransferProductOption,
  StockTransferWarehouseOption,
} from "@/types/stock-transfer";

type PrismaClientOrTransaction = typeof prisma | Prisma.TransactionClient;

const WAREHOUSE_NAME_INCLUDE = {
  sourceWarehouse: { select: { name: true } },
  destinationWarehouse: { select: { name: true } },
} as const;

const DETAIL_INCLUDE = {
  ...WAREHOUSE_NAME_INCLUDE,
  items: {
    include: {
      product: { select: { name: true, productCode: true, unit: { select: { symbol: true, decimalPlaces: true } } } },
    },
  },
} as const;

type StockTransferListRowRaw = Prisma.StockTransferGetPayload<{
  include: typeof WAREHOUSE_NAME_INCLUDE & { _count: { select: { items: true } } };
}>;
type StockTransferDetailRaw = Prisma.StockTransferGetPayload<{ include: typeof DETAIL_INCLUDE }>;

function toStockTransferListRow(raw: StockTransferListRowRaw): StockTransferListRow {
  const { _count, sourceWarehouse, destinationWarehouse, ...header } = raw;
  return {
    ...header,
    sourceWarehouseName: sourceWarehouse.name,
    destinationWarehouseName: destinationWarehouse.name,
    lineCount: _count.items,
  };
}

function toStockTransferDetail(raw: StockTransferDetailRaw): StockTransferDetail {
  const { items, sourceWarehouse, destinationWarehouse, ...header } = raw;
  // Re-sorted by lineNumber — Prisma's `include` does not guarantee row
  // order (stock-adjustment-repository.ts's identical note).
  const normalizedItems: StockTransferItemDetail[] = items
    .slice()
    .sort((a, b) => a.lineNumber - b.lineNumber)
    .map((item) => ({
      id: item.id,
      stockTransferId: item.stockTransferId,
      lineNumber: item.lineNumber,
      productId: item.productId,
      productName: item.product.name,
      productCode: item.product.productCode,
      unitSymbol: item.product.unit.symbol,
      unitDecimalPlaces: item.product.unit.decimalPlaces,
      quantity: item.quantity.toNumber(),
    }));

  return {
    ...header,
    sourceWarehouseName: sourceWarehouse.name,
    destinationWarehouseName: destinationWarehouse.name,
    items: normalizedItems,
  };
}

function buildWhere(
  companyId: string,
  financialYearId: string,
  filters: StockTransferListFilters
): Prisma.StockTransferWhereInput {
  const where: Prisma.StockTransferWhereInput = { companyId, financialYearId };

  if (filters.status) {
    where.status = filters.status;
  }
  if (filters.sourceWarehouseId) {
    where.sourceWarehouseId = filters.sourceWarehouseId;
  }
  if (filters.destinationWarehouseId) {
    where.destinationWarehouseId = filters.destinationWarehouseId;
  }
  if (filters.fromDate || filters.toDate) {
    where.transferDate = {
      ...(filters.fromDate ? { gte: filters.fromDate } : {}),
      ...(filters.toDate ? { lte: filters.toDate } : {}),
    };
  }
  if (filters.search) {
    where.OR = [
      { transferNumber: { contains: filters.search, mode: "insensitive" } },
      { narration: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  return where;
}

export interface StockTransferHeaderPersistData {
  transferDate: Date;
  sourceWarehouseId: string;
  destinationWarehouseId: string;
  narration: string | null;
}

export interface StockTransferLinePersistData {
  productId: string;
  quantity: number;
}

export const stockTransferRepository = {
  async findMany(
    companyId: string,
    financialYearId: string,
    filters: StockTransferListFilters = {}
  ): Promise<StockTransferListRow[]> {
    const rows = await prisma.stockTransfer.findMany({
      where: buildWhere(companyId, financialYearId, filters),
      include: { ...WAREHOUSE_NAME_INCLUDE, _count: { select: { items: true } } },
      orderBy: [{ transferDate: "desc" }, { createdAt: "desc" }],
    });
    return rows.map(toStockTransferListRow);
  },

  /** Infinite-scroll page for the Stock Transfers list — same filters/
   * ordering as `findMany`, just `skip`/`take`-bounded. */
  async findManyPage(
    companyId: string,
    financialYearId: string,
    filters: StockTransferListFilters,
    page: PageParams
  ): Promise<Page<StockTransferListRow>> {
    const result = await fetchPage(
      (args) =>
        prisma.stockTransfer.findMany({
          where: buildWhere(companyId, financialYearId, filters),
          include: { ...WAREHOUSE_NAME_INCLUDE, _count: { select: { items: true } } },
          orderBy: [{ transferDate: "desc" }, { createdAt: "desc" }],
          ...args,
        }),
      page
    );
    return { items: result.items.map(toStockTransferListRow), hasMore: result.hasMore };
  },

  async findById(id: string, client: PrismaClientOrTransaction = prisma): Promise<StockTransferDetail | null> {
    const row = await client.stockTransfer.findUnique({ where: { id }, include: DETAIL_INCLUDE });
    return row ? toStockTransferDetail(row) : null;
  },

  async create(
    tx: Prisma.TransactionClient,
    companyId: string,
    financialYearId: string,
    header: StockTransferHeaderPersistData,
    lines: StockTransferLinePersistData[],
    createdByUserId: string
  ): Promise<StockTransferDetail> {
    const created = await tx.stockTransfer.create({
      data: {
        companyId,
        financialYearId,
        createdByUserId,
        ...header,
        items: { create: lines.map((line, index) => ({ ...line, lineNumber: index + 1 })) },
      },
      include: DETAIL_INCLUDE,
    });
    return toStockTransferDetail(created);
  },

  /** Delete-all-then-recreate the line set inside the caller's transaction —
   * mirrors stock-adjustment-repository.ts's replaceItemsAndUpdate. The
   * `allowedStatuses` guard is re-checked atomically here so a concurrent
   * status transition landing between the service's own check and this
   * write loses cleanly. */
  async replaceItemsAndUpdate(
    tx: Prisma.TransactionClient,
    id: string,
    companyId: string,
    allowedStatuses: readonly StockTransferStatus[],
    header: StockTransferHeaderPersistData,
    lines: StockTransferLinePersistData[]
  ): Promise<StockTransferDetail | null> {
    const existing = await tx.stockTransfer.findUnique({ where: { id } });
    if (!existing || existing.companyId !== companyId || !allowedStatuses.includes(existing.status)) {
      return null;
    }

    await tx.stockTransferItem.deleteMany({ where: { stockTransferId: id } });
    const updated = await tx.stockTransfer.update({
      where: { id },
      data: {
        ...header,
        items: { create: lines.map((line, index) => ({ ...line, lineNumber: index + 1 })) },
      },
      include: DETAIL_INCLUDE,
    });
    return toStockTransferDetail(updated);
  },

  /** Posting's own write — like Stock Adjustment, Stock Transfer's lines
   * carry no computed fields to refresh at posting time, so nothing here
   * replaces the item set; it only assigns `transferNumber` and flips
   * `status`, guarded by `WHERE status = 'DRAFT'` so a concurrent status
   * change loses cleanly. */
  async markPosted(
    tx: Prisma.TransactionClient,
    id: string,
    companyId: string,
    generated: GeneratedNumber
  ): Promise<StockTransferDetail | null> {
    const existing = await tx.stockTransfer.findUnique({ where: { id } });
    if (!existing || existing.companyId !== companyId || existing.status !== "DRAFT") {
      return null;
    }

    const updated = await tx.stockTransfer.update({
      where: { id },
      data: { transferNumber: generated.formatted, status: "POSTED" },
      include: DETAIL_INCLUDE,
    });
    return toStockTransferDetail(updated);
  },

  /** Guarded status transition — mirrors stock-adjustment-repository.ts's
   * updateStatus exactly. Drives Cancel (`POSTED -> CANCELLED`) only. */
  async updateStatus(
    client: PrismaClientOrTransaction,
    id: string,
    companyId: string,
    from: readonly StockTransferStatus[],
    to: StockTransferStatus
  ): Promise<number> {
    const result = await client.stockTransfer.updateMany({
      where: { id, companyId, status: { in: [...from] } },
      data: { status: to },
    });
    return result.count;
  },

  /** The line editor's product picker — active TRADING products only, since
   * only TRADING products may carry stock (mirrors
   * stock-adjustment-repository.ts's findSelectableProducts). */
  async findSelectableProducts(companyId: string): Promise<StockTransferProductOption[]> {
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

  /** The header's source/destination warehouse pickers — mirrors
   * stock-adjustment-repository.ts's findSelectableWarehouses. */
  async findSelectableWarehouses(companyId: string): Promise<StockTransferWarehouseOption[]> {
    return prisma.warehouse.findMany({
      where: { companyId, isActive: true },
      select: { id: true, name: true, code: true, isActive: true },
      orderBy: { name: "asc" },
    });
  },

  /** Company-scoped existence check for the product ids a create/update
   * draft submission references — deliberately NOT filtered by isActive/
   * productType (that re-validation is deferred to Posting), only by
   * companyId, so a cross-tenant id can never be persisted into a draft
   * (mirrors stock-adjustment-repository.ts's findProductsForLines). */
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

  /** Company-scoped existence check for the header's source/destination
   * warehouse ids — see findProductsForLines's identical reasoning. */
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
