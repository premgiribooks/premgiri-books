// 87-liability-settlement.md's read model — one row per LIABILITY-nature
// ledger with a real outstanding (flipped-positive) balance, plus a grand
// total. No Prisma model backs this; every figure is copied from
// voucherEngine.getTrialBalance's own output (see
// src/engines/reporting/liability-settlement.ts).
export interface LiabilitySettlementRow {
  ledgerId: string;
  ledgerName: string;
  ledgerGroupId: string;
  ledgerGroupName: string;
  outstandingAmount: number;
}

export interface LiabilitySettlementReport {
  rows: LiabilitySettlementRow[];
  totalOutstanding: number;
}
