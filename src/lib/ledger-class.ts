import type { Prisma } from "@prisma/client";

import { AppError } from "@/lib/app-error";
import { prisma } from "@/lib/prisma";
import { CASH_IN_HAND_GROUP_NAME } from "@/modules/ledger-groups/constants/default-groups";
import { ledgerGroupRepository } from "@/modules/ledger-groups/repositories/ledger-group-repository";
import { ledgerRepository, type LedgerForValidation } from "@/modules/ledgers/repositories/ledger-repository";
import { getGroupSubtreeIds } from "@/modules/ledgers/utils/group-subtree";

type PrismaClientOrTransaction = typeof prisma | Prisma.TransactionClient;

/**
 * The Cash-in-Hand-subtree-or-bank-linked classification test itself, shared
 * by `assertLedgersAreCashOrBank` (throwing) and `getCashAndBankLedgerIds`
 * (67-cash-flow.md's plain id-set equivalent) so the rule lives in exactly
 * one place.
 */
function isCashOrBankClass(ledgerGroupId: string, hasBankAccount: boolean, cashGroupIds: Set<string>): boolean {
  return cashGroupIds.has(ledgerGroupId) || hasBankAccount;
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
