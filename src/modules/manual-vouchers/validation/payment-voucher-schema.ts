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

const debitLineSchema = z.object({
  ledgerId: z.uuid("Select a valid ledger"),
  amount: z
    .number("Amount must be a number")
    .positive("Amount must be greater than zero")
    .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6, "Amount can have at most 2 decimal places"),
});

// Only a single `creditLedgerId` field exists — the schema shape itself is
// what enforces "exactly one Credit entry" (52-payment-voucher.md's Entry
// shape rule); there is no second-Credit-entry case reachable through this
// schema at all. `debitLines` min(1) enforces "one or more Debit entries."
export const createPaymentVoucherSchema = z.object({
  voucherDate: VOUCHER_DATE_SCHEMA,
  narration: NARRATION_SCHEMA,
  creditLedgerId: z.uuid("Select the Cash/Bank ledger being paid from"),
  debitLines: z.array(debitLineSchema).min(1, "At least one debit line is required"),
});

export type CreatePaymentVoucherInput = z.infer<typeof createPaymentVoucherSchema>;
