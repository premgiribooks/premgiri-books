import { z } from "zod";

// Pure validation — no I/O, no Prisma client, no session lookups. Mirrors
// stock-transfer-schema.ts's structure. `systemQuantity`/`varianceQuantity`
// are deliberately absent from every schema below — per
// 49-physical-verification.md's Validation section, they are never accepted
// as client input on the write path; z.object() strips any unknown key a
// submitted payload might carry, so they are ignored, not merely rejected.
// Quantity precision (unit-dependent) is only re-validated at completion
// time via inventoryEngine.recordMovements (no arithmetic outside the
// Inventory Engine) — a DRAFT is plain data storage, not yet a stock
// movement, so this schema only validates static shape.

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

/** `YYYY-MM-DD` -> UTC-midnight `Date`, the storage shape for `verificationDate` (`@db.Date`). */
export function toUtcDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

const CALENDAR_DATE_SCHEMA = z.string().trim().refine(isValidCalendarDate, "Enter a valid date");

export const PHYSICAL_VERIFICATION_STATUS_VALUES = ["DRAFT", "COMPLETED", "CANCELLED"] as const;

function emptyToUndefined(value: string): string | undefined {
  return value === "" ? undefined : value;
}

const NARRATION_SCHEMA = z
  .string()
  .trim()
  .max(500, "Narration must be at most 500 characters")
  .transform(emptyToUndefined)
  .optional();

// Zero is a legal count ("found none"), distinct from omitting the line
// entirely — nonnegative(), not positive(), unlike Stock Adjustment/
// Transfer's quantity lines.
export const physicalVerificationLineSchema = z.object({
  productId: z.uuid("Select a valid product"),
  countedQuantity: z.number("Counted quantity must be a number").nonnegative("Counted quantity cannot be negative"),
});

export type PhysicalVerificationLineInput = z.infer<typeof physicalVerificationLineSchema>;

const physicalVerificationBaseSchema = z.object({
  verificationDate: CALENDAR_DATE_SCHEMA,
  warehouseId: z.uuid("Select a valid warehouse"),
  narration: NARRATION_SCHEMA,
  lines: z.array(physicalVerificationLineSchema).min(1, "A physical verification must have at least one line"),
});

// Create and Update share the same field set — every field remains editable
// while DRAFT (mirrors stock-transfer-schema.ts's identical create/update sharing).
export const createPhysicalVerificationSchema = physicalVerificationBaseSchema;

export type CreatePhysicalVerificationInput = z.infer<typeof createPhysicalVerificationSchema>;

export const updatePhysicalVerificationSchema = physicalVerificationBaseSchema;

export type UpdatePhysicalVerificationInput = z.infer<typeof updatePhysicalVerificationSchema>;
