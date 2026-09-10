import type { CompanySettings } from "@prisma/client";

import { AppError } from "@/lib/app-error";

// The Sales/GST ledger mapping check (38-sales-invoice.md's Data Model
// decision) — extracted here so Sales Return (39-sales-return.md: "reusing
// 38-sales-invoice.md's mapping — the same six-field-missing rejection
// applies here too") can share it without duplicating the six-entry table.
export const SALES_LEDGER_MAPPING_CHECKS: readonly [keyof CompanySettings, string][] = [
  ["salesLedgerId", "Sales Account"],
  ["outputCgstLedgerId", "Output CGST"],
  ["outputSgstLedgerId", "Output SGST"],
  ["outputIgstLedgerId", "Output IGST"],
  ["outputCessLedgerId", "Output Cess"],
  ["roundOffLedgerId", "Round Off"],
];

/** Posting requires all six mappings configured; drafting/editing does not.
 * Rejects naming the FIRST missing mapping, in a fixed order. */
export function assertSalesLedgerMappingComplete(
  settings: CompanySettings | null
): asserts settings is CompanySettings {
  if (!settings) {
    throw new AppError('Configure the "Sales Account" ledger in Settings > Sales & GST Ledgers before posting.');
  }
  for (const [key, label] of SALES_LEDGER_MAPPING_CHECKS) {
    if (!settings[key]) {
      throw new AppError(`Configure the "${label}" ledger in Settings > Sales & GST Ledgers before posting.`);
    }
  }
}

export function isSalesLedgerMappingComplete(settings: CompanySettings | null): boolean {
  if (!settings) {
    return false;
  }
  return SALES_LEDGER_MAPPING_CHECKS.every(([key]) => Boolean(settings[key]));
}
