import type { Prisma } from "@prisma/client";

import { AppError } from "@/lib/app-error";
import { getLedgerPaymentClass } from "@/lib/ledger-class";
import { prisma } from "@/lib/prisma";

type PrismaClientOrTransaction = typeof prisma | Prisma.TransactionClient;

const NOT_FOUND_MESSAGE = "Selected payment mode not found.";

function inactiveMessage(name: string): string {
  return `Payment mode "${name}" is inactive and cannot be used.`;
}

function mismatchMessage(name: string, ledgerClass: "CASH" | "BANK" | "ANY"): string {
  const requirement =
    ledgerClass === "CASH"
      ? "a Cash-in-Hand ledger"
      : ledgerClass === "BANK"
        ? "a bank-linked ledger"
        : "a Cash-in-Hand or bank-linked ledger";
  return `Payment mode "${name}" requires ${requirement}.`;
}

/**
 * 91-payment-mode-integration-sales.md's ledger-class-matching validator —
 * the cross-module check spec 86 (Payment Mode Master) named but deferred to
 * this spec, the first real consumer of `PaymentMode.ledgerClass`. Checked at
 * every write path (Create/Update/Post), never only client-side.
 *
 * Rules (spec 91's Business Rules, amended per explicit user request —
 * 2026-09-20):
 * - A `NEITHER`-classified ledger (e.g. a Customer/Supplier ledger, or any
 *   other ledger that is neither Cash-in-Hand nor bank-linked) accepts
 *   *any* Payment Mode. Sales Invoice/Sales Return/Credit Note's payment
 *   ledger pickers deliberately list every active company ledger, not just
 *   Cash/Bank ones (see `SalesInvoicePaymentLedgerOption`) — rejecting a
 *   `NEITHER` ledger outright made every one of those ledgers unusable with
 *   any mode, which is the bug this amendment fixes.
 * - Otherwise (the ledger is genuinely `CASH` or `BANK`):
 *   - `ledgerClass === "CASH"` -> ledger must classify as `CASH`
 *   - `ledgerClass === "BANK"` -> ledger must classify as `BANK`
 *   - `ledgerClass === "ANY"` -> ledger must classify as `CASH` or `BANK`
 *     (always true here, kept for clarity)
 * - An inactive or cross-company payment mode is rejected outright — a
 *   deactivated mode can never be selected for a new/edited payment line
 *   (existing posted lines are immutable and never re-validated here).
 *
 * Purchase Invoice and the manual-voucher screens (Payment/Receipt/Contra)
 * pre-filter their own restricted-side ledger picker to Cash/Bank only
 * (`assertLedgersAreCashOrBank`), so a `NEITHER` ledger can never reach this
 * function from those flows — this amendment only changes behavior for the
 * Sales-side documents that pass through an unrestricted ledger list.
 *
 * Takes the caller's own `client` rather than the global `prisma` singleton
 * so a posting-time call reads inside the same Serializable transaction
 * snapshot as the rest of that posting (getLedgerPaymentClass's own doc
 * comment) — a deliberate deviation from spec 91's literal
 * `(paymentModeId, ledgerId, companyId)` signature, recorded in
 * progress-tracker.md.
 */
export async function assertPaymentModeMatchesLedger(
  client: PrismaClientOrTransaction,
  paymentModeId: string,
  ledgerId: string,
  companyId: string
): Promise<void> {
  const paymentMode = await client.paymentMode.findUnique({ where: { id: paymentModeId } });
  if (!paymentMode || paymentMode.companyId !== companyId) {
    throw new AppError(NOT_FOUND_MESSAGE);
  }
  if (!paymentMode.isActive) {
    throw new AppError(inactiveMessage(paymentMode.name));
  }

  const ledgerClass = await getLedgerPaymentClass(client, ledgerId, companyId);
  const isValid =
    ledgerClass === "NEITHER" || paymentMode.ledgerClass === "ANY" || paymentMode.ledgerClass === ledgerClass;

  if (!isValid) {
    throw new AppError(mismatchMessage(paymentMode.name, paymentMode.ledgerClass));
  }
}
