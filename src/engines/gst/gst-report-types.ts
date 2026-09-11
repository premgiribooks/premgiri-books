// 57-gst-registers.md — the shared line shape every Phase 8/10 GST report
// (Registers, GSTR-1, GSTR-3B, HSN Summary, and Phase 10's future GST
// Reports) consumes without re-deriving. Produced only by
// gst-report-queries.ts's getOutwardSupplyLines/getInwardSupplyLines.

export const GST_SUPPLY_LINE_DOCUMENT_TYPES = [
  "SALES_INVOICE",
  "SALES_RETURN",
  "CREDIT_NOTE",
  "DEBIT_NOTE",
  "PURCHASE_INVOICE",
  "PURCHASE_RETURN",
] as const;

export type GstSupplyLineDocumentType = (typeof GST_SUPPLY_LINE_DOCUMENT_TYPES)[number];

/**
 * One transaction-level GST line, already sign-adjusted per document type
 * (Sales Invoice/Debit Note positive; Sales Return/Credit Note negative;
 * Purchase Invoice positive; Purchase Return negative) and already resolved
 * to the effective (overridden-preferred) tax figures actually posted.
 */
export interface GstSupplyLine {
  documentType: GstSupplyLineDocumentType;
  documentId: string;
  documentNumber: string;
  documentDate: Date;
  /** Customer/Supplier id when resolvable — null for Walk-in/unconverted Quick customers. */
  partyId: string | null;
  partyName: string;
  partyGstin: string | null;
  placeOfSupplyStateCode: string;
  /** null for Credit/Debit Note lines — freeform, no product to resolve an HSN from. */
  hsnCode: string | null;
  /** null for Credit/Debit Note lines. */
  productId: string | null;
  /** null for Credit/Debit Note lines (freeform, no quantity). */
  quantity: number | null;
  ratePercent: number;
  cessPercent: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  totalAmount: number;
}
