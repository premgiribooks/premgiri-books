import type { GstFilingRecord as PrismaGstFilingRecord } from "@prisma/client";

export type { GstFilingStatus, GstReturnType } from "@prisma/client";

// No Decimal fields on GstFilingRecord — a plain alias, like
// StockAdjustment/StockTransfer/PhysicalVerification's own header types.
export type GstFilingRecord = PrismaGstFilingRecord;

/** One document's own rate-wise tax breakup line, within an invoice-wise (B2B/B2C Large/registered-notes) group. */
export interface Gstr1TaxBreakup {
  ratePercent: number;
  cessPercent: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  totalAmount: number;
}

/** Table 4 (B2B), Table 5 (B2C Large), and Table 9B/9C's registered rows — one row group per source document. */
export interface Gstr1DocumentGroup {
  documentId: string;
  documentType: "SALES_INVOICE" | "CREDIT_NOTE" | "DEBIT_NOTE";
  documentNumber: string;
  documentDate: Date;
  partyId: string | null;
  partyName: string;
  partyGstin: string | null;
  placeOfSupplyStateCode: string;
  breakup: Gstr1TaxBreakup[];
  taxableAmount: number;
  totalAmount: number;
}

/** Table 7 (B2C Small) and Table 9B/9C's unregistered rows — consolidated by (place of supply, rate). */
export interface Gstr1ConsolidatedGroup {
  placeOfSupplyStateCode: string;
  ratePercent: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  totalAmount: number;
}

/** Table 8 (Nil-rated/Exempt) — consolidated by place of supply only (rate is always 0). */
export interface Gstr1NilRatedGroup {
  placeOfSupplyStateCode: string;
  taxableAmount: number;
  totalAmount: number;
}

export interface Gstr1Return {
  periodStart: Date;
  periodEnd: Date;
  b2b: Gstr1DocumentGroup[];
  b2cLarge: Gstr1DocumentGroup[];
  b2cSmall: Gstr1ConsolidatedGroup[];
  nilRated: Gstr1NilRatedGroup[];
  creditDebitNotesRegistered: Gstr1DocumentGroup[];
  creditDebitNotesUnregistered: Gstr1ConsolidatedGroup[];
}

export interface MarkPeriodFiledInput {
  periodStart: Date;
  periodEnd: Date;
  arn?: string;
}
