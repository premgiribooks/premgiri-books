import { describe, expect, it } from "vitest";

import { getProductDetailTabs } from "@/modules/products/components/product-detail-tabs";

describe("getProductDetailTabs", () => {
  it("returns only the Overview tab for a non-batch-tracked product", () => {
    const tabs = getProductDetailTabs("product-1", false);

    expect(tabs).toHaveLength(1);
    expect(tabs.map((tab) => tab.key)).toEqual(["overview"]);
  });

  it("returns Overview and Batches for a batch-tracked product", () => {
    const tabs = getProductDetailTabs("product-1", true);

    expect(tabs.map((tab) => tab.key)).toEqual(["overview", "batches"]);
    expect(tabs[1].href).toBe("/masters/products/product-1/batches");
  });

  it("links to the product's own overview/batches routes", () => {
    const tabs = getProductDetailTabs("abc-123", true);

    expect(tabs[0].href).toBe("/masters/products/abc-123");
    expect(tabs[1].href).toBe("/masters/products/abc-123/batches");
  });
});
