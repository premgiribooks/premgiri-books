import { z } from "zod";

// Pure validation — no I/O, no Prisma client, no session lookups. Mirrors
// stock-adjustment-schema.ts's structure. Quantity precision is
// unit-dependent (varies per product) and, per 48-stock-transfer.md's
// Business Rules, is only re-validated at Posting time via
// inventoryEngine.transferStock (no arithmetic outside the Inventory
// Engine) — a DRAFT is plain data storage, not yet a stock movement, so
// this schema only validates static shape.

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function isValidCalendarDate(value: string): boolean {
  if (!DATE_REGEX.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return false;
  }
  return date.toISOString().slice(0, 10) === value;
}

/** `YYYY-MM-DD` -> UTC-midnight `Date`, the storage shape for `transferDate` (`@db.Date`). */
export function toUtcDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

const CALENDAR_DATE_SCHEMA = z.string().trim().refine(isValidCalendarDate, "Enter a valid date");

export const STOCK_TRANSFER_STATUS_VALUES = ["DRAFT", "POSTED", "CANCELLED"] as const;

function emptyToUndefined(value: string): string | undefined {
  return value === "" ? undefined : value;
}

const NARRATION_SCHEMA = z
  .string()
  .trim()
  .max(500, "Narration must be at most 500 characters")
  .transform(emptyToUndefined)
  .optional();

export const stockTransferLineSchema = z.object({
  productId: z.uuid("Select a valid product"),
  quantity: z.number("Quantity must be a number").positive("Quantity must be greater than zero"),
});

export type StockTransferLineInput = z.infer<typeof stockTransferLineSchema>;

// sourceWarehouseId/destinationWarehouseId are header-level (48-stock-transfer.md's
// Data Model: "a single Stock Transfer document moves goods between exactly
// two warehouses") — the object-level refine rejects them being equal
// before any engine call, the document-level friendly error the spec calls
// for.
const stockTransferBaseSchema = z
  .object({
    transferDate: CALENDAR_DATE_SCHEMA,
    sourceWarehouseId: z.uuid("Select a valid source warehouse"),
    destinationWarehouseId: z.uuid("Select a valid destination warehouse"),
    narration: NARRATION_SCHEMA,
    lines: z.array(stockTransferLineSchema).min(1, "A stock transfer must have at least one line"),
  })
  .refine((data) => data.sourceWarehouseId !== data.destinationWarehouseId, {
    message: "Source and destination warehouse must be different",
    path: ["destinationWarehouseId"],
  });

// Create and Update share the same field set — every field remains editable
// while DRAFT (mirrors stock-adjustment-schema.ts's identical create/update sharing).
export const createStockTransferSchema = stockTransferBaseSchema;

export type CreateStockTransferInput = z.infer<typeof createStockTransferSchema>;

export const updateStockTransferSchema = stockTransferBaseSchema;

export type UpdateStockTransferInput = z.infer<typeof updateStockTransferSchema>;
