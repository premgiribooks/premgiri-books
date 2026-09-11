import { z } from "zod";

// Mirrors product-batches/validation/product-batch-schema.ts's shape — a
// serial's identity is a single required string, no dates (51-serial-
// number-tracking.md's Validation section).
const SERIAL_VALUE_SCHEMA = z
  .string()
  .trim()
  .min(1, "Serial value is required")
  .max(100, "Serial value must be at most 100 characters");

export const createSerialNumberSchema = z.object({
  productId: z.uuid("Select a valid product"),
  serialValue: SERIAL_VALUE_SCHEMA,
});

export type CreateSerialNumberInput = z.infer<typeof createSerialNumberSchema>;
