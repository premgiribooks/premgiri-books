import type { GstSupplyLine } from "@/engines/gst/gst-report-types";

export type { GstSupplyLine, GstSupplyLineDocumentType } from "@/engines/gst/gst-report-types";

export type GstRegisterType = "OUTWARD" | "INWARD";

/** Shared date-range/party/HSN/rate filter shape — 57-gst-registers.md, reused by specs 58-60. */
export interface GstReportFilters {
  from: Date;
  to: Date;
  partyId?: string;
  hsnCode?: string;
  ratePercent?: number;
  page?: number;
  pageSize?: number;
}

export interface GstRegisterTotals {
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  totalAmount: number;
}

/** The zero value of GstRegisterTotals — shared by every GST report screen/service
 * (Registers, HSN Summary, GSTR-1's embedded Table 12) instead of each redefining
 * its own copy of the same six-field literal. */
export const ZERO_GST_REGISTER_TOTALS: GstRegisterTotals = {
  taxableAmount: 0,
  cgst: 0,
  sgst: 0,
  igst: 0,
  cess: 0,
  totalAmount: 0,
};

/** One page of a register plus the period's running total across every
 * filtered line (not just the current page) — the UI's "running period
 * total row". */
export interface GstRegisterResult {
  lines: GstSupplyLine[];
  totals: GstRegisterTotals;
  page: number;
  pageSize: number;
  totalCount: number;
}

/** The party filter dropdown's options — Customers for the Outward register, Suppliers for Inward. */
export interface GstPartyOption {
  id: string;
  name: string;
  gstin: string | null;
}
