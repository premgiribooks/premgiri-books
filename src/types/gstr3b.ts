// 59-gstr-3b.md — GSTR-3B's own return shape. Reuses 58-gstr-1.md's
// GstFilingRecord/MarkPeriodFiledInput verbatim (no re-export here; import
// directly from "@/types/gstr1") since this spec adds no filing model of
// its own.

/**
 * One statutory GSTR-3B tax row: a taxable-value + CGST/SGST/IGST/Cess
 * breakup. `reason` is a non-empty explanation whenever `computed` is
 * false (Business Rules — every not-computed row is present with an
 * explicit reason, never simply omitted). When `computed` is true,
 * `reason` is usually "" but may still carry a caveat (see
 * Gstr3bEligibleItc.netItcAvailable).
 */
export interface Gstr3bTaxRow {
  computed: boolean;
  reason: string;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
}

/** Table 3.1 — outward supplies and inward supplies liable to reverse charge. */
export interface Gstr3bOutwardSupplies {
  /** (a) Outward taxable supplies (other than zero-rated, nil-rated, exempt) — computed. */
  taxableOutwardSupplies: Gstr3bTaxRow;
  /** (b) Outward taxable supplies (zero rated) — not computed, no export/SEZ flow exists. */
  zeroRatedOutwardSupplies: Gstr3bTaxRow;
  /** (c) Other outward supplies (nil rated, exempt) — computed. */
  nilRatedExemptOutwardSupplies: Gstr3bTaxRow;
  /** (d) Inward supplies liable to reverse charge — not computed, no isReverseCharge flag persisted anywhere. */
  inwardReverseChargeSupplies: Gstr3bTaxRow;
  /** (e) Non-GST outward supplies — not computed, no such flag exists. */
  nonGstOutwardSupplies: Gstr3bTaxRow;
}

/** Table 3.2's computed sub-row: one state's consolidated inter-state supply to unregistered recipients. */
export interface Gstr3bInterStateUnregisteredGroup {
  placeOfSupplyStateCode: string;
  taxableAmount: number;
  igst: number;
}

/** Table 3.2 — inter-state supplies to unregistered persons, composition taxpayers, and UIN holders. */
export interface Gstr3bInterStateSupplies {
  /** Computed — filtered/consolidated from getOutwardSupplyLines, same scope as 58-gstr-1.md's Table 5/7. */
  unregisteredRecipients: Gstr3bInterStateUnregisteredGroup[];
  /** Not computed — Customer/Supplier has no composition-scheme flag. */
  compositionTaxpayers: { computed: false; reason: string };
  /** Not computed — Customer/Supplier has no UIN-holder flag. */
  uinHolders: { computed: false; reason: string };
}

/** One Table 4 ITC row — tax breakup only; the statutory form has no taxable-value column here. */
export interface Gstr3bItcRow {
  computed: boolean;
  reason: string;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
}

/** Table 4 — Eligible ITC. */
export interface Gstr3bEligibleItc {
  /** (A)(1) Import of goods — not computed, no import document flow exists. */
  importOfGoods: Gstr3bItcRow;
  /** (A)(2) Import of services — not computed, no import document flow exists. */
  importOfServices: Gstr3bItcRow;
  /** (A)(3) Inward supplies liable to reverse charge — not computed. */
  inwardReverseChargeItc: Gstr3bItcRow;
  /** (A)(4) ISD credit — not computed, no ISD document flow exists. */
  isdCredit: Gstr3bItcRow;
  /** (A)(5) All other ITC — computed, the only ITC sub-row this codebase's data supports. */
  allOtherItc: Gstr3bItcRow;
  /** (B) ITC reversed — not computed; a Purchase Return already reduces (A)(5) directly. */
  itcReversed: Gstr3bItcRow;
  /** (C) Net ITC available = (A)(5) - (B) — computed, always equal to (A)(5) since (B) is always 0. */
  netItcAvailable: Gstr3bItcRow;
  /** (D) Ineligible ITC — not computed, no Section 17(5) eligibility category is recorded anywhere. */
  ineligibleItc: Gstr3bItcRow;
}

/** One Table 5 amount-only row — nil-rated/exempt/non-GST inward supplies carry no tax breakup. */
export interface Gstr3bAmountRow {
  computed: boolean;
  reason: string;
  amount: number;
}

/** Table 5 — exempt, nil-rated, and non-GST inward supplies. */
export interface Gstr3bExemptInwardSupplies {
  intraState: Gstr3bAmountRow;
  interState: Gstr3bAmountRow;
  /** Not computed — no product/document is flagged non-GST distinct from 0%-rated. */
  nonGst: Gstr3bAmountRow;
}

/** Table 5.1 — interest and late fee. Always not computed: presentational-only, depends on the actual GST portal filing date this offline system never tracks. */
export interface Gstr3bInterestLateFee {
  computed: false;
  reason: string;
}

export interface Gstr3bReturn {
  periodStart: Date;
  periodEnd: Date;
  outwardSupplies: Gstr3bOutwardSupplies;
  interStateSupplies: Gstr3bInterStateSupplies;
  eligibleItc: Gstr3bEligibleItc;
  exemptInwardSupplies: Gstr3bExemptInwardSupplies;
  interestLateFee: Gstr3bInterestLateFee;
}
