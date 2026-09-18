import type { ManualVoucherLedgerOption } from "@/types/manual-voucher";
import type { PaymentModeOption } from "@/types/payment-mode";

export interface PaymentVoucherPrefill {
  ledgerId: string;
  amount: number;
  /** 93-payment-mode-integration-manual-vouchers.md's optional prefill hint
   * — present only when the caller passed a `paymentModeId` query param
   * naming an active company Payment Mode. Absent otherwise (including
   * every existing Liability Settlement link, which predates this field) —
   * the form falls back to its own closest-match auto-select once the user
   * picks a Cash/Bank ledger, never a thrown error. */
  paymentModeId?: string;
}

/**
 * 87-liability-settlement.md's Payment Voucher New-page prefill resolution,
 * extracted into a pure function so it can be unit-tested (the page itself
 * is a Server Component and isn't unit-tested in this codebase). A missing,
 * malformed, inactive, or cross-company `debitLedgerId` resolves to
 * `undefined` — the caller falls back to the form's normal empty defaults,
 * never a thrown error. Membership in `ledgerOptions` already guarantees
 * active + company-owned, since `paymentVoucherService.listLedgerOptions()`
 * is scoped that way. `paymentModes`/`paymentModeIdParam` are optional
 * (93-payment-mode-integration-manual-vouchers.md's own optional query
 * param) — a missing or invalid `paymentModeId` simply omits it from the
 * result rather than rejecting the whole prefill.
 */
export function resolvePaymentVoucherPrefill(
  ledgerOptions: readonly ManualVoucherLedgerOption[],
  debitLedgerIdParam: string | undefined,
  amountParam: string | undefined,
  paymentModes: readonly PaymentModeOption[] = [],
  paymentModeIdParam: string | undefined = undefined
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

  const paymentModeId = paymentModes.some((mode) => mode.id === paymentModeIdParam) ? paymentModeIdParam : undefined;

  return {
    ledgerId: debitLedgerIdParam,
    amount: Math.round(parsedAmount * 100) / 100,
    ...(paymentModeId ? { paymentModeId } : {}),
  };
}
