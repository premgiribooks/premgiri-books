import { z } from "zod";

// Pure validation — no I/O, no Prisma client, no session lookups. Mirrors
// sales-invoice-schema.ts's structure (39-sales-return.md's Validation
// section).

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

/** `YYYY-MM-DD` -> UTC-midnight `Date`, the storage shape for `returnDate` (`@db.Date`). */
export function toUtcDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

const CALENDAR_DATE_SCHEMA = z.string().trim().refine(isValidCalendarDate, "Enter a valid date");

export const SALES_RETURN_STATUS_VALUES = ["DRAFT", "POSTED", "CANCELLED"] as const;

export const REFUND_MODE_VALUES = ["LEDGER_ADJUSTMENT", "CASH_REFUND"] as const;

function hasAtMostDecimals(value: number, decimals: number): boolean {
  const factor = 10 ** decimals;
  return Math.abs(value * factor - Math.round(value * factor)) < 1e-6;
}

function emptyToUndefined(value: string): string | undefined {
  return value === "" ? undefined : value;
}

// The tighter "no more decimals than the returned line's own unit allows"
// rule is unit-dependent, enforced server-side in sales-return-service.ts
// after the source invoice item's product/unit loads (mirrors
// sales-invoice-schema.ts).
const QUANTITY_SCHEMA = z
  .number("Quantity must be a number")
  .positive("Quantity must be greater than zero")
  .refine((value) => hasAtMostDecimals(value, 4), "Quantity can have at most 4 decimal places");

export const salesReturnLineSchema = z.object({
  salesInvoiceItemId: z.uuid("Select a valid invoice line"),
  // Explicit picker (added per explicit user request, 2026-09-20) — see
  // SalesReturnItem's own schema comment for why this is no longer
  // inherited from the original sale.
  warehouseId: z.uuid("Select a valid warehouse"),
  quantity: QUANTITY_SCHEMA,
});

export type SalesReturnLineInput = z.infer<typeof salesReturnLineSchema>;

const REASON_SCHEMA = z
  .string()
  .trim()
  .max(500, "Reason must be at most 500 characters")
  .transform(emptyToUndefined)
  .optional();

// Base header+lines shape shared by create/update. `refundMode` is
// deliberately `.optional()`, not `.default()` — the service must be able to
// distinguish "not explicitly chosen" (apply the WALK_IN-forcing resolution,
// 39-sales-return.md's Decisions) from an explicit client-supplied value (an
// explicit LEDGER_ADJUSTMENT for a WALK_IN-sourced return is rejected
// outright, never silently overridden). Omitted fields default to
// LEDGER_ADJUSTMENT only when the source invoice has a customer ledger to
// credit.
const salesReturnBaseSchema = z.object({
  salesInvoiceId: z.uuid("Select a valid sales invoice"),
  returnDate: CALENDAR_DATE_SCHEMA,
  reason: REASON_SCHEMA,
  refundMode: z.enum(REFUND_MODE_VALUES).optional(),
  refundLedgerId: z.uuid("Select a valid refund ledger").optional(),
  // Required exactly when CASH_REFUND — mirrors refundLedgerId's own
  // conditional requirement (91-payment-mode-integration-sales.md: a
  // LEDGER_ADJUSTMENT return never touches a cash/bank ledger at all, so it
  // has no payment mode to select).
  paymentModeId: z.uuid("Select a payment mode").optional(),
  lines: z.array(salesReturnLineSchema).min(1, "A sales return must have at least one line"),
});

/** A refund ledger is required whenever CASH_REFUND is explicitly chosen —
 * the WALK_IN-forced case (refundMode omitted, resolved server-side) is
 * re-checked independently in sales-return-service.ts, since this refine
 * only sees what the client actually submitted. */
function refundLedgerRequirementMet(data: { refundMode?: string; refundLedgerId?: string }): boolean {
  return data.refundMode !== "CASH_REFUND" || Boolean(data.refundLedgerId);
}

/** A payment mode is required whenever CASH_REFUND is explicitly chosen —
 * mirrors refundLedgerRequirementMet exactly. */
function paymentModeRequirementMet(data: { refundMode?: string; paymentModeId?: string }): boolean {
  return data.refundMode !== "CASH_REFUND" || Boolean(data.paymentModeId);
}

/** No `salesInvoiceItemId` may appear twice within one submission — the
 * `@@unique([salesReturnId, salesInvoiceItemId])` guard, checked early for a
 * friendlier error (39-sales-return.md's Decisions: "a business returning
 * more of the same line increases that one line's quantity"). */
function linesHaveNoDuplicateInvoiceItem(data: { lines: readonly { salesInvoiceItemId: string }[] }): boolean {
  const ids = data.lines.map((line) => line.salesInvoiceItemId);
  return new Set(ids).size === ids.length;
}

export const createSalesReturnSchema = salesReturnBaseSchema
  .refine(refundLedgerRequirementMet, {
    message: "Select a refund ledger for a cash refund.",
    path: ["refundLedgerId"],
  })
  .refine(paymentModeRequirementMet, {
    message: "Select a payment mode for a cash refund.",
    path: ["paymentModeId"],
  })
  .refine(linesHaveNoDuplicateInvoiceItem, {
    message: "Each invoice line can only appear once — increase its quantity instead of adding it twice.",
    path: ["lines"],
  });

export type CreateSalesReturnInput = z.infer<typeof createSalesReturnSchema>;

// Create and Update share the same field set — every field remains editable
// while DRAFT (39-sales-return.md's Business Rules: "Editable while DRAFT").
export const updateSalesReturnSchema = createSalesReturnSchema;

export type UpdateSalesReturnInput = z.infer<typeof updateSalesReturnSchema>;
