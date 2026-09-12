import type { BalanceType, VoucherType } from "@prisma/client";

import { buildPartyWiseSalesReport } from "@/engines/reporting/sales-reports";
import type { LedgerStatementResult, TrialBalanceResult } from "@/engines/voucher/types";
import type { PartyWiseSalesAggregateRow } from "@/types/sales-invoice";
import type { PartyWiseSalesReport } from "@/types/sales-report";
import type {
  CustomerDirectoryReport,
  CustomerOutstandingReport,
  CustomerReportRow,
  CustomerStatementReport,
} from "@/types/customer-report";

// 71-customer-reports.md's Reporting Engine composition layer — pure
// functions only, no Prisma import anywhere in this file. Every balance
// figure here is read as-is from voucherEngine's own
// getTrialBalance/getLedgerStatement output — never re-summed or
// re-derived from Voucher/VoucherEntry rows directly (Invariant 9,
// "Accounting reports derive data only from vouchers"). Every data access
// happens in customer-report-service.ts, which passes already-fetched
// customer rows and query results in as plain arguments.

/** `openingBalance`, signed debit-positive by `openingBalanceType` — duplicated locally rather than imported, matching this codebase's own per-module convention (see voucher-queries.ts's identical helper). */
function signedOpening(openingBalance: number, openingBalanceType: BalanceType): number {
  return openingBalanceType === "DEBIT" ? openingBalance : -openingBalance;
}

/** "SALES" -> "Sales Voucher", "CREDIT_NOTE" -> "Credit Note Voucher". */
function humanizeVoucherType(voucherType: VoucherType): string {
  const words = voucherType
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1));
  return `${words.join(" ")} Voucher`;
}

/**
 * Business Rules #1 — joins `getTrialBalance`'s own per-ledger rows to each
 * Customer's `ledgerId`. `getTrialBalance` already lists every ledger in the
 * company (its own documented contract), so every customer is expected to
 * find a match; the `signedOpening` fallback below only guards the
 * defensive case where one somehow doesn't (never treated as zero, per the
 * spec's own "don't invent a default" posture). The Over Limit flag is
 * `null` (not applicable) rather than `false` when no `creditLimit` is set —
 * "nothing to compare against."
 */
export function buildCustomerOutstandingReport(
  trialBalance: TrialBalanceResult,
  customers: readonly CustomerReportRow[]
): CustomerOutstandingReport {
  const trialBalanceRowByLedgerId = new Map(trialBalance.rows.map((row) => [row.ledgerId, row]));

  const rows = customers.map((customer) => {
    const matchedRow = trialBalanceRowByLedgerId.get(customer.ledgerId);
    const outstandingBalance = matchedRow
      ? matchedRow.closingBalance
      : signedOpening(customer.openingBalance, customer.openingBalanceType);

    return {
      customerId: customer.id,
      customerName: customer.displayName,
      customerType: customer.customerType,
      outstandingBalance,
      creditLimit: customer.creditLimit,
      isOverLimit: customer.creditLimit === null ? null : outstandingBalance > customer.creditLimit,
    };
  });

  return { rows };
}

/**
 * Business Rules #2 — `getLedgerStatement`'s own dated lines, split into
 * separate Debit/Credit columns for presentation (the engine's own
 * `LedgerStatementLine` carries a single signed `entryType`+`amount` pair).
 * `voucherNumber`/`voucherType` are already present on each line (unlike
 * Stock Ledger's referenceType/referenceId shape), so no document-number
 * lookup is needed here.
 */
export function buildCustomerStatement(
  customer: { id: string; displayName: string },
  statement: LedgerStatementResult
): CustomerStatementReport {
  const lines = statement.lines.map((line) => ({
    voucherId: line.voucherId,
    voucherNumber: line.voucherNumber,
    voucherType: line.voucherType,
    voucherTypeLabel: humanizeVoucherType(line.voucherType),
    voucherDate: line.voucherDate,
    narration: line.narration,
    debit: line.entryType === "DEBIT" ? line.amount : 0,
    credit: line.entryType === "CREDIT" ? line.amount : 0,
    runningBalance: line.runningBalance,
  }));

  return {
    customerId: customer.id,
    customerName: customer.displayName,
    openingBalance: statement.openingBalance,
    lines,
    closingBalance: statement.closingBalance,
  };
}

/**
 * Business Rules #3 — reuses `salesInvoiceService.getPartyWiseSalesReport`'s
 * (spec 68) raw aggregate rows and `sales-reports.ts`'s own
 * `buildPartyWiseSalesReport` unmodified, only excluding the two synthetic
 * Walk-in/Quick-Customer buckets first (both have `customerId === null` and
 * no `Customer` master record to anchor a "Customer Reports" view to). No
 * new aggregation logic, no second independent query.
 */
export function buildCustomerSalesSummary(rawRows: readonly PartyWiseSalesAggregateRow[]): PartyWiseSalesReport {
  return buildPartyWiseSalesReport(rawRows.filter((row) => row.customerId !== null));
}

/** Business Rules #4 — a straightforward presentation of the Customer rows already fetched. */
export function buildCustomerDirectory(customers: readonly CustomerReportRow[]): CustomerDirectoryReport {
  const rows = customers.map((customer) => ({
    id: customer.id,
    displayName: customer.displayName,
    customerType: customer.customerType,
    mobileNumber: customer.mobileNumber,
    gstin: customer.gstin,
    city: customer.city,
    state: customer.state,
    isActive: customer.isActive,
  }));

  return { rows };
}
