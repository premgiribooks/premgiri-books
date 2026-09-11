// 82-gstr-2.md — GSTR-2's own return shape. No filing model of any kind (see
// the spec's Filing section) — unlike GSTR-1/GSTR-3B, this file never
// imports GstFilingRecord.

/**
 * One Table 3 (registered supplies) or Table 7 (composition/exempt) party-
 * scoped invoice-wise group, one row per Purchase Invoice/Purchase Return
 * document — mirrors 58-gstr-1.md's Gstr1DocumentGroup shape, restricted to
 * this codebase's two inward document types.
 */
export interface Gstr2DocumentGroup {
  documentType: "PURCHASE_INVOICE" | "PURCHASE_RETURN";
  documentId: string;
  documentNumber: string;
  documentDate: Date;
  partyId: string | null;
  partyName: string;
  partyGstin: string | null;
  placeOfSupplyStateCode: string;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  totalAmount: number;
}

/**
 * Table 7 — one supplier's consolidated no-GSTIN/nil-rated total. Grouped by
 * `partyId` (Business Rules: "consolidated by party"), unlike GSTR-1's Table
 * 7 which consolidates by (place of supply, rate) — GSTR-2's Table 7 is a
 * composition/exempt-supplier-facing table, not a rate-wise one.
 */
export interface Gstr2PartyConsolidatedGroup {
  partyId: string;
  partyName: string;
  partyGstin: string | null;
  taxableAmount: number;
  totalAmount: number;
}

/**
 * A row this codebase's data model cannot support at all (Tables 4/5/8/9/11)
 * — always `computed: false`, always ₹0, always a non-empty reason (Business
 * Rules — "every table row this codebase's data model cannot support is
 * rendered as an explicit 'not tracked' placeholder, never guessed at or
 * silently omitted").
 */
export interface Gstr2NotTrackedRow {
  computed: false;
  reason: string;
  amount: 0;
}

/**
 * GSTR-2's return shape. Tables 6 (amendments), 10 (advances), 12 (output-tax
 * mismatch), and 13 (purchase-side HSN summary) are absent entirely — not
 * present even as `computed: false` rows (Business Rules explicitly
 * distinguishes "not rendered at all" from a labeled not-computed row).
 */
export interface Gstr2Return {
  periodStart: Date;
  periodEnd: Date;
  /** Table 3 — registered-supplier invoice-wise groups. Computed, with the reverse-charge caveat below. */
  registeredSupplies: Gstr2DocumentGroup[];
  /** Table 3's caveat: every registered-supplier line lands here regardless of actual reverse-charge status (no isReverseCharge flag persisted anywhere). */
  registeredSuppliesCaveat: string;
  /** Table 4 — reverse charge liability. Not computed. */
  reverseChargeSupplies: Gstr2NotTrackedRow;
  /** Table 5 — imports from Overseas/SEZ (Bill of Entry). Not computed. */
  importsOverseasOrSez: Gstr2NotTrackedRow;
  /** Table 7 — no-GSTIN-supplier and nil-rated supplier groups, consolidated by party. Computed, with the composition-scheme caveat below. */
  compositionAndExemptSupplies: Gstr2PartyConsolidatedGroup[];
  /** Table 7's caveat: a composition-scheme supplier cannot be distinguished from a merely-unregistered one (no composition flag on Supplier). */
  compositionAndExemptCaveat: string;
  /** Table 8 — ISD credit received. Not computed. */
  isdCredit: Gstr2NotTrackedRow;
  /** Table 9 — TDS and TCS credit received. Not computed. */
  tdsTcsCredit: Gstr2NotTrackedRow;
  /** Table 11 — ITC reversal/reclaim. Not computed. */
  itcReversal: Gstr2NotTrackedRow;
}
