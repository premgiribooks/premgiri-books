import type { Prisma } from "@prisma/client";

import { AppError } from "@/lib/app-error";
import { prisma } from "@/lib/prisma";
import { CASH_IN_HAND_GROUP_NAME } from "@/modules/ledger-groups/constants/default-groups";
import { ledgerGroupRepository } from "@/modules/ledger-groups/repositories/ledger-group-repository";
import { ledgerRepository, type LedgerForValidation } from "@/modules/ledgers/repositories/ledger-repository";
import { getGroupSubtreeIds } from "@/modules/ledgers/utils/group-subtree";

type PrismaClientOrTransaction = typeof prisma | Prisma.TransactionClient;

/**
 * The three-way ledger classification named (but deliberately not built) by
 * 86-payment-mode-master.md's Project Context, extracted here for
 * 91-payment-mode-integration-sales.md's `assertPaymentModeMatchesLedger` —
 * the first real consumer.
 */
export type LedgerPaymentClass = "CASH" | "BANK" | "NEITHER";

/**
 * The classification test itself, shared by `assertLedgersAreCashOrBank`
 * (throwing), `getCashAndBankLedgerIds` (67-cash-flow.md's plain id-set
 * equivalent), and `getLedgerPaymentClass` below, so the rule lives in
 * exactly one place.
 */
function classifyLedger(ledgerGroupId: string, hasBankAccount: boolean, cashGroupIds: Set<string>): LedgerPaymentClass {
  if (cashGroupIds.has(ledgerGroupId)) {
    return "CASH";
  }
  return hasBankAccount ? "BANK" : "NEITHER";
}

function isCashOrBankClass(ledgerGroupId: string, hasBankAccount: boolean, cashGroupIds: Set<string>): boolean {
  return classifyLedger(ledgerGroupId, hasBankAccount, cashGroupIds) !== "NEITHER";
}

/**
 * The "Cash-in-Hand or bank-linked ledger" restriction, extracted from
 * purchase-invoice-service.ts's original `assertPaymentLedgersValid`
 * (44-purchase-invoice.md's Ledger Posting rule) so it has exactly one
 * implementation instead of accumulating a near-identical copy per module
 * that needs it (52-payment-voucher.md's Project Context: "do not re-derive
 * this check ad hoc"). Consumed by Purchase Invoice's own payment-ledger
 * check and by the manual-voucher screens' (Payment/Receipt/Contra) Cash/Bank
 * side restriction.
 *
 * Deliberately NOT shared with purchase-return-service.ts's own
 * `assertRefundLedgerValid` — that module's header comment records an
 * explicit prior decision to stay local rather than couple to Purchase
 * Invoice's code path, and this helper's extraction (scoped by spec 52 to
 * Purchase Invoice only) doesn't revisit that decision.
 *
 * Company-scoped and active-only, exactly like every other ledger
 * reference check in this codebase — an unknown, cross-company, or inactive
 * ledger id all reject before the class check ever runs.
 */
export async function assertLedgersAreCashOrBank(
  client: PrismaClientOrTransaction,
  companyId: string,
  ledgerIds: readonly string[],
  usageLabel: string
): Promise<void> {
  if (ledgerIds.length === 0) {
    return;
  }

  const uniqueIds = [...new Set(ledgerIds)];
  const [groups, ledgers] = await Promise.all([
    ledgerGroupRepository.findMany(companyId),
    ledgerRepository.findLedgersForValidation(client, uniqueIds),
  ]);
  const cashGroupIds = getGroupSubtreeIds(groups, [CASH_IN_HAND_GROUP_NAME]);
  const ledgersById = new Map<string, LedgerForValidation>(ledgers.map((ledger) => [ledger.id, ledger]));

  for (const id of uniqueIds) {
    const ledger = ledgersById.get(id);
    if (!ledger || ledger.companyId !== companyId) {
      throw new AppError("One or more ledgers were not found.");
    }
    if (!ledger.isActive) {
      throw new AppError(`Ledger "${ledger.name}" is inactive and cannot be used for ${usageLabel}.`);
    }
    if (!isCashOrBankClass(ledger.ledgerGroupId, ledger.hasBankAccount, cashGroupIds)) {
      throw new AppError(
        `Ledger "${ledger.name}" is not a Cash-in-Hand or bank-linked ledger and cannot be used for ${usageLabel}.`
      );
    }
  }
}

/**
 * Read-only equivalent of `assertLedgersAreCashOrBank`'s classification,
 * exposed as a plain id set rather than a throwing assertion
 * (67-cash-flow.md) — every active ledger in the company that is either
 * under the Cash-in-Hand group subtree or carries a `BankAccount` row.
 * Built from the same two lookups that assertion already performs
 * internally (`ledgerGroupRepository.findMany` +
 * `getGroupSubtreeIds([CASH_IN_HAND_GROUP_NAME])`, plus every ledger's
 * `hasBankAccount` flag via `ledgerRepository.findAllForValidation` — the
 * company-wide variant of `findLedgersForValidation`, so this reads the
 * ledger table once rather than discovering ids and re-fetching them).
 */
export async function getCashAndBankLedgerIds(companyId: string): Promise<Set<string>> {
  const [groups, ledgers] = await Promise.all([
    ledgerGroupRepository.findMany(companyId),
    ledgerRepository.findAllForValidation(companyId),
  ]);
  const cashGroupIds = getGroupSubtreeIds(groups, [CASH_IN_HAND_GROUP_NAME]);

  const result = new Set<string>();
  for (const ledger of ledgers) {
    if (ledger.isActive && isCashOrBankClass(ledger.ledgerGroupId, ledger.hasBankAccount, cashGroupIds)) {
      result.add(ledger.id);
    }
  }
  return result;
}

/**
 * 91-payment-mode-integration-sales.md's Module Responsibilities: the
 * three-way classification (`CASH` vs. `BANK` vs. `NEITHER`) a payment
 * line's chosen `PaymentMode.ledgerClass` is checked against, via
 * `assertPaymentModeMatchesLedger`. A ledger not found (wrong company, or no
 * such id) classifies as `NEITHER` — callers that need "ledger exists" as a
 * distinct condition check that first, exactly like every other ledger
 * reference check in this codebase.
 *
 * Takes the caller's own `client` (never the global `prisma` singleton) so
 * the LEDGER ROW ITSELF is read inside a posting-time call's own transaction
 * snapshot — mirrors `assertLedgersAreCashOrBank`'s own signature and its
 * "never trust an outside-transaction read" rationale
 * (sales-invoice-service.ts's `verifyPermanentCustomer` doc comment, a prior
 * security review finding). Deviates from spec 91's own literal
 * `(paymentModeId, ledgerId, companyId)` signature for
 * `assertPaymentModeMatchesLedger`, which omitted a client parameter
 * entirely — recorded in progress-tracker.md.
 *
 * **Known, pre-existing limitation, inherited rather than introduced here**:
 * `ledgerGroupRepository.findMany` (used to resolve the Cash-in-Hand group
 * subtree) has no `client` parameter and always reads through the global
 * `prisma` singleton — `assertLedgersAreCashOrBank` has carried this same gap
 * since it was written. In practice this means only the ledger row's own
 * `ledgerGroupId`/`hasBankAccount` are guaranteed to reflect the calling
 * transaction's snapshot; the ledger-GROUP hierarchy itself is read outside
 * it, so a concurrent Ledger Groups restructuring landing mid-transaction is
 * not fully isolated. Not fixed here (would mean threading `client` through
 * `ledgerGroupRepository.findMany` and every existing caller) — flagged by
 * security review, recorded here rather than silently overclaimed.
 */
export async function getLedgerPaymentClass(
  client: PrismaClientOrTransaction,
  ledgerId: string,
  companyId: string
): Promise<LedgerPaymentClass> {
  const [groups, ledgers] = await Promise.all([
    ledgerGroupRepository.findMany(companyId),
    ledgerRepository.findLedgersForValidation(client, [ledgerId]),
  ]);
  const ledger = ledgers.find((candidate) => candidate.id === ledgerId);
  if (!ledger || ledger.companyId !== companyId) {
    return "NEITHER";
  }
  const cashGroupIds = getGroupSubtreeIds(groups, [CASH_IN_HAND_GROUP_NAME]);
  return classifyLedger(ledger.ledgerGroupId, ledger.hasBankAccount, cashGroupIds);
}

/**
 * The company-wide equivalent of `getLedgerPaymentClass`, mirroring
 * `getCashAndBankLedgerIds`'s own single-query shape — used to annotate a
 * payment/refund ledger picker's options so the UI can auto-select the
 * closest-matching active Payment Mode when the ledger changes
 * (91-payment-mode-integration-sales.md's UI section), without a per-ledger
 * round trip.
 */
export async function getLedgerPaymentClassMap(companyId: string): Promise<Map<string, LedgerPaymentClass>> {
  const [groups, ledgers] = await Promise.all([
    ledgerGroupRepository.findMany(companyId),
    ledgerRepository.findAllForValidation(companyId),
  ]);
  const cashGroupIds = getGroupSubtreeIds(groups, [CASH_IN_HAND_GROUP_NAME]);

  return new Map(ledgers.map((ledger) => [ledger.id, classifyLedger(ledger.ledgerGroupId, ledger.hasBankAccount, cashGroupIds)]));
}
