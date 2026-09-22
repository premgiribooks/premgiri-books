import { describe, expect, it } from "vitest";
import { resolveLatestPurchaseCostUpdates } from "@/engines/pricing/purchase-cost-sync";

describe("resolveLatestPurchaseCostUpdates", () => {
  it("returns one update for a single line", () => {
    const updates = resolveLatestPurchaseCostUpdates([
      { productId: "p1", lineNumber: 1, netUnitCost: 120 },
    ]);
    expect(updates).toEqual([{ productId: "p1", newPurchasePrice: 120 }]);
  });

  it("picks the highest lineNumber when the same product appears twice", () => {
    const updates = resolveLatestPurchaseCostUpdates([
      { productId: "p1", lineNumber: 1, netUnitCost: 100 },
      { productId: "p1", lineNumber: 2, netUnitCost: 150 },
    ]);
    expect(updates).toEqual([{ productId: "p1", newPurchasePrice: 150 }]);
  });

  it("picks the highest lineNumber regardless of input array order", () => {
    const updates = resolveLatestPurchaseCostUpdates([
      { productId: "p1", lineNumber: 3, netUnitCost: 150 },
      { productId: "p1", lineNumber: 1, netUnitCost: 100 },
      { productId: "p1", lineNumber: 2, netUnitCost: 125 },
    ]);
    expect(updates).toEqual([{ productId: "p1", newPurchasePrice: 150 }]);
  });

  it("emits one update per distinct product across many lines", () => {
    const updates = resolveLatestPurchaseCostUpdates([
      { productId: "p1", lineNumber: 1, netUnitCost: 100 },
      { productId: "p2", lineNumber: 2, netUnitCost: 200 },
      { productId: "p1", lineNumber: 3, netUnitCost: 110 },
      { productId: "p3", lineNumber: 4, netUnitCost: 300 },
      { productId: "p2", lineNumber: 5, netUnitCost: 210 },
    ]);
    expect(updates).toHaveLength(3);
    expect(updates).toEqual(
      expect.arrayContaining([
        { productId: "p1", newPurchasePrice: 110 },
        { productId: "p2", newPurchasePrice: 210 },
        { productId: "p3", newPurchasePrice: 300 },
      ]),
    );
  });

  it("drops a zero-cost line", () => {
    const updates = resolveLatestPurchaseCostUpdates([{ productId: "p1", lineNumber: 1, netUnitCost: 0 }]);
    expect(updates).toEqual([]);
  });

  it("drops a negative-cost line", () => {
    const updates = resolveLatestPurchaseCostUpdates([{ productId: "p1", lineNumber: 1, netUnitCost: -5 }]);
    expect(updates).toEqual([]);
  });

  it("drops only the zero-cost product, keeping a valid line for a different product", () => {
    const updates = resolveLatestPurchaseCostUpdates([
      { productId: "p1", lineNumber: 1, netUnitCost: 0 },
      { productId: "p2", lineNumber: 2, netUnitCost: 50 },
    ]);
    expect(updates).toEqual([{ productId: "p2", newPurchasePrice: 50 }]);
  });

  it("drops non-finite cost input defensively", () => {
    const updates = resolveLatestPurchaseCostUpdates([
      { productId: "p1", lineNumber: 1, netUnitCost: Number.NaN },
      { productId: "p2", lineNumber: 1, netUnitCost: Number.POSITIVE_INFINITY },
    ]);
    expect(updates).toEqual([]);
  });

  it("rounds the resolved cost half-up to two decimals", () => {
    const updates = resolveLatestPurchaseCostUpdates([
      { productId: "p1", lineNumber: 1, netUnitCost: 99.995 },
    ]);
    expect(updates).toEqual([{ productId: "p1", newPurchasePrice: 100 }]);
  });

  it("returns an empty array for empty input", () => {
    expect(resolveLatestPurchaseCostUpdates([])).toEqual([]);
  });
});
