import { z } from "zod";

import { GST_STATE_CODES } from "@/engines/gst/state-codes";

// Pure validation — no I/O, no Prisma client, no session lookups. Mirrors
// quotation-schema.ts's structure exactly (36-sales-orders.md's Validation
// section: "identical shape to quotation-schema.ts... plus
// expectedDeliveryDate").

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

export const SALES_ORDER_STATUS_VALUES = [
  "DRAFT",
  "CONFIRMED",
  "PARTIALLY_DELIVERED",
  "DELIVERED",
  "CLOSED",
  "CANCELLED",
] as const;

function hasAtMostDecimals(value: number, decimals: number): boolean {
  const factor = 10 ** decimals;
  return Math.abs(value * factor - Math.round(value * factor)) < 1e-6;
}

// The tighter "no more decimals than the selected product's unit allows"
// rule is unit-dependent, enforced server-side in sales-order-service.ts
// after the product/unit row loads (mirrors quotation-schema.ts).
const QUANTITY_SCHEMA = z
  .number("Quantity must be a number")
  .positive("Quantity must be greater than zero")
  .refine((value) => hasAtMostDecimals(value, 4), "Quantity can have at most 4 decimal places");

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

export const salesOrderLineSchema = z
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

export type SalesOrderLineInput = z.infer<typeof salesOrderLineSchema>;

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
const salesOrderBaseSchema = z.object({
  customerId: z.uuid("Select a valid customer"),
  orderDate: CALENDAR_DATE_SCHEMA,
  expectedDeliveryDate: EXPECTED_DELIVERY_DATE_SCHEMA,
  placeOfSupplyStateCode: PLACE_OF_SUPPLY_SCHEMA,
  narration: NARRATION_SCHEMA,
  lines: z.array(salesOrderLineSchema).min(1, "A sales order must have at least one line"),
});

function expectedDeliveryOnOrAfterOrderDate(data: { orderDate: string; expectedDeliveryDate?: string }): boolean {
  return (
    data.expectedDeliveryDate === undefined ||
    toUtcDate(data.expectedDeliveryDate) >= toUtcDate(data.orderDate)
  );
}

export const createSalesOrderSchema = salesOrderBaseSchema.refine(expectedDeliveryOnOrAfterOrderDate, {
  message: "Expected Delivery Date must be on or after the Order Date",
  path: ["expectedDeliveryDate"],
});

export type CreateSalesOrderInput = z.infer<typeof createSalesOrderSchema>;

// Create and Update share the same field set — every field remains editable
// while DRAFT (36-sales-orders.md's Business Rules). Kept as a separate
// named schema so a future spec can diverge them without touching callers.
export const updateSalesOrderSchema = createSalesOrderSchema;

export type UpdateSalesOrderInput = z.infer<typeof updateSalesOrderSchema>;

// A lenient variant for the live-editing preview Server Action — mirrors
// previewQuotationSchema. Never persisted.
export const previewSalesOrderSchema = salesOrderBaseSchema.extend({
  customerId: z.uuid("Select a valid customer").optional(),
  lines: z.array(salesOrderLineSchema),
});

export type PreviewSalesOrderInput = z.infer<typeof previewSalesOrderSchema>;
