import type { VoucherType } from "@prisma/client";

// 72-supplier-reports.md — the four Supplier Reports view-models, produced
// by src/engines/reporting/supplier-reports.ts. No new Prisma model anywhere
// in this file — every balance figure is read directly from voucherEngine's
// own getTrialBalance/getLedgerStatement output (never re-derived from
// Voucher/VoucherEntry rows independently), and the Purchase Summary view
// reuses purchase-report.ts's own PartyWisePurchaseReport type unmodified.
// Mirrors src/types/customer-report.ts, minus the "Over Limit"/creditLimit
// concept — `Supplier` has no `creditLimit` field at all (27-supplier-
// management.md's own deliberate omission), so this file does not invent one
// to force symmetry with the customer side.

/**
 * A Supplier's display fields for this module's own reports — fetched
 * directly from Prisma in supplier-report-service.ts rather than through
 * `supplierService.listSuppliers()` (this spec's own literal suggestion,
 * mirroring 71-customer-reports.md's own listReportCustomers precedent): the
 * seeded Accountant role has `reports:view` but not `masters:view`, so
 * routing this read through that masters-gated service would 403 exactly the
 * role this module exists to serve. `openingBalance`/`openingBalanceType`
 * are carried only so the Outstanding Report can fall back to a supplier's
 * own signed opening balance in the defensive case its ledger doesn't appear
 * in a `getTrialBalance` result at all (Business Rules #1) —
 * `getTrialBalance` itself already lists every ledger in the company, so
 * this fallback is never expected to trigger in practice.
 */
export interface SupplierReportRow {
  id: string;
  displayName: string;
  mobileNumber: string | null;
  gstin: string | null;
  city: string | null;
  state: string | null;
  isActive: boolean;
  ledgerId: string;
  creditDays: number | null;
  openingBalance: number;
  openingBalanceType: "DEBIT" | "CREDIT";
}

export interface SupplierOutstandingRow {
  supplierId: string;
  supplierName: string;
  /** Debit-positive, matching `getTrialBalance`'s own convention — a supplier the business owes money to shows a negative (credit-nature) balance. */
  outstandingBalance: number;
  /** Informational only, not a comparison column — `Supplier` has no `creditLimit` field, so there is nothing to flag "over" (see 72-supplier-reports.md's Goal). */
  creditDays: number | null;
}

export interface SupplierOutstandingReport {
  rows: SupplierOutstandingRow[];
}

export interface SupplierStatementLine {
  voucherId: string;
  voucherNumber: string;
  voucherType: VoucherType;
  /** Humanized `voucherType` (e.g. "Purchase Voucher") — `getLedgerStatement`'s own `LedgerStatementLine` already carries `voucherNumber`/`voucherType` directly, so no document-number lookup is needed here. */
  voucherTypeLabel: string;
  voucherDate: Date;
  narration: string | null;
  debit: number;
  credit: number;
  /** Debit-positive running balance immediately after this entry. */
  runningBalance: number;
}

export interface SupplierStatementReport {
  supplierId: string;
  supplierName: string;
  /** Debit-positive balance immediately before `from`. */
  openingBalance: number;
  lines: SupplierStatementLine[];
  /** Debit-positive balance as of `to`. */
  closingBalance: number;
}

export interface SupplierDirectoryRow {
  id: string;
  displayName: string;
  mobileNumber: string | null;
  gstin: string | null;
  city: string | null;
  state: string | null;
  creditDays: number | null;
  isActive: boolean;
}

export interface SupplierDirectoryReport {
  rows: SupplierDirectoryRow[];
}
