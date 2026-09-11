import { z } from "zod";

// Pure validation — no I/O, no Prisma client, no session lookups. Mirrors
// sales-return-schema.ts's structure (45-purchase-return.md's Validation
// section: "identical shape to sales-return-schema.ts with
// purchaseInvoiceId in place of salesInvoiceId").

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

export const PURCHASE_RETURN_STATUS_VALUES = ["DRAFT", "POSTED", "CANCELLED"] as const;

export const REFUND_MODE_VALUES = ["LEDGER_ADJUSTMENT", "CASH_REFUND"] as const;

function hasAtMostDecimals(value: number, decimals: number): boolean {
  const factor = 10 ** decimals;
  return Math.abs(value * factor - Math.round(value * factor)) < 1e-6;
}

function emptyToUndefined(value: string): string | undefined {
  return value === "" ? undefined : value;
}

// The tighter "no more decimals than the returned line's own unit allows"
// rule is unit-dependent, enforced server-side in purchase-return-service.ts
// after the source invoice item's product/unit loads (mirrors
// sales-return-schema.ts).
const QUANTITY_SCHEMA = z
  .number("Quantity must be a number")
  .positive("Quantity must be greater than zero")
  .refine((value) => hasAtMostDecimals(value, 4), "Quantity can have at most 4 decimal places");

export const purchaseReturnLineSchema = z.object({
  purchaseInvoiceItemId: z.uuid("Select a valid invoice line"),
  quantity: QUANTITY_SCHEMA,
});

export type PurchaseReturnLineInput = z.infer<typeof purchaseReturnLineSchema>;

const REASON_SCHEMA = z
  .string()
  .trim()
  .max(500, "Reason must be at most 500 characters")
  .transform(emptyToUndefined)
  .optional();

// Base header+lines shape shared by create/update. `refundMode` defaults to
// LEDGER_ADJUSTMENT — unlike Sales Return, there is no WALK_IN-style
// "no customer ledger" edge case here: every Purchase Invoice requires an
// existing, active Supplier (27-supplier-management.md), so a Supplier
// Ledger to credit/debit always exists (45-purchase-return.md's Data Model).
const purchaseReturnBaseSchema = z.object({
  purchaseInvoiceId: z.uuid("Select a valid purchase invoice"),
  returnDate: CALENDAR_DATE_SCHEMA,
  reason: REASON_SCHEMA,
  refundMode: z.enum(REFUND_MODE_VALUES).optional(),
  refundLedgerId: z.uuid("Select a valid refund ledger").optional(),
  lines: z.array(purchaseReturnLineSchema).min(1, "A purchase return must have at least one line"),
});

/** A refund ledger is required whenever CASH_REFUND is explicitly chosen. */
function refundLedgerRequirementMet(data: { refundMode?: string; refundLedgerId?: string }): boolean {
  return data.refundMode !== "CASH_REFUND" || Boolean(data.refundLedgerId);
}

/** No `purchaseInvoiceItemId` may appear twice within one submission — the
 * `@@unique([purchaseReturnId, purchaseInvoiceItemId])` guard, checked early
 * for a friendlier error (45-purchase-return.md's Decisions: "the same
 * invoice line cannot be listed twice within one return; returning more of
 * the same line increases that one line's quantity"). */
function linesHaveNoDuplicateInvoiceItem(data: { lines: readonly { purchaseInvoiceItemId: string }[] }): boolean {
  const ids = data.lines.map((line) => line.purchaseInvoiceItemId);
  return new Set(ids).size === ids.length;
}

export const createPurchaseReturnSchema = purchaseReturnBaseSchema
  .refine(refundLedgerRequirementMet, {
    message: "Select a refund ledger for a cash refund.",
    path: ["refundLedgerId"],
  })
  .refine(linesHaveNoDuplicateInvoiceItem, {
    message: "Each invoice line can only appear once — increase its quantity instead of adding it twice.",
    path: ["lines"],
  });

export type CreatePurchaseReturnInput = z.infer<typeof createPurchaseReturnSchema>;

// Create and Update share the same field set — every field remains editable
// while DRAFT (45-purchase-return.md's Business Rules: "Editable while DRAFT").
export const updatePurchaseReturnSchema = createPurchaseReturnSchema;

export type UpdatePurchaseReturnInput = z.infer<typeof updatePurchaseReturnSchema>;
