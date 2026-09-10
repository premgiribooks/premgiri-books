import { describe, expect, it } from "vitest";

import {
  computeRoundOff,
  computeTaxableAmountPre,
  lineDiscountPaise,
  lineGrossPaise,
  sumEffectiveTax,
  sumHeaderGrossTotals,
} from "@/modules/purchase-invoices/utils/purchase-invoice-calculations";

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
});

describe("computeTaxableAmountPre", () => {
  it("subtracts the combined discount from the gross value", () => {
    expect(computeTaxableAmountPre(10, 100, 10, 50)).toBe(850);
  });

  it("throws when the combined discount exceeds the gross value", () => {
    expect(() => computeTaxableAmountPre(10, 100, 50, 500.01)).toThrow(
      "The total discount on this line cannot exceed the line's value."
    );
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

describe("sumEffectiveTax", () => {
  it("sums each line's tax in paise, avoiding float drift", () => {
    const result = sumEffectiveTax([
      { cgst: 0.1, sgst: 0.1, igst: 0, cess: 0 },
      { cgst: 0.2, sgst: 0.2, igst: 0, cess: 0 },
    ]);
    expect(result.totalCgst).toBe(0.3);
    expect(result.totalSgst).toBe(0.3);
  });

  it("returns zero totals for an empty line list", () => {
    expect(sumEffectiveTax([])).toEqual({ totalCgst: 0, totalSgst: 0, totalIgst: 0, totalCess: 0 });
  });
});

describe("computeRoundOff", () => {
  it("rounds up: a fractional total above the half-paisa point produces a positive (DEBIT for purchase) round-off", () => {
    // 1189.63 -> 1190, roundOff = +0.37
    const result = computeRoundOff(118963);
    expect(result.grandTotal).toBe(1190);
    expect(result.roundOff).toBeCloseTo(0.37, 2);
  });

  it("rounds down: a fractional total below the half-paisa point produces a negative (CREDIT for purchase) round-off", () => {
    // 1189.30 -> 1189, roundOff = -0.30
    const result = computeRoundOff(118930);
    expect(result.grandTotal).toBe(1189);
    expect(result.roundOff).toBeCloseTo(-0.3, 2);
  });

  it("returns zero round-off for an already-whole-rupee total", () => {
    const result = computeRoundOff(120000);
    expect(result.grandTotal).toBe(1200);
    expect(result.roundOff).toBe(0);
  });
});
