import { Prisma, type PhysicalVerificationStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { GeneratedNumber } from "@/engines/document-number/types";
import type {
  PhysicalVerificationDetail,
  PhysicalVerificationItemDetail,
  PhysicalVerificationListFilters,
  PhysicalVerificationListRow,
  PhysicalVerificationProductOption,
  PhysicalVerificationWarehouseOption,
} from "@/types/physical-verification";

type PrismaClientOrTransaction = typeof prisma | Prisma.TransactionClient;

const WAREHOUSE_NAME_INCLUDE = {
  warehouse: { select: { name: true } },
} as const;

const DETAIL_INCLUDE = {
  ...WAREHOUSE_NAME_INCLUDE,
  items: {
    include: {
      product: { select: { name: true, productCode: true, unit: { select: { symbol: true, decimalPlaces: true } } } },
    },
  },
} as const;

type PhysicalVerificationListRowRaw = Prisma.PhysicalVerificationGetPayload<{
  include: typeof WAREHOUSE_NAME_INCLUDE & { _count: { select: { items: true } } };
}>;
type PhysicalVerificationDetailRaw = Prisma.PhysicalVerificationGetPayload<{ include: typeof DETAIL_INCLUDE }>;

function toPhysicalVerificationListRow(raw: PhysicalVerificationListRowRaw): PhysicalVerificationListRow {
  const { _count, warehouse, ...header } = raw;
  return { ...header, warehouseName: warehouse.name, lineCount: _count.items };
}

function toPhysicalVerificationDetail(raw: PhysicalVerificationDetailRaw): PhysicalVerificationDetail {
  const { items, warehouse, ...header } = raw;
  // Re-sorted by lineNumber — Prisma's `include` does not guarantee row
  // order (stock-adjustment-repository.ts's identical note).
  const normalizedItems: PhysicalVerificationItemDetail[] = items
    .slice()
    .sort((a, b) => a.lineNumber - b.lineNumber)
    .map((item) => ({
      id: item.id,
      physicalVerificationId: item.physicalVerificationId,
      lineNumber: item.lineNumber,
      productId: item.productId,
      productName: item.product.name,
      productCode: item.product.productCode,
      unitSymbol: item.product.unit.symbol,
      unitDecimalPlaces: item.product.unit.decimalPlaces,
      systemQuantity: item.systemQuantity.toNumber(),
      countedQuantity: item.countedQuantity.toNumber(),
      varianceQuantity: item.varianceQuantity.toNumber(),
    }));

  return { ...header, warehouseName: warehouse.name, items: normalizedItems };
}

function buildWhere(
  companyId: string,
  financialYearId: string,
  filters: PhysicalVerificationListFilters
): Prisma.PhysicalVerificationWhereInput {
  const where: Prisma.PhysicalVerificationWhereInput = { companyId, financialYearId };

  if (filters.status) {
    where.status = filters.status;
  }
  if (filters.warehouseId) {
    where.warehouseId = filters.warehouseId;
  }
  if (filters.fromDate || filters.toDate) {
    where.verificationDate = {
      ...(filters.fromDate ? { gte: filters.fromDate } : {}),
      ...(filters.toDate ? { lte: filters.toDate } : {}),
    };
  }
  if (filters.search) {
    where.OR = [
      { verificationNumber: { contains: filters.search, mode: "insensitive" } },
      { narration: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  return where;
}

export interface PhysicalVerificationHeaderPersistData {
  verificationDate: Date;
  warehouseId: string;
  narration: string | null;
}

export interface PhysicalVerificationLinePersistData {
  productId: string;
  countedQuantity: number;
  // Placeholders only — always 0 at draft-creation/update time, overwritten
  // exclusively by completeWithComputedItems below (49-physical-verification.md's
  // Data Model Decisions: "never client-supplied, never trusted from the
  // draft-time UI preview").
  systemQuantity: number;
  varianceQuantity: number;
}

export interface PhysicalVerificationCompletedLine {
  id: string;
  systemQuantity: number;
  varianceQuantity: number;
}

export const physicalVerificationRepository = {
  async findMany(
    companyId: string,
    financialYearId: string,
    filters: PhysicalVerificationListFilters = {}
  ): Promise<PhysicalVerificationListRow[]> {
    const rows = await prisma.physicalVerification.findMany({
      where: buildWhere(companyId, financialYearId, filters),
      include: { ...WAREHOUSE_NAME_INCLUDE, _count: { select: { items: true } } },
      orderBy: [{ verificationDate: "desc" }, { createdAt: "desc" }],
    });
    return rows.map(toPhysicalVerificationListRow);
  },

  async findById(id: string, client: PrismaClientOrTransaction = prisma): Promise<PhysicalVerificationDetail | null> {
    const row = await client.physicalVerification.findUnique({ where: { id }, include: DETAIL_INCLUDE });
    return row ? toPhysicalVerificationDetail(row) : null;
  },

  async create(
    tx: Prisma.TransactionClient,
    companyId: string,
    financialYearId: string,
    header: PhysicalVerificationHeaderPersistData,
    lines: PhysicalVerificationLinePersistData[],
    createdByUserId: string
  ): Promise<PhysicalVerificationDetail> {
    const created = await tx.physicalVerification.create({
      data: {
        companyId,
        financialYearId,
        createdByUserId,
        ...header,
        items: { create: lines.map((line, index) => ({ ...line, lineNumber: index + 1 })) },
      },
      include: DETAIL_INCLUDE,
    });
    return toPhysicalVerificationDetail(created);
  },

  /** Delete-all-then-recreate the line set inside the caller's transaction —
   * mirrors stock-transfer-repository.ts's replaceItemsAndUpdate. The
   * `allowedStatuses` guard is re-checked atomically here so a concurrent
   * status transition landing between the service's own check and this
   * write loses cleanly. */
  async replaceItemsAndUpdate(
    tx: Prisma.TransactionClient,
    id: string,
    companyId: string,
    allowedStatuses: readonly PhysicalVerificationStatus[],
    header: PhysicalVerificationHeaderPersistData,
    lines: PhysicalVerificationLinePersistData[]
  ): Promise<PhysicalVerificationDetail | null> {
    const existing = await tx.physicalVerification.findUnique({ where: { id } });
    if (!existing || existing.companyId !== companyId || !allowedStatuses.includes(existing.status)) {
      return null;
    }

    await tx.physicalVerificationItem.deleteMany({ where: { physicalVerificationId: id } });
    const updated = await tx.physicalVerification.update({
      where: { id },
      data: {
        ...header,
        items: { create: lines.map((line, index) => ({ ...line, lineNumber: index + 1 })) },
      },
      include: DETAIL_INCLUDE,
    });
    return toPhysicalVerificationDetail(updated);
  },

  /** Completion's own write — unlike Post on the sibling documents, Physical
   * Verification's lines DO carry computed fields to refresh (systemQuantity/
   * varianceQuantity, freshly re-derived by the service inside this same
   * transaction) — so, in addition to assigning `verificationNumber` and
   * flipping `status`, every item row is updated individually. Sequential,
   * not Promise.all — mirrors stock-transfer-service.ts's per-line posting
   * loop ("a later line's failure must not race ahead"). Guarded by
   * `WHERE status = 'DRAFT'` so a concurrent status change loses cleanly. */
  async completeWithComputedItems(
    tx: Prisma.TransactionClient,
    id: string,
    companyId: string,
    generated: GeneratedNumber,
    computedItems: readonly PhysicalVerificationCompletedLine[]
  ): Promise<PhysicalVerificationDetail | null> {
    const existing = await tx.physicalVerification.findUnique({ where: { id } });
    if (!existing || existing.companyId !== companyId || existing.status !== "DRAFT") {
      return null;
    }

    for (const item of computedItems) {
      await tx.physicalVerificationItem.update({
        where: { id: item.id },
        data: { systemQuantity: item.systemQuantity, varianceQuantity: item.varianceQuantity },
      });
    }

    const updated = await tx.physicalVerification.update({
      where: { id },
      data: { verificationNumber: generated.formatted, status: "COMPLETED" },
      include: DETAIL_INCLUDE,
    });
    return toPhysicalVerificationDetail(updated);
  },

  /** Guarded status transition — mirrors stock-transfer-repository.ts's
   * updateStatus exactly. Drives Cancel (`DRAFT -> CANCELLED`) only — no
   * stock was ever posted for a DRAFT, so no reversal is needed. */
  async updateStatus(
    client: PrismaClientOrTransaction,
    id: string,
    companyId: string,
    from: readonly PhysicalVerificationStatus[],
    to: PhysicalVerificationStatus
  ): Promise<number> {
    const result = await client.physicalVerification.updateMany({
      where: { id, companyId, status: { in: [...from] } },
      data: { status: to },
    });
    return result.count;
  },

  /** The line editor's product picker — active TRADING products only, since
   * only TRADING products may carry stock (mirrors
   * stock-transfer-repository.ts's findSelectableProducts). */
  async findSelectableProducts(companyId: string): Promise<PhysicalVerificationProductOption[]> {
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

  /** The header's warehouse picker — mirrors
   * stock-transfer-repository.ts's findSelectableWarehouses. */
  async findSelectableWarehouses(companyId: string): Promise<PhysicalVerificationWarehouseOption[]> {
    return prisma.warehouse.findMany({
      where: { companyId, isActive: true },
      select: { id: true, name: true, code: true, isActive: true },
      orderBy: { name: "asc" },
    });
  },

  /** Company-scoped existence check for the product ids a create/update
   * draft submission references — deliberately NOT filtered by isActive/
   * productType (that re-validation is deferred to completion), only by
   * companyId, so a cross-tenant id can never be persisted into a draft
   * (mirrors stock-transfer-repository.ts's findProductsForLines). */
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

  /** Company-scoped existence check for the header's warehouse id — see
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

  /** Completion-time re-validation read — unlike findProductsForLines above,
   * this DOES surface isActive/productType/name, since
   * 49-physical-verification.md's Business Rules requires re-validating
   * every line's product (active, company-owned, TRADING) at completion,
   * including zero-variance lines that never reach
   * inventoryEngine.recordMovements (which only re-validates the lines
   * actually handed to it). */
  async findProductsForCompletion(
    client: PrismaClientOrTransaction,
    companyId: string,
    productIds: readonly string[]
  ): Promise<{ id: string; name: string; isActive: boolean; productType: string }[]> {
    if (productIds.length === 0) {
      return [];
    }
    return client.product.findMany({
      where: { companyId, id: { in: [...productIds] } },
      select: { id: true, name: true, isActive: true, productType: true },
    });
  },

  /** Completion-time re-validation read for the header's single warehouse —
   * see findProductsForCompletion's identical reasoning. */
  async findWarehouseForCompletion(
    client: PrismaClientOrTransaction,
    companyId: string,
    warehouseId: string
  ): Promise<{ id: string; name: string; isActive: boolean } | null> {
    const warehouse = await client.warehouse.findUnique({
      where: { id: warehouseId },
      select: { id: true, companyId: true, name: true, isActive: true },
    });
    if (!warehouse || warehouse.companyId !== companyId) {
      return null;
    }
    return { id: warehouse.id, name: warehouse.name, isActive: warehouse.isActive };
  },
};
