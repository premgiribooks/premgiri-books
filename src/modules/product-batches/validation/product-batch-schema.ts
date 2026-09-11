import { z } from "zod";

import { isValidCalendarDate } from "@/engines/inventory/inventory-validation";

// Reuses the Inventory Engine's calendar-date convention (isValidCalendarDate
// rejects a date like 2026-02-30 that `Date` would otherwise silently roll
// over) rather than re-deriving it — code-standards.md's "never duplicate
// logic" — even though this is a product-master module, not the engine
// itself. manufactureDate/expiryDate are @db.Date, the same storage shape.
const BATCH_DATE_SCHEMA = z.string().trim().refine(isValidCalendarDate, "Enter a valid date").optional();

const BATCH_NUMBER_SCHEMA = z
  .string()
  .trim()
  .min(1, "Batch number is required")
  .max(50, "Batch number must be at most 50 characters");

// Lexical comparison is correct for two YYYY-MM-DD strings.
function isExpiryOnOrAfterManufacture(data: { manufactureDate?: string; expiryDate?: string }): boolean {
  if (!data.manufactureDate || !data.expiryDate) {
    return true;
  }
  return data.expiryDate >= data.manufactureDate;
}

const DATE_ORDER_REFINEMENT = {
  message: "Expiry date cannot be before the manufacture date",
  path: ["expiryDate"],
};

export const createProductBatchSchema = z
  .object({
    productId: z.uuid("Select a valid product"),
    batchNumber: BATCH_NUMBER_SCHEMA,
    manufactureDate: BATCH_DATE_SCHEMA,
    expiryDate: BATCH_DATE_SCHEMA,
  })
  .refine(isExpiryOnOrAfterManufacture, DATE_ORDER_REFINEMENT);

export type CreateProductBatchInput = z.infer<typeof createProductBatchSchema>;

// No productId — a batch's product never changes after creation (mirrors
// how every master's update schema omits identity-defining fields it never
// re-parents).
export const updateProductBatchSchema = z
  .object({
    batchNumber: BATCH_NUMBER_SCHEMA,
    manufactureDate: BATCH_DATE_SCHEMA,
    expiryDate: BATCH_DATE_SCHEMA,
  })
  .refine(isExpiryOnOrAfterManufacture, DATE_ORDER_REFINEMENT);

export type UpdateProductBatchInput = z.infer<typeof updateProductBatchSchema>;
