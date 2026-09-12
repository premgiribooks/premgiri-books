import type { CustomerType, VoucherType } from "@prisma/client";

// 71-customer-reports.md — the four Customer Reports view-models, produced
// by src/engines/reporting/customer-reports.ts. No new Prisma model anywhere
// in this file — every balance figure is read directly from
// voucherEngine's own getTrialBalance/getLedgerStatement output (never
// re-derived from Voucher/VoucherEntry rows independently), and the Sales
// Summary view reuses sales-report.ts's own PartyWiseSalesReport type
// unmodified.

/**
 * A Customer's display fields for this module's own reports — fetched
 * directly from Prisma in customer-report-service.ts rather than through
 * `customerService.listCustomers()` (this spec's own literal suggestion):
 * the seeded Accountant role has `reports:view` but not `masters:view` (the
 * same permission-mismatch precedent purchase/inventory-report-service.ts's
 * own listSupplierOptions/listReportProducts already established for this
 * batch of reports), so routing this read through that masters-gated
 * service would 403 exactly the role this module exists to serve.
 * `openingBalance`/`openingBalanceType` are carried only so the Outstanding
 * Report can fall back to a customer's own signed opening balance in the
 * defensive case its ledger doesn't appear in a `getTrialBalance` result at
 * all (Business Rules #1) — `getTrialBalance` itself already lists every
 * ledger in the company, so this fallback is never expected to trigger in
 * practice.
 */
export interface CustomerReportRow {
  id: string;
  displayName: string;
  customerType: CustomerType;
  mobileNumber: string | null;
  gstin: string | null;
  city: string | null;
  state: string | null;
  isActive: boolean;
  ledgerId: string;
  creditLimit: number | null;
  openingBalance: number;
  openingBalanceType: "DEBIT" | "CREDIT";
}

export interface CustomerOutstandingRow {
  customerId: string;
  customerName: string;
  customerType: CustomerType;
  /** Debit-positive, matching `getTrialBalance`'s own convention — a customer who owes the business money shows a positive balance. */
  outstandingBalance: number;
  creditLimit: number | null;
  /** `outstandingBalance > creditLimit` when `creditLimit` is set; null (not applicable) when it is not — never a default like `false`. */
  isOverLimit: boolean | null;
}

export interface CustomerOutstandingReport {
  rows: CustomerOutstandingRow[];
}

export interface CustomerStatementLine {
  voucherId: string;
  voucherNumber: string;
  voucherType: VoucherType;
  /** Humanized `voucherType` (e.g. "Sales Voucher") — `getLedgerStatement`'s own `LedgerStatementLine` already carries `voucherNumber`/`voucherType` directly, unlike Stock Ledger's referenceType/referenceId shape, so no document-number lookup is needed here. */
  voucherTypeLabel: string;
  voucherDate: Date;
  narration: string | null;
  debit: number;
  credit: number;
  /** Debit-positive running balance immediately after this entry. */
  runningBalance: number;
}

export interface CustomerStatementReport {
  customerId: string;
  customerName: string;
  /** Debit-positive balance immediately before `from`. */
  openingBalance: number;
  lines: CustomerStatementLine[];
  /** Debit-positive balance as of `to`. */
  closingBalance: number;
}

export interface CustomerDirectoryRow {
  id: string;
  displayName: string;
  customerType: CustomerType;
  mobileNumber: string | null;
  gstin: string | null;
  city: string | null;
  state: string | null;
  isActive: boolean;
}

export interface CustomerDirectoryReport {
  rows: CustomerDirectoryRow[];
}
