import type { SerialNumber as PrismaSerialNumber } from "@prisma/client";

// Re-exported from the engine — the single canonical definition, derived per
// Decisions in 51-serial-number-tracking.md (mirrors types.ts's re-export of
// StockMovementLineInput/TransferStockInput from inventory-validation.ts).
import type { SerialStatus } from "@/engines/inventory/inventory-validation";

export type { SerialStatus } from "@/engines/inventory/inventory-validation";

// SerialNumber has no Decimal columns — no repository-boundary normalization
// needed (mirrors types/product-batch.ts's ProductBatch).
export type SerialNumber = PrismaSerialNumber;

/**
 * A serial row plus its derived current status/warehouse — `status` and
 * `currentWarehouseId` are never stored columns, always derived from the
 * serial's latest StockTransaction row (inventory-queries.ts's
 * getSerialStatus), computed at the repository boundary (mirrors
 * ProductBatchWithStock's identical "derived, not stored" convention).
 */
export interface SerialNumberWithStatus extends SerialNumber {
  status: SerialStatus;
  currentWarehouseId: string | null;
  /** Resolved alongside `currentWarehouseId` for display — null whenever that id is (mirrors ProductMasterOption's name-alongside-id convention). */
  currentWarehouseName: string | null;
}

export type SerialNumberStatusFilter = "all" | "active" | "inactive";

export interface SerialNumberListFilters {
  status?: SerialNumberStatusFilter;
}

/**
 * The `<SerialSelector>` read-model (51-serial-number-tracking.md's UI
 * section) — deliberately narrow, mirrors ProductBatchOption's convention:
 * only what a line editor's serial picker needs to render and validate a
 * selection. Filtered to currently IN_STOCK serials for an OUT-direction
 * line.
 */
export interface SerialNumberOption {
  id: string;
  serialValue: string;
}

export type ActivateSerialNumberResult =
  | { status: "not_found" }
  | { status: "ok"; serialNumber: SerialNumberWithStatus };

export type DeactivateSerialNumberResult =
  | { status: "not_found" }
  | { status: "ok"; serialNumber: SerialNumberWithStatus };
