import { describe, expect, it } from "vitest";

import {
  computeTaxableAmountPre,
  lineDiscountPaise,
  lineGrossPaise,
  sumHeaderGrossTotals,
} from "@/modules/sales-orders/utils/sales-order-calculations";

describe("lineGrossPaise", () => {
  it("computes quantity x rate in integer paise", () => {
    expect(lineGrossPaise(10, 100)).toBe(100000);
    expect(lineGrossPaise(1.5, 18.15)).toBe(2723);
  });
});

describe("lineDiscountPaise", () => {
  it("applies percent first, then adds the flat amount", () => {
    expect(lineDiscountPaise(100000, 10, 50)).toBe(15000);
  });

  it("returns zero when neither discount is given", () => {
    expect(lineDiscountPaise(100000, 0, 0)).toBe(0);
  });
});

describe("computeTaxableAmountPre", () => {
  it("subtracts the combined discount from the gross value", () => {
    expect(computeTaxableAmountPre(10, 100, 10, 50)).toBe(850);
  });

  it("returns zero for a combined discount exactly equal to the gross value", () => {
    expect(computeTaxableAmountPre(10, 100, 50, 500)).toBe(0);
  });

  it("throws when the combined discount exceeds the gross value", () => {
    expect(() => computeTaxableAmountPre(10, 100, 50, 500.01)).toThrow(
      "The total discount on this line cannot exceed the line's value."
    );
  });

  it("returns the full gross value when no discount is given", () => {
    expect(computeTaxableAmountPre(5, 20, 0, 0)).toBe(100);
  });
});

describe("sumHeaderGrossTotals", () => {
  it("sums subtotal and total discount across multiple lines in paise", () => {
    const result = sumHeaderGrossTotals([
      { quantity: 10, rate: 100, discountPercent: 10, discountAmount: 0 },
      { quantity: 2, rate: 50, discountPercent: 0, discountAmount: 5 },
    ]);
    expect(result.subtotal).toBe(1100);
    expect(result.totalDiscount).toBe(105);
  });

  it("returns zero totals for an empty line list", () => {
    expect(sumHeaderGrossTotals([])).toEqual({ subtotal: 0, totalDiscount: 0 });
  });
});
