import { Prisma, type CompanySettings } from "@prisma/client";

import { AppError } from "@/lib/app-error";
import { prisma } from "@/lib/prisma";
import {
  CURRENT_LIABILITIES_GROUP_NAME,
  INDIRECT_EXPENSES_GROUP_NAME,
} from "@/modules/ledger-groups/constants/default-groups";
import { ledgerGroupRepository } from "@/modules/ledger-groups/repositories/ledger-group-repository";
import { ledgerRepository } from "@/modules/ledgers/repositories/ledger-repository";
import { getGroupSubtreeIds } from "@/modules/ledgers/utils/group-subtree";

type PrismaClientOrTransaction = typeof prisma | Prisma.TransactionClient;

// Payroll's (63-payroll.md) ledger mapping check — mirrors
// purchase-ledger-mapping.ts's identical shape, two fields instead of six
// (payroll posting has no round-off concept).
export const PAYROLL_LEDGER_MAPPING_CHECKS: readonly [keyof CompanySettings, string][] = [
  ["salaryExpenseLedgerId", "Salary Expense"],
  ["salaryPayableLedgerId", "Salary Payable"],
];

/** Posting requires both mappings configured; drafting/editing does not.
 * Rejects naming the FIRST missing mapping, in a fixed order — mirrors
 * purchase-ledger-mapping.ts's assertPurchaseLedgerMappingComplete. */
export function assertPayrollLedgerMappingComplete(
  settings: CompanySettings | null
): asserts settings is CompanySettings {
  if (!settings) {
    throw new AppError('Configure the "Salary Expense" ledger in Settings > Sales & Purchase GST Ledgers before posting.');
  }
  for (const [key, label] of PAYROLL_LEDGER_MAPPING_CHECKS) {
    if (!settings[key]) {
      throw new AppError(`Configure the "${label}" ledger in Settings > Sales & Purchase GST Ledgers before posting.`);
    }
  }
}

export function isPayrollLedgerMappingComplete(settings: CompanySettings | null): boolean {
  if (!settings) {
    return false;
  }
  return PAYROLL_LEDGER_MAPPING_CHECKS.every(([key]) => Boolean(settings[key]));
}

/**
 * Both Company Settings ledger mappings, validated unconditionally
 * (63-payroll.md's Ledger Mapping Validation — the same "Option B, not a
 * conditional subset" decision 38/44 record for their own larger mapping
 * sets). `salaryExpenseLedgerId` must be under "Indirect Expenses" (or a
 * descendant); `salaryPayableLedgerId` must be under "Current Liabilities"
 * (or a descendant, e.g. a company's own "Provisions"/"Salary Payable"
 * sub-group). Each mapping's ledger must also be active and owned by this
 * company.
 */
export async function assertPayrollLedgerMappingValid(
  client: PrismaClientOrTransaction,
  companyId: string,
  settingsOrNull: CompanySettings | null
): Promise<void> {
  assertPayrollLedgerMappingComplete(settingsOrNull);
  const settings = settingsOrNull;

  const groups = await ledgerGroupRepository.findMany(companyId);
  const indirectExpenseIds = getGroupSubtreeIds(groups, [INDIRECT_EXPENSES_GROUP_NAME]);
  const currentLiabilityIds = getGroupSubtreeIds(groups, [CURRENT_LIABILITIES_GROUP_NAME]);

  const checks: { key: keyof CompanySettings; label: string; allowedGroupIds: ReadonlySet<string>; groupLabel: string }[] = [
    { key: "salaryExpenseLedgerId", label: "Salary Expense", allowedGroupIds: indirectExpenseIds, groupLabel: INDIRECT_EXPENSES_GROUP_NAME },
    { key: "salaryPayableLedgerId", label: "Salary Payable", allowedGroupIds: currentLiabilityIds, groupLabel: CURRENT_LIABILITIES_GROUP_NAME },
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
    if (!check.allowedGroupIds.has(ledger.ledgerGroupId)) {
      throw new AppError(
        `The "${check.label}" ledger must belong to the "${check.groupLabel}" ledger group. Configure it in Settings > Sales & Purchase GST Ledgers.`
      );
    }
  }
}
