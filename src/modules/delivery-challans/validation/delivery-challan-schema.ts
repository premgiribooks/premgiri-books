import { z } from "zod";

// Pure validation — no I/O, no Prisma client, no session lookups. Mirrors
// sales-order-schema.ts's structure (37-delivery-challans.md's Validation
// section), minus every pricing/GST field this document deliberately omits.

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

/** `YYYY-MM-DD` -> UTC-midnight `Date`, the storage shape for `challanDate` (`@db.Date`). */
export function toUtcDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

const CALENDAR_DATE_SCHEMA = z.string().trim().refine(isValidCalendarDate, "Enter a valid date");

export const DELIVERY_CHALLAN_STATUS_VALUES = ["DRAFT", "DISPATCHED", "INVOICED", "CANCELLED"] as const;

function hasAtMostDecimals(value: number, decimals: number): boolean {
  const factor = 10 ** decimals;
  return Math.abs(value * factor - Math.round(value * factor)) < 1e-6;
}

// The tighter "no more decimals than the selected product's unit allows"
// rule is unit-dependent, enforced server-side in delivery-challan-service.ts
// after the product/unit row loads (mirrors sales-order-schema.ts).
const QUANTITY_SCHEMA = z
  .number("Quantity must be a number")
  .positive("Quantity must be greater than zero")
  .refine((value) => hasAtMostDecimals(value, 4), "Quantity can have at most 4 decimal places");

const NARRATION_SCHEMA = z
  .string()
  .trim()
  .max(500, "Narration must be at most 500 characters")
  .transform((value) => (value === "" ? undefined : value))
  .optional();

export const deliveryChallanLineSchema = z.object({
  productId: z.uuid("Select a valid product"),
  warehouseId: z.uuid("Select a valid warehouse"),
  quantity: QUANTITY_SCHEMA,
  // Conditionally required/forbidden at the object level below — a line
  // cannot reference an order item the header itself doesn't link to
  // (37-delivery-challans.md's Data Model decision).
  salesOrderItemId: z.uuid("Select a valid order line").optional(),
});

export type DeliveryChallanLineInput = z.infer<typeof deliveryChallanLineSchema>;

const deliveryChallanBaseSchema = z.object({
  customerId: z.uuid("Select a valid customer"),
  salesOrderId: z.uuid("Select a valid sales order").optional(),
  challanDate: CALENDAR_DATE_SCHEMA,
  narration: NARRATION_SCHEMA,
  lines: z.array(deliveryChallanLineSchema).min(1, "A delivery challan must have at least one line"),
});

// "Linkage is conditional, not independently optional per line": when
// salesOrderId is set, every line MUST carry a salesOrderItemId; when it's
// absent, no line may carry one — a line cannot reference an order item the
// header itself doesn't link to.
function salesOrderItemLinkageMatchesHeader(data: {
  salesOrderId?: string;
  lines: readonly { salesOrderItemId?: string }[];
}): boolean {
  const requiresLink = data.salesOrderId !== undefined;
  return data.lines.every((line) => (line.salesOrderItemId !== undefined) === requiresLink);
}

export const createDeliveryChallanSchema = deliveryChallanBaseSchema.refine(salesOrderItemLinkageMatchesHeader, {
  message:
    "Every line must reference a line of the linked sales order when one is selected, and none may when it isn't.",
  path: ["lines"],
});

export type CreateDeliveryChallanInput = z.infer<typeof createDeliveryChallanSchema>;

// Create and Update share the same field set — every field remains editable
// while DRAFT (37-delivery-challans.md's Business Rules). Kept as a
// separate named schema so a future spec can diverge them without touching
// callers (mirrors sales-order-schema.ts's identical convention).
export const updateDeliveryChallanSchema = createDeliveryChallanSchema;

export type UpdateDeliveryChallanInput = z.infer<typeof updateDeliveryChallanSchema>;
