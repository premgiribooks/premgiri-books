// Shared money/rounding helpers mirroring the conventions already used by
// sales-invoice-service.ts / purchase-invoice-service.ts (paise-based exact
// summation, round to the nearest rupee for `roundOff`/`grandTotal`) so this
// migration's recomputed GST and round-off match the app's own posting logic
// instead of copying the legacy voucher's stored numbers.

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function round4(value: number): number {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

export function toPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

export interface RoundOffResult {
  grandTotal: number;
  roundOff: number;
}

/** Rounds an exact paise total to the nearest whole rupee; the difference is `roundOff`. */
export function computeRoundOff(exactTotalPaise: number): RoundOffResult {
  const grandTotalPaise = Math.round(exactTotalPaise / 100) * 100;
  const grandTotal = grandTotalPaise / 100;
  const exactTotal = exactTotalPaise / 100;
  return { grandTotal, roundOff: round2(grandTotal - exactTotal) };
}
