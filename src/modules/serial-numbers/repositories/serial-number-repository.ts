import { Prisma } from "@prisma/client";

import { AppError } from "@/lib/app-error";
import { prisma } from "@/lib/prisma";
import { runInTransaction } from "@/lib/transaction";
import {
  deriveSerialStatus,
  type DerivedSerialStatus,
  type SerialMovementRecord,
} from "@/engines/inventory/inventory-validation";
import type { CreateSerialNumberInput } from "@/modules/serial-numbers/validation/serial-number-schema";
import type {
  SerialNumber,
  SerialNumberListFilters,
  SerialNumberOption,
  SerialNumberWithStatus,
} from "@/types/serial-number";

function buildWhere(
  companyId: string,
  productId: string,
  filters: SerialNumberListFilters
): Prisma.SerialNumberWhereInput {
  const where: Prisma.SerialNumberWhereInput = { companyId, productId };
  if (filters.status === "active") {
    where.isActive = true;
  } else if (filters.status === "inactive") {
    where.isActive = false;
  }
  return where;
}

/**
 * Every StockTransaction row for the given product's serials, grouped by
 * serialId — one query for the whole list, no N+1 (mirrors product-batch-
 * repository.ts's aggregateStockByBatchId, but this module derives a status
 * label from the full row shape via the shared `deriveSerialStatus`, not
 * merely a summed quantity — 51-serial-number-tracking.md's Decisions:
 * `SerialNumber` has no stored status column).
 */
async function findMovementHistoryByProduct(
  companyId: string,
  productId: string
): Promise<Map<string, SerialMovementRecord[]>> {
  const rows = await prisma.stockTransaction.findMany({
    where: { companyId, productId, serialId: { not: null } },
    select: { serialId: true, direction: true, transactionType: true, warehouseId: true, createdAt: true },
  });

  const historyBySerialId = new Map<string, SerialMovementRecord[]>();
  for (const row of rows) {
    if (!row.serialId) {
      continue;
    }
    const existing = historyBySerialId.get(row.serialId) ?? [];
    existing.push({
      direction: row.direction,
      transactionType: row.transactionType,
      warehouseId: row.warehouseId,
      createdAt: row.createdAt,
    });
    historyBySerialId.set(row.serialId, existing);
  }
  return historyBySerialId;
}

/** Name lookup for whichever warehouse ids `deriveSerialStatus` resolved as a serial's current location — one query for however many distinct warehouses the whole list touches. */
async function resolveWarehouseNames(warehouseIds: readonly string[]): Promise<Map<string, string>> {
  if (warehouseIds.length === 0) {
    return new Map();
  }
  const rows = await prisma.warehouse.findMany({
    where: { id: { in: [...warehouseIds] } },
    select: { id: true, name: true },
  });
  return new Map(rows.map((row) => [row.id, row.name]));
}

function toWithStatus(
  serial: SerialNumber,
  derived: DerivedSerialStatus,
  warehouseNameById: ReadonlyMap<string, string>
): SerialNumberWithStatus {
  return {
    ...serial,
    status: derived.status,
    currentWarehouseId: derived.warehouseId,
    currentWarehouseName: derived.warehouseId ? (warehouseNameById.get(derived.warehouseId) ?? null) : null,
  };
}

export const serialNumberRepository = {
  /** The Serial Numbers tab's list — every serial of one product, joined with its derived status/warehouse. */
  async findManyWithStatus(
    companyId: string,
    productId: string,
    filters: SerialNumberListFilters = {}
  ): Promise<SerialNumberWithStatus[]> {
    const [serials, historyBySerialId] = await Promise.all([
      prisma.serialNumber.findMany({
        where: buildWhere(companyId, productId, filters),
        orderBy: { serialValue: "asc" },
      }),
      findMovementHistoryByProduct(companyId, productId),
    ]);

    const derivedBySerialId = new Map(
      serials.map((serial) => [serial.id, deriveSerialStatus(historyBySerialId.get(serial.id) ?? [])])
    );
    const warehouseIds = [...new Set([...derivedBySerialId.values()].flatMap((d) => (d.warehouseId ? [d.warehouseId] : [])))];
    const warehouseNameById = await resolveWarehouseNames(warehouseIds);

    return serials.map((serial) =>
      toWithStatus(serial, derivedBySerialId.get(serial.id)!, warehouseNameById)
    );
  },

  /** One serial joined with its own derived status/warehouse — the service's getSerialNumber/getSerialStatus primitive. */
  async findByIdWithStatus(id: string): Promise<SerialNumberWithStatus | null> {
    const serial = await prisma.serialNumber.findUnique({ where: { id } });
    if (!serial) {
      return null;
    }
    const rows = await prisma.stockTransaction.findMany({
      where: { serialId: id },
      select: { direction: true, transactionType: true, warehouseId: true, createdAt: true },
    });
    const derived = deriveSerialStatus(rows);
    const warehouseNameById = await resolveWarehouseNames(derived.warehouseId ? [derived.warehouseId] : []);
    return toWithStatus(serial, derived, warehouseNameById);
  },

  // No Serializable isolation on create — no cross-row invariant to guard
  // beyond the DB's own unique constraint (mirrors productBatchRepository.create()).
  async create(companyId: string, data: CreateSerialNumberInput): Promise<SerialNumberWithStatus> {
    return runInTransaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: data.productId },
        select: { id: true, companyId: true, isSerialTracked: true },
      });
      if (!product || product.companyId !== companyId) {
        throw new AppError("Product not found.");
      }
      if (!product.isSerialTracked) {
        throw new AppError("This product is not serial-tracked — enable serial tracking on the product first.");
      }

      const serial = await tx.serialNumber.create({
        data: {
          companyId,
          productId: data.productId,
          serialValue: data.serialValue,
        },
      });
      return toWithStatus(serial, { status: "NO_MOVEMENTS", warehouseId: null }, new Map());
    });
  },

  /** Deactivate/activate — no invariant to guard (mirrors every other master's toggle); status/warehouse recomputed for the caller's read-model. */
  async setActive(
    id: string,
    companyId: string,
    isActive: boolean
  ): Promise<{ status: "not_found" } | { status: "ok"; serialNumber: SerialNumberWithStatus }> {
    const existing = await prisma.serialNumber.findUnique({ where: { id } });
    if (!existing || existing.companyId !== companyId) {
      return { status: "not_found" };
    }

    const updated = await prisma.serialNumber.update({ where: { id }, data: { isActive } });
    const rows = await prisma.stockTransaction.findMany({
      where: { serialId: id },
      select: { direction: true, transactionType: true, warehouseId: true, createdAt: true },
    });
    const derived = deriveSerialStatus(rows);
    const warehouseNameById = await resolveWarehouseNames(derived.warehouseId ? [derived.warehouseId] : []);
    return { status: "ok", serialNumber: toWithStatus(updated, derived, warehouseNameById) };
  },

  /** The `<SerialSelector>` read-model — active, currently IN_STOCK serials only, optionally narrowed to one warehouse. */
  async findOptionsForSelector(
    companyId: string,
    productId: string,
    warehouseId?: string
  ): Promise<SerialNumberOption[]> {
    const [serials, historyBySerialId] = await Promise.all([
      prisma.serialNumber.findMany({
        where: { companyId, productId, isActive: true },
        orderBy: { serialValue: "asc" },
      }),
      findMovementHistoryByProduct(companyId, productId),
    ]);

    return serials
      .filter((serial) => {
        const derived = deriveSerialStatus(historyBySerialId.get(serial.id) ?? []);
        return derived.status === "IN_STOCK" && (!warehouseId || derived.warehouseId === warehouseId);
      })
      .map((serial) => ({ id: serial.id, serialValue: serial.serialValue }));
  },
};
