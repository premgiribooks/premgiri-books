import { z } from "zod";

// Pure validation — no I/O, no Prisma client, no session lookups. Mirrors
// delivery-challan-schema.ts's structure (43-goods-receipt-note.md's
// Validation section), minus every pricing/GST field this document
// deliberately omits, plus `rejectedQuantity`.

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

/** `YYYY-MM-DD` -> UTC-midnight `Date`, the storage shape for `grnDate` (`@db.Date`). */
export function toUtcDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

const CALENDAR_DATE_SCHEMA = z.string().trim().refine(isValidCalendarDate, "Enter a valid date");

export const GOODS_RECEIPT_NOTE_STATUS_VALUES = ["DRAFT", "RECEIVED", "INVOICED", "CANCELLED"] as const;

function hasAtMostDecimals(value: number, decimals: number): boolean {
  const factor = 10 ** decimals;
  return Math.abs(value * factor - Math.round(value * factor)) < 1e-6;
}

// The tighter "no more decimals than the selected product's unit allows"
// rule is unit-dependent, enforced server-side in
// goods-receipt-note-service.ts after the product/unit row loads (mirrors
// delivery-challan-schema.ts).
const QUANTITY_SCHEMA = z
  .number("Quantity must be a number")
  .positive("Quantity must be greater than zero")
  .refine((value) => hasAtMostDecimals(value, 4), "Quantity can have at most 4 decimal places");

const REJECTED_QUANTITY_SCHEMA = z
  .number("Rejected quantity must be a number")
  .min(0, "Rejected quantity cannot be negative")
  .refine((value) => hasAtMostDecimals(value, 4), "Rejected quantity can have at most 4 decimal places");

const NARRATION_SCHEMA = z
  .string()
  .trim()
  .max(500, "Narration must be at most 500 characters")
  .transform((value) => (value === "" ? undefined : value))
  .optional();

export const goodsReceiptNoteLineSchema = z.object({
  productId: z.uuid("Select a valid product"),
  warehouseId: z.uuid("Select a valid warehouse"),
  quantity: QUANTITY_SCHEMA,
  rejectedQuantity: REJECTED_QUANTITY_SCHEMA,
  // Conditionally required/forbidden at the object level below — a line
  // cannot reference an order item the header itself doesn't link to
  // (43-goods-receipt-note.md's Data Model decision).
  purchaseOrderItemId: z.uuid("Select a valid order line").optional(),
});

export type GoodsReceiptNoteLineInput = z.infer<typeof goodsReceiptNoteLineSchema>;

const goodsReceiptNoteBaseSchema = z.object({
  supplierId: z.uuid("Select a valid supplier"),
  purchaseOrderId: z.uuid("Select a valid purchase order").optional(),
  grnDate: CALENDAR_DATE_SCHEMA,
  narration: NARRATION_SCHEMA,
  lines: z.array(goodsReceiptNoteLineSchema).min(1, "A goods receipt note must have at least one line"),
});

// "Linkage is conditional, not independently optional per line": when
// purchaseOrderId is set, every line MUST carry a purchaseOrderItemId; when
// it's absent, no line may carry one — a line cannot reference an order item
// the header itself doesn't link to.
function purchaseOrderItemLinkageMatchesHeader(data: {
  purchaseOrderId?: string;
  lines: readonly { purchaseOrderItemId?: string }[];
}): boolean {
  const requiresLink = data.purchaseOrderId !== undefined;
  return data.lines.every((line) => (line.purchaseOrderItemId !== undefined) === requiresLink);
}

export const createGoodsReceiptNoteSchema = goodsReceiptNoteBaseSchema.refine(purchaseOrderItemLinkageMatchesHeader, {
  message:
    "Every line must reference a line of the linked purchase order when one is selected, and none may when it isn't.",
  path: ["lines"],
});

export type CreateGoodsReceiptNoteInput = z.infer<typeof createGoodsReceiptNoteSchema>;

// Create and Update share the same field set — every field remains editable
// while DRAFT (43-goods-receipt-note.md's Business Rules). Kept as a
// separate named schema so a future spec can diverge them without touching
// callers (mirrors delivery-challan-schema.ts's identical convention).
export const updateGoodsReceiptNoteSchema = createGoodsReceiptNoteSchema;

export type UpdateGoodsReceiptNoteInput = z.infer<typeof updateGoodsReceiptNoteSchema>;
