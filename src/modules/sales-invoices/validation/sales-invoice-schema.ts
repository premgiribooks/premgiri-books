import { z } from "zod";

import { GST_STATE_CODES } from "@/engines/gst/state-codes";

// Pure validation — no I/O, no Prisma client, no session lookups. Mirrors
// sales-order-schema.ts's structure (38-sales-invoice.md's Validation
// section), extended with the customerMode discriminator, per-line tax
// override, and a payments array — new shapes this document introduces.

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

export const SALES_INVOICE_STATUS_VALUES = ["DRAFT", "POSTED", "CANCELLED"] as const;

export const CUSTOMER_MODE_VALUES = ["PERMANENT", "QUICK", "WALK_IN"] as const;

function hasAtMostDecimals(value: number, decimals: number): boolean {
  const factor = 10 ** decimals;
  return Math.abs(value * factor - Math.round(value * factor)) < 1e-6;
}

function emptyToUndefined(value: string): string | undefined {
  return value === "" ? undefined : value;
}

// The tighter "no more decimals than the selected product's unit allows"
// rule is unit-dependent, enforced server-side in sales-invoice-service.ts
// after the product/unit row loads (mirrors sales-order-schema.ts).
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

export const salesInvoiceLineSchema = z
  .object({
    productId: z.uuid("Select a valid product"),
    // No warehouseId (removed per explicit user request, 2026-09-20) — which
    // warehouse(s) fulfil this line is resolved automatically at posting
    // time by the Inventory Engine's own FIFO-by-warehouse-age allocator
    // (src/engines/inventory/warehouse-allocation.ts), never chosen here.
    quantity: QUANTITY_SCHEMA,
    rate: RATE_SCHEMA,
    discountPercent: DISCOUNT_PERCENT_SCHEMA,
    discountAmount: DISCOUNT_AMOUNT_SCHEMA,
    // The spec-33 forward-note, this spec's own addition: a line's computed
    // tax may be manually overridden, with a mandatory audit-trail reason.
    // `.optional()`, not `.default(false)` — keeps input/output types
    // identical for zodResolver's z.input typing (see the `payments` field's
    // comment below for the full explanation). Callers read `?? false`.
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
  });

export type SalesInvoiceLineInput = z.infer<typeof salesInvoiceLineSchema>;

export const salesInvoicePaymentSchema = z.object({
  ledgerId: z.uuid("Select a valid ledger"),
  paymentModeId: z.uuid("Select a payment mode"),
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

export type SalesInvoicePaymentInput = z.infer<typeof salesInvoicePaymentSchema>;

const QUICK_CUSTOMER_TEXT_SCHEMA = z
  .string()
  .trim()
  .max(200, "Must be at most 200 characters")
  .transform(emptyToUndefined)
  .optional();

const NARRATION_SCHEMA = z
  .string()
  .trim()
  .max(500, "Narration must be at most 500 characters")
  .transform(emptyToUndefined)
  .optional();

// Base header+lines+payments shape shared by the strict create/update schema
// and the lenient live-preview schema below.
const salesInvoiceBaseSchema = z.object({
  customerMode: z.enum(CUSTOMER_MODE_VALUES, "Select a valid customer mode"),
  customerId: z.uuid("Select a valid customer").optional(),
  quickCustomerName: QUICK_CUSTOMER_TEXT_SCHEMA,
  quickCustomerMobile: QUICK_CUSTOMER_TEXT_SCHEMA,
  quickCustomerGstin: QUICK_CUSTOMER_TEXT_SCHEMA,
  quickCustomerAddress: z
    .string()
    .trim()
    .max(500, "Address must be at most 500 characters")
    .transform(emptyToUndefined)
    .optional(),
  invoiceDate: CALENDAR_DATE_SCHEMA,
  placeOfSupplyStateCode: PLACE_OF_SUPPLY_SCHEMA,
  narration: NARRATION_SCHEMA,
  salesOrderId: z.uuid("Select a valid sales order").optional(),
  deliveryChallanId: z.uuid("Select a valid delivery challan").optional(),
  lines: z.array(salesInvoiceLineSchema).min(1, "A sales invoice must have at least one line"),
  // Deliberately `.optional()`, not `.default([])` — a zodResolver v4
  // overload types the form's field values as the schema's z.input, not
  // z.output; `.default()` makes input optional but output required,
  // breaking `useForm<CreateSalesInvoiceInput>`'s type match (see
  // progress-tracker.md's Architecture Decision on this exact pitfall).
  // Defaulting to `[]` happens at each call site instead.
  payments: z.array(salesInvoicePaymentSchema).optional(),
});

/**
 * `customerMode` discriminator (38-sales-invoice.md's Data Model decision):
 * PERMANENT requires customerId and forbids every quickCustomer* field;
 * QUICK requires quickCustomerName and forbids customerId; WALK_IN forbids
 * customerId and every quickCustomer* field except quickCustomerName
 * (display-only, for the printed receipt).
 */
function customerModeFieldsMatch(data: {
  customerMode: (typeof CUSTOMER_MODE_VALUES)[number];
  customerId?: string;
  quickCustomerName?: string;
  quickCustomerMobile?: string;
  quickCustomerGstin?: string;
  quickCustomerAddress?: string;
}): boolean {
  switch (data.customerMode) {
    case "PERMANENT":
      return (
        Boolean(data.customerId) &&
        !data.quickCustomerName &&
        !data.quickCustomerMobile &&
        !data.quickCustomerGstin &&
        !data.quickCustomerAddress
      );
    case "QUICK":
      return !data.customerId && Boolean(data.quickCustomerName);
    case "WALK_IN":
      return !data.customerId && !data.quickCustomerMobile && !data.quickCustomerGstin && !data.quickCustomerAddress;
  }
}

export const createSalesInvoiceSchema = salesInvoiceBaseSchema.refine(customerModeFieldsMatch, {
  message: "Customer fields don't match the selected customer mode.",
  path: ["customerMode"],
});

export type CreateSalesInvoiceInput = z.infer<typeof createSalesInvoiceSchema>;

// Create and Update share the same field set — every field remains editable
// while DRAFT (38-sales-invoice.md's Business Rules: "no Edit after
// posting"). Kept as a separate named schema so a future spec can diverge
// them without touching callers (mirrors sales-order-schema.ts).
export const updateSalesInvoiceSchema = createSalesInvoiceSchema;

export type UpdateSalesInvoiceInput = z.infer<typeof updateSalesInvoiceSchema>;

// A lenient variant for the live-editing preview Server Action — mirrors
// previewSalesOrderSchema. Never persisted.
export const previewSalesInvoiceSchema = salesInvoiceBaseSchema.extend({
  lines: z.array(salesInvoiceLineSchema),
});

export type PreviewSalesInvoiceInput = z.infer<typeof previewSalesInvoiceSchema>;
