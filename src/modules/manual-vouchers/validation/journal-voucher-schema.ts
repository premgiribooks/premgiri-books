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

const journalEntrySchema = z.object({
  ledgerId: z.uuid("Select a valid ledger"),
  entryType: z.enum(["DEBIT", "CREDIT"]),
  amount: z
    .number("Amount must be a number")
    .positive("Amount must be greater than zero")
    .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6, "Amount can have at most 2 decimal places"),
});

// A Journal Voucher has no fixed entry-shape rule at all — any combination
// of Debit/Credit entries against any active ledger, as long as the whole
// set balances (55-journal-voucher.md's Entry shape rule). The schema only
// enforces the minimum row count `voucherEngine.postVoucher` itself already
// requires; the balanced-sum check is deliberately left to the engine, not
// duplicated here.
export const createJournalVoucherSchema = z.object({
  voucherDate: VOUCHER_DATE_SCHEMA,
  narration: NARRATION_SCHEMA,
  entries: z.array(journalEntrySchema).min(2, "At least 2 entries are required"),
});

export type CreateJournalVoucherInput = z.infer<typeof createJournalVoucherSchema>;
