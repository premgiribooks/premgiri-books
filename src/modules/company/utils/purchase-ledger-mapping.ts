import { Prisma, type CompanySettings } from "@prisma/client";

import { AppError } from "@/lib/app-error";
import { prisma } from "@/lib/prisma";
import {
  DUTIES_AND_TAXES_GROUP_NAME,
  PURCHASE_ACCOUNTS_GROUP_NAME,
} from "@/modules/ledger-groups/constants/default-groups";
import { ledgerGroupRepository } from "@/modules/ledger-groups/repositories/ledger-group-repository";
import { ledgerRepository } from "@/modules/ledgers/repositories/ledger-repository";
import { getGroupSubtreeIds } from "@/modules/ledgers/utils/group-subtree";

type PrismaClientOrTransaction = typeof prisma | Prisma.TransactionClient;

// The Purchase/Input-GST ledger mapping check (44-purchase-invoice.md's Data
// Model decision) — mirrors sales-ledger-mapping.ts's cheap non-null check
// exactly, extracted here so purchase-invoice-service.ts's form options and
// the Settings page can share it. `roundOffLedgerId` is reused from Sales
// Invoice's own mapping (one Round Off ledger serves both directions), so
// this list has six entries like sales-ledger-mapping.ts's, but only five
// are new fields.
export const PURCHASE_LEDGER_MAPPING_CHECKS: readonly [keyof CompanySettings, string][] = [
  ["purchaseLedgerId", "Purchase Account"],
  ["inputCgstLedgerId", "Input CGST"],
  ["inputSgstLedgerId", "Input SGST"],
  ["inputIgstLedgerId", "Input IGST"],
  ["inputCessLedgerId", "Input Cess"],
  ["roundOffLedgerId", "Round Off"],
];

/** Posting requires all six mappings configured; drafting/editing does not.
 * Rejects naming the FIRST missing mapping, in a fixed order. This is the
 * cheap "is a value present" check only — the group/active/company-owned
 * validation that also runs at posting time lives in
 * purchase-invoice-service.ts, since it needs a database read this pure
 * util deliberately avoids (mirrors sales-ledger-mapping.ts's identical
 * split). */
export function assertPurchaseLedgerMappingComplete(
  settings: CompanySettings | null
): asserts settings is CompanySettings {
  if (!settings) {
    throw new AppError('Configure the "Purchase Account" ledger in Settings > Sales & Purchase GST Ledgers before posting.');
  }
  for (const [key, label] of PURCHASE_LEDGER_MAPPING_CHECKS) {
    if (!settings[key]) {
      throw new AppError(`Configure the "${label}" ledger in Settings > Sales & Purchase GST Ledgers before posting.`);
    }
  }
}

export function isPurchaseLedgerMappingComplete(settings: CompanySettings | null): boolean {
  if (!settings) {
    return false;
  }
  return PURCHASE_LEDGER_MAPPING_CHECKS.every(([key]) => Boolean(settings[key]));
}

/**
 * All six Company Settings ledger mappings, validated unconditionally
 * (44-purchase-invoice.md's Ledger Mapping Validation — Option B: checked on
 * every posting regardless of the specific document's own supply
 * type/cess/round-off amount). `purchaseLedgerId` must be under "Purchase
 * Accounts" (or a descendant); the four input-tax mappings under "Duties &
 * Taxes" (or a descendant); `roundOffLedgerId` (shared with Sales Invoice)
 * any active company ledger. Each mapping's ledger must also be active and
 * owned by this company.
 *
 * Extracted here (rather than kept private to purchase-invoice-service.ts)
 * so Purchase Return (45-purchase-return.md's Code Standards: "missing-
 * ledger-mapping rejection, reusing spec 44's five-plus-shared-round-off
 * matrix") can reuse the identical check without re-deriving it — this is
 * the shared Company/Ledger-domain concern both documents post against, not
 * something specific to the Purchase Invoice module itself. The ledger read
 * itself goes through `ledgerRepository` (not a raw Prisma call here) since
 * a repository is this project's sole allowed place for direct Prisma
 * access — see `ledgerRepository.findLedgersForValidation`'s own doc comment
 * for why it lives there instead of duplicated per-module.
 */
export async function assertPurchaseLedgerMappingValid(
  client: PrismaClientOrTransaction,
  companyId: string,
  settingsOrNull: CompanySettings | null
): Promise<void> {
  assertPurchaseLedgerMappingComplete(settingsOrNull);
  const settings = settingsOrNull;

  const groups = await ledgerGroupRepository.findMany(companyId);
  const purchaseAccountIds = getGroupSubtreeIds(groups, [PURCHASE_ACCOUNTS_GROUP_NAME]);
  const dutiesAndTaxesIds = getGroupSubtreeIds(groups, [DUTIES_AND_TAXES_GROUP_NAME]);

  const checks: { key: keyof CompanySettings; label: string; allowedGroupIds: ReadonlySet<string> | null; groupLabel: string }[] = [
    { key: "purchaseLedgerId", label: "Purchase Account", allowedGroupIds: purchaseAccountIds, groupLabel: PURCHASE_ACCOUNTS_GROUP_NAME },
    { key: "inputCgstLedgerId", label: "Input CGST", allowedGroupIds: dutiesAndTaxesIds, groupLabel: DUTIES_AND_TAXES_GROUP_NAME },
    { key: "inputSgstLedgerId", label: "Input SGST", allowedGroupIds: dutiesAndTaxesIds, groupLabel: DUTIES_AND_TAXES_GROUP_NAME },
    { key: "inputIgstLedgerId", label: "Input IGST", allowedGroupIds: dutiesAndTaxesIds, groupLabel: DUTIES_AND_TAXES_GROUP_NAME },
    { key: "inputCessLedgerId", label: "Input Cess", allowedGroupIds: dutiesAndTaxesIds, groupLabel: DUTIES_AND_TAXES_GROUP_NAME },
    { key: "roundOffLedgerId", label: "Round Off", allowedGroupIds: null, groupLabel: "" },
  ];

  const ledgerIds = checks.map((check) => settings[check.key] as string);
  const ledgers = await ledgerRepository.findLedgersForValidation(client, ledgerIds);
  const ledgersById = new Map(ledgers.map((ledger) => [ledger.id, ledger]));

  for (const check of checks) {
    const ledgerId = settings[check.key] as string;
    const ledger = ledgersById.get(ledgerId);
    if (!ledger || ledger.companyId !== companyId) {
      throw new AppError(
        `The "${check.label}" ledger mapping in Settings > Sales & Purchase GST Ledgers is invalid — select a valid ledger.`
      );
    }
    if (!ledger.isActive) {
      throw new AppError(
        `The "${check.label}" ledger is inactive. Configure an active ledger in Settings > Sales & Purchase GST Ledgers.`
      );
    }
    if (check.allowedGroupIds && !check.allowedGroupIds.has(ledger.ledgerGroupId)) {
      throw new AppError(
        `The "${check.label}" ledger must belong to the "${check.groupLabel}" ledger group. Configure it in Settings > Sales & Purchase GST Ledgers.`
      );
    }
  }
}
