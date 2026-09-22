import { describe, expect, it } from "vitest";

import { getProductDetailTabs } from "@/modules/products/components/product-detail-tabs";

describe("getProductDetailTabs", () => {
  it("returns Overview and Purchase Price History for a plain (untracked) product", () => {
    const tabs = getProductDetailTabs("product-1", false, false);

    expect(tabs).toHaveLength(2);
    expect(tabs.map((tab) => tab.key)).toEqual(["overview", "purchase-price-history"]);
  });

  it("returns Overview, Batches, and Purchase Price History for a batch-tracked product", () => {
    const tabs = getProductDetailTabs("product-1", true, false);

    expect(tabs.map((tab) => tab.key)).toEqual(["overview", "batches", "purchase-price-history"]);
    expect(tabs[1].href).toBe("/masters/products/product-1/batches");
  });

  it("returns Overview, Serial Numbers, and Purchase Price History for a serial-tracked product", () => {
    const tabs = getProductDetailTabs("product-1", false, true);

    expect(tabs.map((tab) => tab.key)).toEqual(["overview", "serial-numbers", "purchase-price-history"]);
    expect(tabs[1].href).toBe("/masters/products/product-1/serial-numbers");
  });

  it("links to the product's own overview/batches/purchase-price-history routes", () => {
    const tabs = getProductDetailTabs("abc-123", true, false);

    expect(tabs[0].href).toBe("/masters/products/abc-123");
    expect(tabs[1].href).toBe("/masters/products/abc-123/batches");
    expect(tabs[2].href).toBe("/masters/products/abc-123/purchase-price-history");
  });

  it("links to the product's own overview/serial-numbers/purchase-price-history routes", () => {
    const tabs = getProductDetailTabs("abc-123", false, true);

    expect(tabs[0].href).toBe("/masters/products/abc-123");
    expect(tabs[1].href).toBe("/masters/products/abc-123/serial-numbers");
    expect(tabs[2].href).toBe("/masters/products/abc-123/purchase-price-history");
  });
});
