import { AppError } from "@/lib/app-error";

// Pure line/header arithmetic — no I/O, no engine calls. Owns only the
// "gross value and discount" math that comes BEFORE the GST Engine's
// calculateLine (35-quotations.md's Business Rules: "percent applied first,
// then the flat amount subtracted"). Every comparison runs in integer paise
// to avoid float drift (the gst-calculation.ts/voucher-validation.ts idiom).

export function toPaise(amount: number): number {
  return Math.round(amount * 100);
}

/** quantity x rate, in paise. */
export function lineGrossPaise(quantity: number, rate: number): number {
  return Math.round(quantity * rate * 100);
}

/** discountAmount + (discountPercent% of quantity x rate), in paise — the
 * documented order: percent applied first, then the flat amount added to it
 * (both are independent, optional reductions of the same gross value). */
export function lineDiscountPaise(
  grossPaise: number,
  discountPercent: number,
  discountAmount: number
): number {
  const percentPortionPaise = Math.round((grossPaise * discountPercent) / 100);
  return percentPortionPaise + toPaise(discountAmount);
}

/**
 * Re-asserts the same "combined discount cannot exceed the line's gross
 * value" guard the Zod schema's per-line refine already checks — defense in
 * depth, since a server-computed taxableAmount must never be trusted from a
 * single enforcement point (35-quotations.md's Business Rules). Returns the
 * taxable amount in RUPEES (2 decimals), never negative, never silently
 * clamped to zero — an over-discounted line is a rejected input, not a
 * clamped one.
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
 * the GST Engine's calculateDocument — every tax field and grandTotal come
 * straight from that engine's result (quotation-service.ts's
 * createQuotation). Summed in paise, per line, then converted to rupees
 * once at the end — never by summing already-divided decimal floats.
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
