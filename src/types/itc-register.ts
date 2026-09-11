import type { GstSupplyLine } from "@/engines/gst/gst-report-types";
import type { GstRegisterTotals } from "@/types/gst-report";

/**
 * 83-itc-register.md — one rate-percent group of the period's eligible
 * inward ITC. No place-of-supply dimension (unlike GSTR-1's Table 7
 * consolidation) — inward ITC has no outward-style inter/intra-state
 * reporting requirement.
 */
export interface ItcRegisterRateGroup {
  ratePercent: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  totalAmount: number;
}

/**
 * One supplier group. `partyId` is null only in the theoretical case a line
 * carries no resolvable party (never actually produced by
 * `getInwardSupplyLines` today — every Purchase Invoice/Return line always
 * resolves a real Supplier — kept nullable to match `GstSupplyLine.partyId`'s
 * own type rather than asserting a guarantee this module doesn't itself
 * enforce).
 */
export interface ItcRegisterPartyGroup {
  partyId: string | null;
  partyName: string;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  totalAmount: number;
}

/**
 * One HSN-code group. `hsnCode` is null for the single "No HSN Assigned"
 * bucket (product-bearing lines whose product carries no `hsnCodeId`),
 * mirroring `60-hsn-summary.md`'s own precedent for the identical gap on the
 * outward side.
 */
export interface ItcRegisterHsnGroup {
  hsnCode: string | null;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  totalAmount: number;
}

/**
 * `itcRegisterService.getItcRegister`'s full result — the three summary
 * groupings, the transaction-level detail lines (reused unmodified from
 * `57-gst-registers.md`'s Inward Register), and the grand total that must
 * reconcile exactly with `59-gstr-3b.md`'s Table 4(A)(5).
 */
export interface ItcRegisterResult {
  rateWise: ItcRegisterRateGroup[];
  partyWise: ItcRegisterPartyGroup[];
  hsnWise: ItcRegisterHsnGroup[];
  lines: GstSupplyLine[];
  totals: GstRegisterTotals;
}
