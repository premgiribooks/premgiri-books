import { z } from "zod";

// Pure validation — no I/O, no Prisma client, no session lookups. Mirrors
// purchase-return-schema.ts's structure. The tighter, unit-dependent quantity
// precision bound is enforced server-side by inventoryEngine.recordMovements
// itself once the product/unit loads (46-opening-stock.md's Code Standards:
// "no arithmetic outside the Inventory Engine") — this schema only validates
// the static shape every line must satisfy regardless of which product it
// names.

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

const CALENDAR_DATE_SCHEMA = z.string().trim().refine(isValidCalendarDate, "Enter a valid date");

function hasAtMostTwoDecimals(value: number): boolean {
  return Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;
}

function emptyToUndefined(value: string): string | undefined {
  return value === "" ? undefined : value;
}

const NARRATION_SCHEMA = z
  .string()
  .trim()
  .max(500, "Narration must be at most 500 characters")
  .transform(emptyToUndefined)
  .optional();

export const openingStockLineSchema = z.object({
  productId: z.uuid("Select a valid product"),
  warehouseId: z.uuid("Select a valid warehouse"),
  quantity: z.number("Quantity must be a number").positive("Quantity must be greater than zero"),
  unitCost: z
    .number("Unit cost must be a number")
    .nonnegative("Unit cost cannot be negative")
    .refine(hasAtMostTwoDecimals, "Unit cost can have at most 2 decimal places")
    .optional(),
  transactionDate: CALENDAR_DATE_SCHEMA,
  narration: NARRATION_SCHEMA,
});

export type OpeningStockLineInput = z.infer<typeof openingStockLineSchema>;

/** No (productId, warehouseId) pair may appear twice within one submission —
 * a duplicate within the same batch is exactly as contradictory as the
 * "no prior transaction for this pair" rule the service enforces against
 * existing rows, so it is rejected up front with a friendlier, structural
 * error (46-opening-stock.md's Business Rules). */
function linesHaveNoDuplicatePair(data: { lines: readonly { productId: string; warehouseId: string }[] }): boolean {
  const keys = data.lines.map((line) => `${line.productId}::${line.warehouseId}`);
  return new Set(keys).size === keys.length;
}

export const recordOpeningStockSchema = z
  .object({
    lines: z.array(openingStockLineSchema).min(1, "At least one line is required"),
  })
  .refine(linesHaveNoDuplicatePair, {
    message: "Each product/warehouse pair can only appear once in a single Opening Stock submission.",
    path: ["lines"],
  });

export type RecordOpeningStockInput = z.infer<typeof recordOpeningStockSchema>;
