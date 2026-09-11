import { z } from "zod";

// Pure validation — no I/O, no Prisma client, no session lookups. Mirrors
// purchase-return-schema.ts's structure. Quantity precision is unit-dependent
// (varies per product) and, per 47-stock-adjustment.md's Business Rules, is
// only re-validated at Posting time via inventoryEngine.recordMovements
// (no arithmetic outside the Inventory Engine) — a DRAFT is plain data
// storage, not yet a stock movement, so this schema only validates static
// shape.

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

/** `YYYY-MM-DD` -> UTC-midnight `Date`, the storage shape for `adjustmentDate` (`@db.Date`). */
export function toUtcDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

const CALENDAR_DATE_SCHEMA = z.string().trim().refine(isValidCalendarDate, "Enter a valid date");

export const STOCK_ADJUSTMENT_STATUS_VALUES = ["DRAFT", "POSTED", "CANCELLED"] as const;

const STOCK_DIRECTION_VALUES = ["IN", "OUT"] as const;

function emptyToUndefined(value: string): string | undefined {
  return value === "" ? undefined : value;
}

const NARRATION_SCHEMA = z
  .string()
  .trim()
  .max(500, "Narration must be at most 500 characters")
  .transform(emptyToUndefined)
  .optional();

export const stockAdjustmentLineSchema = z.object({
  productId: z.uuid("Select a valid product"),
  warehouseId: z.uuid("Select a valid warehouse"),
  direction: z.enum(STOCK_DIRECTION_VALUES, "Select a valid direction"),
  quantity: z.number("Quantity must be a number").positive("Quantity must be greater than zero"),
  narration: NARRATION_SCHEMA,
});

export type StockAdjustmentLineInput = z.infer<typeof stockAdjustmentLineSchema>;

// Header-level reason is required (the audit trail for why stock moved
// outside the normal sales/purchase/transfer flow); per-line narration above
// is optional supplementary detail.
const stockAdjustmentBaseSchema = z.object({
  adjustmentDate: CALENDAR_DATE_SCHEMA,
  reason: z.string().trim().min(1, "Reason is required").max(500, "Reason must be at most 500 characters"),
  lines: z.array(stockAdjustmentLineSchema).min(1, "A stock adjustment must have at least one line"),
});

// Create and Update share the same field set — every field remains editable
// while DRAFT (mirrors purchase-return-schema.ts's identical create/update sharing).
export const createStockAdjustmentSchema = stockAdjustmentBaseSchema;

export type CreateStockAdjustmentInput = z.infer<typeof createStockAdjustmentSchema>;

export const updateStockAdjustmentSchema = stockAdjustmentBaseSchema;

export type UpdateStockAdjustmentInput = z.infer<typeof updateStockAdjustmentSchema>;
