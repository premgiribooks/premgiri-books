import { z } from "zod";

import { GST_STATE_CODES } from "@/engines/gst/state-codes";

// Pure validation — no I/O, no Prisma client, no session lookups. Mirrors
// sales-return-schema.ts's structure (40-credit-note.md's Validation
// section), with freeform adjustment lines instead of invoice-line
// references.

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

export const CREDIT_NOTE_STATUS_VALUES = ["DRAFT", "POSTED", "CANCELLED"] as const;

export const REFUND_MODE_VALUES = ["LEDGER_ADJUSTMENT", "CASH_REFUND"] as const;

function hasAtMostDecimals(value: number, decimals: number): boolean {
  const factor = 10 ** decimals;
  return Math.abs(value * factor - Math.round(value * factor)) < 1e-6;
}

export const creditNoteLineSchema = z.object({
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

export type CreditNoteLineInput = z.infer<typeof creditNoteLineSchema>;

const REASON_SCHEMA = z.string().trim().min(1, "Reason is required").max(500, "Reason must be at most 500 characters");

// `salesInvoiceId` is optional — a Credit Note always adjusts a specific
// customer's liability (customerId required) but need not reference one
// particular invoice (40-credit-note.md's Decisions). `refundMode` is
// `.optional()`, not `.default()`, so the service can distinguish "not
// explicitly chosen" (defaults to LEDGER_ADJUSTMENT) from an explicit value.
const creditNoteBaseSchema = z.object({
  customerId: z.uuid("Select a valid customer"),
  salesInvoiceId: z.uuid("Select a valid sales invoice").optional(),
  noteDate: CALENDAR_DATE_SCHEMA,
  placeOfSupplyStateCode: PLACE_OF_SUPPLY_SCHEMA,
  reason: REASON_SCHEMA,
  refundMode: z.enum(REFUND_MODE_VALUES).optional(),
  refundLedgerId: z.uuid("Select a valid refund ledger").optional(),
  // Required exactly when CASH_REFUND — mirrors refundLedgerId's own
  // conditional requirement (91-payment-mode-integration-sales.md).
  paymentModeId: z.uuid("Select a payment mode").optional(),
  lines: z.array(creditNoteLineSchema).min(1, "A credit note must have at least one line"),
});

/** A refund ledger is required whenever CASH_REFUND is explicitly chosen —
 * mirrors sales-return-schema.ts's identical refine. */
function refundLedgerRequirementMet(data: { refundMode?: string; refundLedgerId?: string }): boolean {
  return data.refundMode !== "CASH_REFUND" || Boolean(data.refundLedgerId);
}

/** A payment mode is required whenever CASH_REFUND is explicitly chosen —
 * mirrors refundLedgerRequirementMet exactly. */
function paymentModeRequirementMet(data: { refundMode?: string; paymentModeId?: string }): boolean {
  return data.refundMode !== "CASH_REFUND" || Boolean(data.paymentModeId);
}

export const createCreditNoteSchema = creditNoteBaseSchema
  .refine(refundLedgerRequirementMet, {
    message: "Select a refund ledger for a cash refund.",
    path: ["refundLedgerId"],
  })
  .refine(paymentModeRequirementMet, {
    message: "Select a payment mode for a cash refund.",
    path: ["paymentModeId"],
  });

export type CreateCreditNoteInput = z.infer<typeof createCreditNoteSchema>;

// Create and Update share the same field set — every field remains editable
// while DRAFT (40-credit-note.md's Business Rules: "Editable while DRAFT").
export const updateCreditNoteSchema = createCreditNoteSchema;

export type UpdateCreditNoteInput = z.infer<typeof updateCreditNoteSchema>;
