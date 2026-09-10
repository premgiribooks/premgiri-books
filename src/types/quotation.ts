import type { Quotation as PrismaQuotation, QuotationItem as PrismaQuotationItem } from "@prisma/client";

import type { PriceSource } from "@/engines/pricing/types";
import type { DocumentGroupResult } from "@/engines/gst/types";

export type { QuotationStatus } from "@prisma/client";

type QuotationItemDecimalField =
  | "quantity"
  | "rate"
  | "discountPercent"
  | "discountAmount"
  | "ratePercent"
  | "cessPercent"
  | "taxableAmount"
  | "cgst"
  | "sgst"
  | "igst"
  | "cess"
  | "totalAmount";

type QuotationDecimalField =
  | "subtotal"
  | "totalDiscount"
  | "taxableAmount"
  | "totalCgst"
  | "totalSgst"
  | "totalIgst"
  | "totalCess"
  | "grandTotal";

// Every Prisma `Decimal` field is normalized to `number` at the repository
// boundary — a `Decimal` instance does not survive the Server Component /
// Server Action serialization boundary (the `src/types/product.ts`
// convention, extended here over every money/quantity/percent column).
export interface QuotationItem
  extends Omit<PrismaQuotationItem, QuotationItemDecimalField>,
    Record<QuotationItemDecimalField, number> {}

export interface Quotation
  extends Omit<PrismaQuotation, QuotationDecimalField>,
    Record<QuotationDecimalField, number> {}

/** The slice of Product a quotation line's read-model needs to display — a
 * narrow read-model rather than the full ProductWithRelations, following
 * WarehouseBranchOption's convention (nothing here changes when Product
 * Management evolves). */
export interface QuotationProductSnapshot {
  id: string;
  name: string;
  productCode: string;
  isActive: boolean;
}

export interface QuotationItemDetail extends QuotationItem {
  product: QuotationProductSnapshot;
}

/** The slice of Customer a quotation's read-model needs — the display name
 * comes from the paired Ledger (Customer's 1:1 extension model), not a
 * direct Customer field. */
export interface QuotationCustomerOption {
  id: string;
  name: string;
  isActive: boolean;
}

export interface QuotationListRow extends Quotation {
  customer: QuotationCustomerOption;
}

export interface QuotationDetail extends Quotation {
  customer: QuotationCustomerOption;
  items: QuotationItemDetail[];
}

export type QuotationStatusFilter =
  | "DRAFT"
  | "SENT"
  | "ACCEPTED"
  | "REJECTED"
  | "EXPIRED"
  | "CANCELLED";

export interface QuotationListFilters {
  search?: string;
  status?: QuotationStatusFilter;
  customerId?: string;
  fromDate?: Date;
  toDate?: Date;
}

/** The product picker's options — active products of the current company,
 * plus the GST/unit snapshot fields a new line needs at add-time. Deliberately
 * narrower than ProductWithRelations (25-product-management.md's
 * PRODUCT_INCLUDE has no gstRate percentages) — see
 * quotation-repository.ts's findQuotableProducts. */
export interface QuotationProductOption {
  id: string;
  name: string;
  productCode: string;
  isActive: boolean;
  unitSymbol: string;
  unitDecimalPlaces: number;
  hsnCode: string | null;
  /** Whether the product has a GST Rate assigned at all — a real, assigned
   * 0% ("Nil rated") rate is NOT the same as no rate assigned; only the
   * latter warns (quotation-service.ts's isGstRateMissing). */
  hasGstRate: boolean;
  ratePercent: number;
  cessPercent: number;
  sellingPrice: number | null;
  purchasePrice: number | null;
}

/** Everything the Quotation Form needs to render its pickers and the "next
 * number" preview, loaded once up front. */
export interface QuotationFormOptions {
  customers: QuotationCustomerOption[];
  products: QuotationProductOption[];
  companyStateCode: string | null;
  nextQuotationNumber: string;
}

/** A resolved-or-warned line, returned by the live-preview Server Action —
 * mirrors CalculateLineResult plus the two non-blocking warning flags
 * (35-quotations.md's Business Rules: below-cost and missing-HSN are
 * warnings, never hard blocks). */
export interface QuotationLineComputation {
  lineNumber: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  totalAmount: number;
  isBelowCost: boolean;
  isHsnMissing: boolean;
  isGstRateMissing: boolean;
}

export interface QuotationTotals {
  subtotal: number;
  totalDiscount: number;
  taxableAmount: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalCess: number;
  grandTotal: number;
}

/** The live-editing preview — the browser never computes tax/pricing itself;
 * this is the Server Action response `previewQuotationAction` returns. */
export interface QuotationPreview {
  lines: QuotationLineComputation[];
  totals: QuotationTotals;
  groups: DocumentGroupResult[];
}

export interface ResolvedLinePrice {
  price: number | null;
  source: PriceSource;
  isBelowCost: boolean;
  purchaseCost: number | null;
}
