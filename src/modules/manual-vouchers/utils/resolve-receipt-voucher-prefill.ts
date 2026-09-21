import type { ManualVoucherLedgerOption } from "@/types/manual-voucher";
import type { PaymentModeOption } from "@/types/payment-mode";

export interface ReceiptVoucherPrefill {
  ledgerId: string;
  amount: number;
  /** Mirrors resolve-payment-voucher-prefill.ts's own `paymentModeId` hint —
   * present only when the caller passed a `paymentModeId` query param naming
   * an active company Payment Mode. Absent otherwise — the form falls back
   * to its own closest-match auto-select once the user picks a Cash/Bank
   * ledger, never a thrown error. */
  paymentModeId?: string;
}

/**
 * Receipt Voucher New-page prefill resolution — the mirror of
 * resolve-payment-voucher-prefill.ts's `resolvePaymentVoucherPrefill`, with
 * the entry direction reversed: seeds the first *Credit* line (the "Received
 * From" ledger, e.g. a Customer) instead of a Debit line, since Receipt
 * Voucher's Cash/Bank side is the single Debit ledger, not the picked-here
 * side. Built so a Sales Invoice's "Receipt" action (and any other future
 * caller) can jump straight into Receipt Voucher's New screen with that
 * invoice's own outstanding customer balance already filled in — the same
 * "read+navigate, no new posting path" pattern
 * 87-liability-settlement.md established for Payment Voucher.
 *
 * A missing, malformed, inactive, or cross-company `creditLedgerIdParam`
 * resolves to `undefined` — the caller falls back to the form's normal empty
 * defaults, never a thrown error. Membership in `ledgerOptions` already
 * guarantees active + company-owned, since `paymentVoucherService
 * .listLedgerOptions()` (shared by both Payment and Receipt Voucher) is
 * scoped that way.
 */
export function resolveReceiptVoucherPrefill(
  ledgerOptions: readonly ManualVoucherLedgerOption[],
  creditLedgerIdParam: string | undefined,
  amountParam: string | undefined,
  paymentModes: readonly PaymentModeOption[] = [],
  paymentModeIdParam: string | undefined = undefined
): ReceiptVoucherPrefill | undefined {
  if (!creditLedgerIdParam || !amountParam) {
    return undefined;
  }

  const parsedAmount = Number(amountParam);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return undefined;
  }

  if (!ledgerOptions.some((ledger) => ledger.id === creditLedgerIdParam)) {
    return undefined;
  }

  const paymentModeId = paymentModes.some((mode) => mode.id === paymentModeIdParam) ? paymentModeIdParam : undefined;

  return {
    ledgerId: creditLedgerIdParam,
    amount: Math.round(parsedAmount * 100) / 100,
    ...(paymentModeId ? { paymentModeId } : {}),
  };
}
