import type { ManualVoucherLedgerOption } from "@/types/manual-voucher";

export interface PaymentVoucherPrefill {
  ledgerId: string;
  amount: number;
}

/**
 * 87-liability-settlement.md's Payment Voucher New-page prefill resolution,
 * extracted into a pure function so it can be unit-tested (the page itself
 * is a Server Component and isn't unit-tested in this codebase). A missing,
 * malformed, inactive, or cross-company `debitLedgerId` resolves to
 * `undefined` — the caller falls back to the form's normal empty defaults,
 * never a thrown error. Membership in `ledgerOptions` already guarantees
 * active + company-owned, since `paymentVoucherService.listLedgerOptions()`
 * is scoped that way.
 */
export function resolvePaymentVoucherPrefill(
  ledgerOptions: readonly ManualVoucherLedgerOption[],
  debitLedgerIdParam: string | undefined,
  amountParam: string | undefined
): PaymentVoucherPrefill | undefined {
  if (!debitLedgerIdParam || !amountParam) {
    return undefined;
  }

  const parsedAmount = Number(amountParam);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return undefined;
  }

  if (!ledgerOptions.some((ledger) => ledger.id === debitLedgerIdParam)) {
    return undefined;
  }

  return { ledgerId: debitLedgerIdParam, amount: Math.round(parsedAmount * 100) / 100 };
}
