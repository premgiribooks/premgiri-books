import type { HsnCodeType } from "@prisma/client";

import type { GstRegisterTotals } from "@/types/gst-report";

/**
 * 60-hsn-summary.md — one HSN/SAC + rate group of GSTR-1 Table 12. `hsnCode`/
 * `codeType`/`description` are all `null` for the single "No HSN Assigned"
 * bucket (product-bearing lines whose product carries no `hsnCodeId`);
 * Credit Note/Debit Note lines (no `productId` at all) are excluded from the
 * grouped output entirely and never reach either shape.
 */
export interface HsnSummaryRow {
  hsnCode: string | null;
  codeType: HsnCodeType | null;
  description: string | null;
  ratePercent: number | null;
  /** Representative Unit.uqcCode (or symbol fallback) for the group — see `isMixedUnit`. */
  uqcCode: string | null;
  /** True when this group summed quantities from more than one distinct Unit. */
  isMixedUnit: boolean;
  quantity: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  totalAmount: number;
}

export interface HsnSummaryResult {
  rows: HsnSummaryRow[];
  totals: GstRegisterTotals;
}
