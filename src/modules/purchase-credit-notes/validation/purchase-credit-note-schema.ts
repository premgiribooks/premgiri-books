import { z } from "zod";

import { GST_STATE_CODES } from "@/engines/gst/state-codes";

// Pure validation — no I/O, no Prisma client, no session lookups. Mirrors
// src/modules/credit-notes/validation/credit-note-schema.ts's structure,
// with supplierId/purchaseInvoiceId in place of customerId/salesInvoiceId
// and no RefundMode/refundLedgerId/paymentModeId fields (a Purchase Credit
// Note is ledger-adjustment only, no cash-refund path).

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

/** `YYYY-MM-DD` -> UTC-midnight `Date`, the storage shape for `noteDate` (`@db.Date`). */
export function toUtcDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

const CALENDAR_DATE_SCHEMA = z.string().trim().refine(isValidCalendarDate, "Enter a valid date");

const PLACE_OF_SUPPLY_VALUES = GST_STATE_CODES.map((entry) => entry.code) as [string, ...string[]];

export const PLACE_OF_SUPPLY_SCHEMA = z.enum(PLACE_OF_SUPPLY_VALUES, "Select a valid state");

export const PURCHASE_CREDIT_NOTE_STATUS_VALUES = ["DRAFT", "POSTED", "CANCELLED"] as const;

function hasAtMostDecimals(value: number, decimals: number): boolean {
  const factor = 10 ** decimals;
  return Math.abs(value * factor - Math.round(value * factor)) < 1e-6;
}

export const purchaseCreditNoteLineSchema = z.object({
  description: z.string().trim().min(1, "Description is required").max(200, "Description must be at most 200 characters"),
  taxableAmount: z
    .number("Taxable amount must be a number")
    .positive("Taxable amount must be greater than zero")
    .refine((value) => hasAtMostDecimals(value, 2), "Taxable amount can have at most 2 decimal places"),
  ratePercent: z
    .number("Rate must be a number")
    .min(0, "Rate must be between 0 and 100")
    .max(100, "Rate must be between 0 and 100")
    .refine((value) => hasAtMostDecimals(value, 2), "Rate can have at most 2 decimal places"),
  cessPercent: z
    .number("Cess must be a number")
    .min(0, "Cess must be between 0 and 100")
    .max(100, "Cess must be between 0 and 100")
    .refine((value) => hasAtMostDecimals(value, 2), "Cess can have at most 2 decimal places")
    .optional(),
});

export type PurchaseCreditNoteLineInput = z.infer<typeof purchaseCreditNoteLineSchema>;

const REASON_SCHEMA = z.string().trim().min(1, "Reason is required").max(500, "Reason must be at most 500 characters");

// `purchaseInvoiceId` is optional — a Purchase Credit Note always adjusts a
// specific supplier's payable (supplierId required) but need not reference
// one particular invoice (mirrors credit-note-schema.ts's identical
// salesInvoiceId decision).
const purchaseCreditNoteBaseSchema = z.object({
  supplierId: z.uuid("Select a valid supplier"),
  purchaseInvoiceId: z.uuid("Select a valid purchase invoice").optional(),
  noteDate: CALENDAR_DATE_SCHEMA,
  placeOfSupplyStateCode: PLACE_OF_SUPPLY_SCHEMA,
  reason: REASON_SCHEMA,
  lines: z.array(purchaseCreditNoteLineSchema).min(1, "A purchase credit note must have at least one line"),
});

export const createPurchaseCreditNoteSchema = purchaseCreditNoteBaseSchema;

export type CreatePurchaseCreditNoteInput = z.infer<typeof createPurchaseCreditNoteSchema>;

// Create and Update share the same field set — every field remains editable
// while DRAFT (mirrors credit-note-schema.ts's identical convention).
export const updatePurchaseCreditNoteSchema = createPurchaseCreditNoteSchema;

export type UpdatePurchaseCreditNoteInput = z.infer<typeof updatePurchaseCreditNoteSchema>;
