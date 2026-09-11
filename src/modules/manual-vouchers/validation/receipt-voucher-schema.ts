import { z } from "zod";

import { isValidCalendarDate } from "@/engines/voucher/voucher-validation";

// Reuses the Voucher Engine's own calendar-date convention rather than
// re-deriving it (code-standards.md's "never duplicate logic") — voucherDate
// is the same @db.Date storage shape voucherEngine.postVoucher itself
// parses.
const VOUCHER_DATE_SCHEMA = z.string().trim().refine(isValidCalendarDate, "Enter a valid voucher date");

const NARRATION_SCHEMA = z
  .string()
  .trim()
  .max(500, "Narration must be at most 500 characters")
  .transform((value) => (value === "" ? undefined : value))
  .optional();

const creditLineSchema = z.object({
  ledgerId: z.uuid("Select a valid ledger"),
  amount: z
    .number("Amount must be a number")
    .positive("Amount must be greater than zero")
    .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6, "Amount can have at most 2 decimal places"),
});

// Only a single `debitLedgerId` field exists — the schema shape itself is
// what enforces "exactly one Debit entry" (53-receipt-voucher.md's Entry
// shape rule); there is no second-Debit-entry case reachable through this
// schema at all. `creditLines` min(1) enforces "one or more Credit entries."
export const createReceiptVoucherSchema = z.object({
  voucherDate: VOUCHER_DATE_SCHEMA,
  narration: NARRATION_SCHEMA,
  debitLedgerId: z.uuid("Select the Cash/Bank ledger being received into"),
  creditLines: z.array(creditLineSchema).min(1, "At least one credit line is required"),
});

export type CreateReceiptVoucherInput = z.infer<typeof createReceiptVoucherSchema>;
