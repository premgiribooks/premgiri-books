import { z } from "zod";

import { GST_STATE_CODES } from "@/engines/gst/state-codes";

// Pure validation — no I/O, no Prisma client, no session lookups. Mirrors
// sales-invoice-schema.ts's structure (44-purchase-invoice.md's Validation
// section), minus the customerMode discriminator (every Purchase Invoice has
// a required supplierId — no Quick/Walk-in equivalent), plus the required
// supplierInvoiceNumber and warehouse-per-line (mirrors
// goods-receipt-note-schema.ts, since Purchase Order has no warehouse
// dimension but Purchase Invoice — like Goods Receipt Note — does).

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

/** `YYYY-MM-DD` -> UTC-midnight `Date`, the storage shape for `invoiceDate` (`@db.Date`). */
export function toUtcDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

const CALENDAR_DATE_SCHEMA = z.string().trim().refine(isValidCalendarDate, "Enter a valid date");

const PLACE_OF_SUPPLY_VALUES = GST_STATE_CODES.map((entry) => entry.code) as [string, ...string[]];

export const PLACE_OF_SUPPLY_SCHEMA = z.enum(PLACE_OF_SUPPLY_VALUES, "Select a valid state");

export const PURCHASE_INVOICE_STATUS_VALUES = ["DRAFT", "POSTED", "CANCELLED"] as const;

function hasAtMostDecimals(value: number, decimals: number): boolean {
  const factor = 10 ** decimals;
  return Math.abs(value * factor - Math.round(value * factor)) < 1e-6;
}

function emptyToUndefined(value: string): string | undefined {
  return value === "" ? undefined : value;
}

// The tighter "no more decimals than the selected product's unit allows"
// rule is unit-dependent, enforced server-side in purchase-invoice-service.ts
// after the product/unit row loads (mirrors sales-invoice-schema.ts).
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

// Mirrors the GST Engine's own GstRate bounds (0-100, <= 2 decimals) — these
// are normally server-populated from the product's rate rather than
// client-authored, but validated here too, defensively, since the schema
// accepts the full line payload.
const RATE_PERCENT_SCHEMA = z
  .number("Rate percent must be a number")
  .min(0, "Rate percent must be between 0 and 100")
  .max(100, "Rate percent must be between 0 and 100")
  .refine((value) => hasAtMostDecimals(value, 2), "Rate percent can have at most 2 decimal places")
  .optional();

const CESS_PERCENT_SCHEMA = z
  .number("Cess percent must be a number")
  .min(0, "Cess percent must be between 0 and 100")
  .max(100, "Cess percent must be between 0 and 100")
  .refine((value) => hasAtMostDecimals(value, 2), "Cess percent can have at most 2 decimal places")
  .optional();

// Non-negative rather than positive — a legitimately zero-tax override
// (e.g. correcting an exempt line the engine mis-taxed) is a real use case;
// omitted fields default to 0 in the service when isTaxOverridden is true,
// since a line is only ever intra- OR inter-state (never both cgst/sgst AND
// igst nonzero at once).
const OVERRIDE_AMOUNT_SCHEMA = z
  .number("Override amount must be a number")
  .min(0, "Override amount cannot be negative")
  .refine((value) => hasAtMostDecimals(value, 2), "Override amount can have at most 2 decimal places")
  .optional();

const OVERRIDE_REASON_SCHEMA = z
  .string()
  .trim()
  .max(500, "Override reason must be at most 500 characters")
  .transform(emptyToUndefined)
  .optional();

export const purchaseInvoiceLineSchema = z
  .object({
    productId: z.uuid("Select a valid product"),
    warehouseId: z.uuid("Select a valid warehouse"),
    quantity: QUANTITY_SCHEMA,
    rate: RATE_SCHEMA,
    discountPercent: DISCOUNT_PERCENT_SCHEMA,
    discountAmount: DISCOUNT_AMOUNT_SCHEMA,
    ratePercent: RATE_PERCENT_SCHEMA,
    cessPercent: CESS_PERCENT_SCHEMA,
    // The spec-33 forward-note, applied identically to Sales Invoice's own
    // tax-override mechanism. `.optional()`, not `.default(false)` — keeps
    // input/output types identical for zodResolver's z.input typing.
    isTaxOverridden: z.boolean().optional(),
    overriddenCgst: OVERRIDE_AMOUNT_SCHEMA,
    overriddenSgst: OVERRIDE_AMOUNT_SCHEMA,
    overriddenIgst: OVERRIDE_AMOUNT_SCHEMA,
    overriddenCess: OVERRIDE_AMOUNT_SCHEMA,
    overrideReason: OVERRIDE_REASON_SCHEMA,
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
  )
  .refine((line) => !line.isTaxOverridden || Boolean(line.overrideReason), {
    message: "A reason is required when overriding this line's tax.",
    path: ["overrideReason"],
  })
  .refine((line) => !line.isTaxOverridden || !(line.overriddenCgst || line.overriddenSgst) || !line.overriddenIgst, {
    message: "A line cannot override both the intra-state (CGST/SGST) and inter-state (IGST) tax at once.",
    path: ["overriddenIgst"],
  });

export type PurchaseInvoiceLineInput = z.infer<typeof purchaseInvoiceLineSchema>;

export const purchaseInvoicePaymentSchema = z.object({
  ledgerId: z.uuid("Select a valid ledger"),
  amount: z
    .number("Amount must be a number")
    .positive("Amount must be greater than zero")
    .refine((value) => hasAtMostDecimals(value, 2), "Amount can have at most 2 decimal places"),
  reference: z
    .string()
    .trim()
    .max(100, "Reference must be at most 100 characters")
    .transform(emptyToUndefined)
    .optional(),
});

export type PurchaseInvoicePaymentInput = z.infer<typeof purchaseInvoicePaymentSchema>;

const NARRATION_SCHEMA = z
  .string()
  .trim()
  .max(500, "Narration must be at most 500 characters")
  .transform(emptyToUndefined)
  .optional();

// Base header+lines+payments shape shared by the strict create/update schema
// and the lenient live-preview schema below.
const purchaseInvoiceBaseSchema = z.object({
  supplierId: z.uuid("Select a valid supplier"),
  supplierInvoiceNumber: z
    .string()
    .trim()
    .min(1, "Enter the supplier's invoice number")
    .max(50, "Supplier invoice number must be at most 50 characters"),
  invoiceDate: CALENDAR_DATE_SCHEMA,
  placeOfSupplyStateCode: PLACE_OF_SUPPLY_SCHEMA,
  narration: NARRATION_SCHEMA,
  purchaseOrderId: z.uuid("Select a valid purchase order").optional(),
  goodsReceiptNoteId: z.uuid("Select a valid goods receipt note").optional(),
  lines: z.array(purchaseInvoiceLineSchema).min(1, "A purchase invoice must have at least one line"),
  // Deliberately `.optional()`, not `.default([])` — a zodResolver v4
  // overload types the form's field values as the schema's z.input, not
  // z.output; `.default()` makes input optional but output required,
  // breaking `useForm<CreatePurchaseInvoiceInput>`'s type match (see
  // progress-tracker.md's Architecture Decision on this exact pitfall).
  // Defaulting to `[]` happens at each call site instead.
  payments: z.array(purchaseInvoicePaymentSchema).optional(),
});

export const createPurchaseInvoiceSchema = purchaseInvoiceBaseSchema;

export type CreatePurchaseInvoiceInput = z.infer<typeof createPurchaseInvoiceSchema>;

// Create and Update share the same field set — every field remains editable
// while DRAFT (44-purchase-invoice.md's Business Rules: "no Edit after
// posting"). Kept as a separate named schema so a future spec can diverge
// them without touching callers (mirrors sales-invoice-schema.ts).
export const updatePurchaseInvoiceSchema = createPurchaseInvoiceSchema;

export type UpdatePurchaseInvoiceInput = z.infer<typeof updatePurchaseInvoiceSchema>;

// A lenient variant for the live-editing preview Server Action — mirrors
// previewSalesInvoiceSchema. Never persisted.
export const previewPurchaseInvoiceSchema = purchaseInvoiceBaseSchema.extend({
  lines: z.array(purchaseInvoiceLineSchema),
});

export type PreviewPurchaseInvoiceInput = z.infer<typeof previewPurchaseInvoiceSchema>;
