import { z } from "zod";

import { GST_STATE_CODES } from "@/engines/gst/state-codes";

// Pure validation — no I/O, no Prisma client, no session lookups. Mirrors
// sales-order-schema.ts's structure exactly (42-purchase-orders.md's
// Validation section: "the same shape as sales-order-schema.ts with
// supplierId in place of customerId, and no resolvePrice-derived default").

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

/** `YYYY-MM-DD` -> UTC-midnight `Date`, the storage shape for `orderDate`/`expectedDeliveryDate` (`@db.Date`). */
export function toUtcDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

const CALENDAR_DATE_SCHEMA = z.string().trim().refine(isValidCalendarDate, "Enter a valid date");

const PLACE_OF_SUPPLY_VALUES = GST_STATE_CODES.map((entry) => entry.code) as [string, ...string[]];

export const PLACE_OF_SUPPLY_SCHEMA = z.enum(PLACE_OF_SUPPLY_VALUES, "Select a valid state");

export const PURCHASE_ORDER_STATUS_VALUES = [
  "DRAFT",
  "CONFIRMED",
  "PARTIALLY_RECEIVED",
  "RECEIVED",
  "CLOSED",
  "CANCELLED",
] as const;

function hasAtMostDecimals(value: number, decimals: number): boolean {
  const factor = 10 ** decimals;
  return Math.abs(value * factor - Math.round(value * factor)) < 1e-6;
}

// The tighter "no more decimals than the selected product's unit allows"
// rule is unit-dependent, enforced server-side in purchase-order-service.ts
// after the product/unit row loads (mirrors sales-order-schema.ts).
const QUANTITY_SCHEMA = z
  .number("Quantity must be a number")
  .positive("Quantity must be greater than zero")
  .refine((value) => hasAtMostDecimals(value, 4), "Quantity can have at most 4 decimal places");

// No below-cost concept applies to a purchase (code-standards.md's Pricing
// Rules: that check is a selling-side rule only) — otherwise identical to
// sales-order-schema.ts's RATE_SCHEMA.
const RATE_SCHEMA = z
  .number("Rate must be a number")
  .min(0, "Rate cannot be negative")
  .max(999_999_999_999.99, "Rate is too large")
  .refine((value) => hasAtMostDecimals(value, 2), "Rate can have at most 2 decimal places");

const DISCOUNT_PERCENT_SCHEMA = z
  .number("Discount percent must be a number")
  .min(0, "Discount percent must be between 0 and 100")
  .max(100, "Discount percent must be between 0 and 100")
  .refine((value) => hasAtMostDecimals(value, 2), "Discount percent can have at most 2 decimal places")
  .optional();

const DISCOUNT_AMOUNT_SCHEMA = z
  .number("Discount amount must be a number")
  .min(0, "Discount amount cannot be negative")
  .refine((value) => hasAtMostDecimals(value, 2), "Discount amount can have at most 2 decimal places")
  .optional();

export const purchaseOrderLineSchema = z
  .object({
    productId: z.uuid("Select a valid product"),
    quantity: QUANTITY_SCHEMA,
    rate: RATE_SCHEMA,
    discountPercent: DISCOUNT_PERCENT_SCHEMA,
    discountAmount: DISCOUNT_AMOUNT_SCHEMA,
  })
  .refine(
    (line) => {
      const gross = line.quantity * line.rate;
      const percentPortion = (gross * (line.discountPercent ?? 0)) / 100;
      const combined = (line.discountAmount ?? 0) + percentPortion;
      return combined <= gross + 1e-6;
    },
    {
      message: "The total discount on this line cannot exceed the line's value.",
      path: ["discountAmount"],
    }
  );

export type PurchaseOrderLineInput = z.infer<typeof purchaseOrderLineSchema>;

const EXPECTED_DELIVERY_DATE_SCHEMA = z
  .string()
  .trim()
  .transform((value) => (value === "" ? undefined : value))
  .optional()
  .refine((value) => value === undefined || isValidCalendarDate(value), "Enter a valid date");

const NARRATION_SCHEMA = z
  .string()
  .trim()
  .max(500, "Narration must be at most 500 characters")
  .transform((value) => (value === "" ? undefined : value))
  .optional();

// Base header+lines shape shared by the strict create/update schema and the
// lenient live-preview schema below.
const purchaseOrderBaseSchema = z.object({
  supplierId: z.uuid("Select a valid supplier"),
  orderDate: CALENDAR_DATE_SCHEMA,
  expectedDeliveryDate: EXPECTED_DELIVERY_DATE_SCHEMA,
  placeOfSupplyStateCode: PLACE_OF_SUPPLY_SCHEMA,
  narration: NARRATION_SCHEMA,
  lines: z.array(purchaseOrderLineSchema).min(1, "A purchase order must have at least one line"),
});

function expectedDeliveryOnOrAfterOrderDate(data: { orderDate: string; expectedDeliveryDate?: string }): boolean {
  return (
    data.expectedDeliveryDate === undefined ||
    toUtcDate(data.expectedDeliveryDate) >= toUtcDate(data.orderDate)
  );
}

export const createPurchaseOrderSchema = purchaseOrderBaseSchema.refine(expectedDeliveryOnOrAfterOrderDate, {
  message: "Expected Delivery Date must be on or after the Order Date",
  path: ["expectedDeliveryDate"],
});

export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>;

// Create and Update share the same field set — every field remains editable
// while DRAFT (42-purchase-orders.md's Business Rules). Kept as a separate
// named schema so a future spec can diverge them without touching callers.
export const updatePurchaseOrderSchema = createPurchaseOrderSchema;

export type UpdatePurchaseOrderInput = z.infer<typeof updatePurchaseOrderSchema>;

// A lenient variant for the live-editing preview Server Action — mirrors
// previewSalesOrderSchema. Never persisted.
export const previewPurchaseOrderSchema = purchaseOrderBaseSchema.extend({
  supplierId: z.uuid("Select a valid supplier").optional(),
  lines: z.array(purchaseOrderLineSchema),
});

export type PreviewPurchaseOrderInput = z.infer<typeof previewPurchaseOrderSchema>;
