import { AppError } from "@/lib/app-error";

// Pure line/header arithmetic — mirrors sales-order-calculations.ts exactly
// (42-purchase-orders.md: "This spec reuses every Phase 3 convention that
// transfers directly"). No I/O, no engine calls. Every comparison runs in
// integer paise to avoid float drift.

export function toPaise(amount: number): number {
  return Math.round(amount * 100);
}

/** quantity x rate, in paise. */
export function lineGrossPaise(quantity: number, rate: number): number {
  return Math.round(quantity * rate * 100);
}

/** discountAmount + (discountPercent% of quantity x rate), in paise — percent
 * applied first, then the flat amount added to it. */
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
 * the GST Engine's calculateDocument — every tax field and grandTotal come
 * straight from that engine's result (purchase-order-service.ts's
 * createPurchaseOrder). Summed in paise, per line, then converted to rupees
 * once at the end.
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
