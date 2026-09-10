import type { CompanySettings } from "@prisma/client";

import { AppError } from "@/lib/app-error";

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
