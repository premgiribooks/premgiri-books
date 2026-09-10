import { AppError } from "@/lib/app-error";

// Pure line/header arithmetic — mirrors sales-invoice-calculations.ts
// exactly (44-purchase-invoice.md mirrors 38-sales-invoice.md's posting
// orchestration, direction reversed; the arithmetic itself is identical).
// No I/O, no engine calls. Every sum runs in integer paise to avoid float
// drift.

export function toPaise(amount: number): number {
  return Math.round(amount * 100);
}

/** quantity x rate, in paise. */
export function lineGrossPaise(quantity: number, rate: number): number {
  return Math.round(quantity * rate * 100);
}

/** discountAmount + (discountPercent% of quantity x rate), in paise — percent
 * applied first, then the flat amount added to it. */
export function lineDiscountPaise(grossPaise: number, discountPercent: number, discountAmount: number): number {
  const percentPortionPaise = Math.round((grossPaise * discountPercent) / 100);
  return percentPortionPaise + toPaise(discountAmount);
}

/**
 * Re-asserts the same "combined discount cannot exceed the line's gross
 * value" guard the Zod schema's per-line refine already checks — defense in
 * depth. Returns the taxable amount in RUPEES (2 decimals), never negative,
 * never silently clamped to zero.
 */
export function computeTaxableAmountPre(
  quantity: number,
  rate: number,
  discountPercent: number,
  discountAmount: number
): number {
  const grossPaise = lineGrossPaise(quantity, rate);
  const discountPaise = lineDiscountPaise(grossPaise, discountPercent, discountAmount);

  if (discountPaise > grossPaise) {
    throw new AppError("The total discount on this line cannot exceed the line's value.");
  }

  return (grossPaise - discountPaise) / 100;
}

export interface HeaderTotalsInput {
  quantity: number;
  rate: number;
  discountPercent: number;
  discountAmount: number;
}

export interface HeaderGrossTotals {
  subtotal: number;
  totalDiscount: number;
}

/**
 * `subtotal`/`totalDiscount` are the only two header fields NOT produced by
 * the GST Engine's calculateDocument — mirrors sales-invoice-calculations.ts's
 * sumHeaderGrossTotals exactly.
 */
export function sumHeaderGrossTotals(lines: readonly HeaderTotalsInput[]): HeaderGrossTotals {
  let subtotalPaise = 0;
  let totalDiscountPaise = 0;

  for (const line of lines) {
    const grossPaise = lineGrossPaise(line.quantity, line.rate);
    const discountPaise = lineDiscountPaise(grossPaise, line.discountPercent, line.discountAmount);
    subtotalPaise += grossPaise;
    totalDiscountPaise += discountPaise;
  }

  return {
    subtotal: subtotalPaise / 100,
    totalDiscount: totalDiscountPaise / 100,
  };
}

export interface EffectiveLineTax {
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
}

export interface EffectiveTaxTotals {
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalCess: number;
}

/**
 * Sums each line's EFFECTIVE (override-substituted-where-applicable) tax in
 * paise — the header totals this document actually posts to the voucher.
 * `cgst`/`sgst`/`igst`/`cess` passed in here are already each line's "used"
 * value (computed when not overridden, overridden when it is) — see
 * purchase-invoice-service.ts's buildLine.
 */
export function sumEffectiveTax(lines: readonly EffectiveLineTax[]): EffectiveTaxTotals {
  let cgstPaise = 0;
  let sgstPaise = 0;
  let igstPaise = 0;
  let cessPaise = 0;

  for (const line of lines) {
    cgstPaise += toPaise(line.cgst);
    sgstPaise += toPaise(line.sgst);
    igstPaise += toPaise(line.igst);
    cessPaise += toPaise(line.cess);
  }

  return {
    totalCgst: cgstPaise / 100,
    totalSgst: sgstPaise / 100,
    totalIgst: igstPaise / 100,
    totalCess: cessPaise / 100,
  };
}

export interface RoundOffResult {
  /** The invoice's rupee-rounded grand total. */
  grandTotal: number;
  /** `grandTotal - exactTotal` — positive when rounded UP (posts DEBIT),
   * negative when rounded DOWN (posts CREDIT), zero when no rounding entry is
   * needed (44-purchase-invoice.md's Ledger Posting rule — the mirror of
   * Sales Invoice's sign convention). */
  roundOff: number;
}

/**
 * Rounds the exact pre-round-off total (taxable + effective cgst + sgst +
 * igst + cess, already paise-safe) to the nearest whole rupee. Takes the
 * exact total in PAISE (an integer) rather than rupees, so the subtraction
 * that derives `roundOff` never reintroduces float drift.
 */
export function computeRoundOff(exactTotalPaise: number): RoundOffResult {
  const roundedRupees = Math.round(exactTotalPaise / 100);
  const roundOffPaise = roundedRupees * 100 - exactTotalPaise;
  return { grandTotal: roundedRupees, roundOff: roundOffPaise / 100 };
}
