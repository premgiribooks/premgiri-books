// Manual-voucher screens (Payment/Receipt/Contra/Journal, specs 52-55) share
// this one read-model for their ledger pickers — no new Prisma model exists
// for any of the four (each *is* a Voucher, see 52-payment-voucher.md's
// Goal), so `PostedVoucher`/`PostedVoucherEntry` from
// `@/engines/voucher/types` are reused directly wherever a voucher shape is
// needed; this file only adds what the engine's own types don't carry.
export interface ManualVoucherLedgerOption {
  id: string;
  name: string;
  /** Active-and-under-Cash-in-Hand, or carries a BankAccount detail row — the class every manual-voucher screen's restricted side is limited to (src/lib/ledger-class.ts). */
  isCashOrBank: boolean;
  /** `ledgerClass` (93-payment-mode-integration-manual-vouchers.md) is this
   * ledger's three-way classification against the Payment Mode master —
   * lets Payment/Receipt/Contra Voucher's forms auto-select the
   * closest-matching active Payment Mode when the Cash/Bank ledger changes,
   * without a server round trip (mirrors SalesInvoicePaymentLedgerOption). */
  ledgerClass: "CASH" | "BANK" | "NEITHER";
}
