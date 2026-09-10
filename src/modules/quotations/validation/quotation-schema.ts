import { z } from "zod";

import { GST_STATE_CODES } from "@/engines/gst/state-codes";

// Pure validation — no I/O, no Prisma client, no session lookups
// (30-pricing-engine.md's Structure convention). Fully unit-testable.

// Mirrors financial-year-schema.ts's / voucher-validation.ts's calendar-date
// convention — a plain YYYY-MM-DD string, round-tripped to reject dates like
// 2026-02-30 that `Date` would otherwise silently roll over. Duplicated here
// rather than imported from the Voucher Engine, matching price-list-schema.ts's
// own precedent of a third local copy rather than a cross-module dependency
// for two small pure functions.
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

/** `YYYY-MM-DD` -> UTC-midnight `Date`, the storage shape for `quotationDate`/`validUntil` (`@db.Date`). */
export function toUtcDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

const CALENDAR_DATE_SCHEMA = z.string().trim().refine(isValidCalendarDate, "Enter a valid date");

// Cast (not a plain string[]) so z.enum infers a literal union rather than
// `string` — the document-number/types.ts DOCUMENT_TYPE_VALUES cast pattern.
const PLACE_OF_SUPPLY_VALUES = GST_STATE_CODES.map((entry) => entry.code) as [string, ...string[]];

export const PLACE_OF_SUPPLY_SCHEMA = z.enum(PLACE_OF_SUPPLY_VALUES, "Select a valid state");

export const QUOTATION_STATUS_VALUES = [
  "DRAFT",
  "SENT",
  "ACCEPTED",
  "REJECTED",
  "EXPIRED",
  "CANCELLED",
] as const;

// Same tolerance-based float-comparison idiom as gst-calculation.ts /
// pricing-engine.ts's assertQuantityPrecision (18.15 * 100 === 1814.9999… in
// binary floats).
function hasAtMostDecimals(value: number, decimals: number): boolean {
  const factor = 10 ** decimals;
  return Math.abs(value * factor - Math.round(value * factor)) < 1e-6;
}

// The tighter "no more decimals than the selected product's unit allows"
// rule is unit-dependent, so it is enforced server-side in
// quotation-service.ts after the product/unit row loads (mirroring
// pricing-engine.ts's assertQuantityPrecision) — this only bounds the
// generic shape.
const QUANTITY_SCHEMA = z
  .number("Quantity must be a number")
  .positive("Quantity must be greater than zero")
  .refine((value) => hasAtMostDecimals(value, 4), "Quantity can have at most 4 decimal places");

const RATE_SCHEMA = z
  .number("Rate must be a number")
  .min(0, "Rate cannot be negative")
  .max(999_999_999_999.99, "Rate is too large")
  .refine((value) => hasAtMostDecimals(value, 2), "Rate can have at most 2 decimal places");

// `.optional()` (not `.default(0)`) so the inferred input type keeps these
// fields optional for callers — the price-list-schema.ts CESS_PERCENT_SCHEMA/
// zodResolver reason.
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

// The negative-taxableAmount_pre guard from 35-quotations.md's Business
// Rules, enforced here too so a bad combination never reaches the GST
// Engine's calculateLine — a combined discount that would exceed the line's
// own gross value (quantity x rate) is rejected with a friendly,
// line-specific error. Re-asserted server-side in
// quotation-calculations.ts's assertDiscountWithinGross (defense in depth),
// since a Zod schema alone cannot be trusted as the only enforcement point
// for a server-computed value.
export const quotationLineSchema = z
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

export type QuotationLineInput = z.infer<typeof quotationLineSchema>;

const VALID_UNTIL_SCHEMA = z
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
// lenient live-preview schema below — kept as a plain ZodObject (not the
// refined create schema) so `previewQuotationSchema` can `.extend()` it
// directly rather than reaching into a refined schema's internals.
const quotationBaseSchema = z.object({
  customerId: z.uuid("Select a valid customer"),
  quotationDate: CALENDAR_DATE_SCHEMA,
  validUntil: VALID_UNTIL_SCHEMA,
  placeOfSupplyStateCode: PLACE_OF_SUPPLY_SCHEMA,
  narration: NARRATION_SCHEMA,
  lines: z.array(quotationLineSchema).min(1, "A quotation must have at least one line"),
});

function validUntilOnOrAfterDate(data: { quotationDate: string; validUntil?: string }): boolean {
  return data.validUntil === undefined || toUtcDate(data.validUntil) >= toUtcDate(data.quotationDate);
}

export const createQuotationSchema = quotationBaseSchema.refine(validUntilOnOrAfterDate, {
  message: "Valid Until must be on or after the Quotation Date",
  path: ["validUntil"],
});

export type CreateQuotationInput = z.infer<typeof createQuotationSchema>;

// Create and Update share the same field set today — every field remains
// editable while DRAFT/SENT (35-quotations.md's Business Rules). Kept as a
// separate named schema so a future spec can diverge them without touching
// callers, mirroring warehouse-schema.ts's identical convention.
export const updateQuotationSchema = createQuotationSchema;

export type UpdateQuotationInput = z.infer<typeof updateQuotationSchema>;

// A lenient variant for the live-editing preview Server Action
// (previewQuotationAction) — the user is mid-edit and `lines` may
// legitimately be empty or a line mid-fill-in, and no customer may be
// picked yet (quotationService.previewQuotation never reads customerId —
// tax/pricing math doesn't depend on it). The strict schema above still
// runs on actual save. Never persisted.
export const previewQuotationSchema = quotationBaseSchema.extend({
  customerId: z.uuid("Select a valid customer").optional(),
  lines: z.array(quotationLineSchema),
});

export type PreviewQuotationInput = z.infer<typeof previewQuotationSchema>;
