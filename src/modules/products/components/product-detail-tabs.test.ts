import { describe, expect, it } from "vitest";

import { getProductDetailTabs } from "@/modules/products/components/product-detail-tabs";

describe("getProductDetailTabs", () => {
  it("returns only the Overview tab for a plain (untracked) product", () => {
    const tabs = getProductDetailTabs("product-1", false, false);

    expect(tabs).toHaveLength(1);
    expect(tabs.map((tab) => tab.key)).toEqual(["overview"]);
  });

  it("returns Overview and Batches for a batch-tracked product", () => {
    const tabs = getProductDetailTabs("product-1", true, false);

    expect(tabs.map((tab) => tab.key)).toEqual(["overview", "batches"]);
    expect(tabs[1].href).toBe("/masters/products/product-1/batches");
  });

  it("returns Overview and Serial Numbers for a serial-tracked product", () => {
    const tabs = getProductDetailTabs("product-1", false, true);

    expect(tabs.map((tab) => tab.key)).toEqual(["overview", "serial-numbers"]);
    expect(tabs[1].href).toBe("/masters/products/product-1/serial-numbers");
  });

  it("links to the product's own overview/batches routes", () => {
    const tabs = getProductDetailTabs("abc-123", true, false);

    expect(tabs[0].href).toBe("/masters/products/abc-123");
    expect(tabs[1].href).toBe("/masters/products/abc-123/batches");
  });

  it("links to the product's own overview/serial-numbers routes", () => {
    const tabs = getProductDetailTabs("abc-123", false, true);

    expect(tabs[0].href).toBe("/masters/products/abc-123");
    expect(tabs[1].href).toBe("/masters/products/abc-123/serial-numbers");
  });
});
