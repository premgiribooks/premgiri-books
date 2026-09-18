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

// A Contra Voucher is exactly one Debit + one Credit entry (54-contra-voucher.md's
// Entry shape rule) — the schema shape itself is what enforces this; there is
// no variable-length side reachable through this schema at all, unlike
// Payment/Receipt Voucher's array of lines on the unrestricted side.
export const createContraVoucherSchema = z
  .object({
    voucherDate: VOUCHER_DATE_SCHEMA,
    narration: NARRATION_SCHEMA,
    fromLedgerId: z.uuid("Select the Cash/Bank ledger funds are moving from"),
    toLedgerId: z.uuid("Select the Cash/Bank ledger funds are moving to"),
    // 93-payment-mode-integration-manual-vouchers.md — one mode for the
    // whole voucher (the transfer mechanism), validated against fromLedgerId
    // (the credited/source side, mirroring Payment Voucher's own
    // creditLedgerId convention — both sides are guaranteed Cash/Bank, so an
    // "ANY"-class mode always matches regardless of which side is checked).
    paymentModeId: z.uuid("Select a payment mode"),
    amount: z
      .number("Amount must be a number")
      .positive("Amount must be greater than zero")
      .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6, "Amount can have at most 2 decimal places"),
  })
  .refine((data) => data.fromLedgerId !== data.toLedgerId, {
    message: "Source and destination ledgers must differ",
    path: ["toLedgerId"],
  });

export type CreateContraVoucherInput = z.infer<typeof createContraVoucherSchema>;
